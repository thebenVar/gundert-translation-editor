const fs = require('fs');
const path = require('path');
const {
    PROTECTED_SECTION_CONTENTS,
    extractEntryKeySequence,
    extractReferenceValues
} = require('./freeze_rules');

const DEFAULT_POLICY = {
    entryKeySequenceMismatch: 'error',
    referenceMismatch: 'error',
    paragraphCountMismatch: 'error',
    emptyTargetSegments: 'error',
    highIdentity: 'warning',
    glossaryDrift: 'warning',
    targetOnlyInvalidType: 'error',
    unknownOperationKind: 'warning',
    splitMergeWithoutOperation: 'warning',
    missingDraftForAdaptationChecks: 'warning'
};

const ALLOWED_TARGET_ONLY_TYPES = new Set([
    'target-title-override',
    'target-subheading',
    'target-paragraph',
    'translator-note'
]);

const ALLOWED_OPERATION_KINDS = new Set([
    'edit-content',
    'insert-target-only',
    'delete-target-only',
    'move-block',
    'split-paragraph',
    'merge-paragraphs'
]);

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const token = argv[i];
        if (token.startsWith('--')) {
            const key = token.slice(2);
            const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
            args[key] = value;
        }
    }
    return args;
}

function findEntryBlocks(xmlText) {
    return [...xmlText.matchAll(/<ThemLex_Entry\b[\s\S]*?<\/ThemLex_Entry>/g)].map((m) => m[0]);
}

function extractEntryKey(entryXml) {
    const match = entryXml.match(/<ThemLex_Entry[^>]*\bKey="([^"]+)"/);
    return match ? match[1] : 'unknown';
}

function collectEntryText(entryXml) {
    const texts = [];

    const titleMatch = entryXml.match(/<Title>([\s\S]*?)<\/Title>/);
    if (titleMatch && titleMatch[1].trim()) {
        texts.push(titleMatch[1].trim());
    }

    const sectionRegex = /<Section([^>]*)>([\s\S]*?)<\/Section>/g;
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(entryXml)) !== null) {
        const attrs = sectionMatch[1] || '';
        const body = sectionMatch[2] || '';
        const contentAttrMatch = attrs.match(/\bContent="([^"]*)"/i);
        const contentValue = (contentAttrMatch ? contentAttrMatch[1] : 'other').trim().toLowerCase();
        if (PROTECTED_SECTION_CONTENTS.has(contentValue)) {
            continue;
        }

        const headingMatches = [...body.matchAll(/<Heading>([\s\S]*?)<\/Heading>/g)].map((m) => m[1]);
        const paragraphMatches = [...body.matchAll(/<Paragraph>([\s\S]*?)<\/Paragraph>/g)].map((m) => m[1]);

        headingMatches.forEach((h) => {
            if (h.trim()) texts.push(h.trim());
        });
        paragraphMatches.forEach((p) => {
            if (p.trim()) texts.push(p.trim());
        });
    }

    return texts;
}

function countTranslatableParagraphs(entryXml) {
    let count = 0;
    const sectionRegex = /<Section([^>]*)>([\s\S]*?)<\/Section>/g;
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(entryXml)) !== null) {
        const attrs = sectionMatch[1] || '';
        const body = sectionMatch[2] || '';
        const contentAttrMatch = attrs.match(/\bContent="([^"]*)"/i);
        const contentValue = (contentAttrMatch ? contentAttrMatch[1] : 'other').trim().toLowerCase();
        if (PROTECTED_SECTION_CONTENTS.has(contentValue)) {
            continue;
        }
        count += [...body.matchAll(/<Paragraph>([\s\S]*?)<\/Paragraph>/g)].length;
    }
    return count;
}

function addIssue(report, entryReport, policy, policyKey, message, fallbackSeverity) {
    const configured = String(policy[policyKey] || fallbackSeverity || 'warning').toLowerCase();
    if (configured === 'ignore' || configured === 'off') {
        return;
    }

    const severity = (configured === 'error' || configured === 'block' || configured === 'blocking')
        ? 'error'
        : 'warning';

    if (severity === 'error') {
        report.errors.push(message);
        if (entryReport) {
            entryReport.errors.push(message);
        }
    } else {
        report.warnings.push(message);
        if (entryReport) {
            entryReport.warnings.push(message);
        }
    }
}

function parsePolicy(args) {
    let merged = { ...DEFAULT_POLICY };

    if (args['policy-file']) {
        const policyPath = path.resolve(process.cwd(), args['policy-file']);
        if (!fs.existsSync(policyPath)) {
            throw new Error(`Policy file does not exist: ${policyPath}`);
        }
        const filePolicy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
        merged = { ...merged, ...(filePolicy || {}) };
    }

    if (args.policy) {
        let inlinePolicy;
        try {
            inlinePolicy = JSON.parse(String(args.policy));
        } catch (err) {
            throw new Error(`Invalid --policy JSON value. Provide valid JSON, for example: --policy \"{\\\"paragraphCountMismatch\\\":\\\"warning\\\"}\". Received: ${String(args.policy)}`);
        }
        merged = { ...merged, ...(inlinePolicy || {}) };
    }

    return merged;
}

function loadDraftPayload(args) {
    const draftPathArg = args['draft-json'];
    if (!draftPathArg) {
        return null;
    }
    const draftPath = path.resolve(process.cwd(), draftPathArg);
    if (!fs.existsSync(draftPath)) {
        throw new Error(`Draft JSON file does not exist: ${draftPath}`);
    }
    return JSON.parse(fs.readFileSync(draftPath, 'utf8'));
}

function normalizeDraftEntryList(draftPayload) {
    if (!draftPayload) {
        return [];
    }
    if (Array.isArray(draftPayload.entries)) {
        return draftPayload.entries;
    }
    if (draftPayload.entryKey && Array.isArray(draftPayload.blocks)) {
        return [draftPayload];
    }
    return [];
}

function analyzeAdaptationPolicies(draftPayload, policy, report, entryReportsByKey) {
    const entries = normalizeDraftEntryList(draftPayload);
    if (entries.length === 0) {
        addIssue(
            report,
            null,
            policy,
            'missingDraftForAdaptationChecks',
            'Adaptation checks were skipped: no draft JSON entries provided.',
            'warning'
        );
        return {
            entriesChecked: 0,
            targetOnlyBlocks: 0,
            targetOnlyInvalidTypeCount: 0,
            unknownOperationCount: 0,
            splitOps: 0,
            mergeOps: 0
        };
    }

    let targetOnlyBlocks = 0;
    let targetOnlyInvalidTypeCount = 0;
    let unknownOperationCount = 0;
    let splitOps = 0;
    let mergeOps = 0;

    entries.forEach((entry) => {
        const entryKey = String(entry.entryKey || 'unknown');
        const entryReport = entryReportsByKey.get(entryKey) || null;
        const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
        const operations = Array.isArray(entry.operations) ? entry.operations : [];

        const targetOnly = blocks.filter((b) => b && b.class === 'target-only');
        targetOnlyBlocks += targetOnly.length;

        targetOnly.forEach((block) => {
            if (!ALLOWED_TARGET_ONLY_TYPES.has(String(block.type || '').toLowerCase())) {
                targetOnlyInvalidTypeCount += 1;
                addIssue(
                    report,
                    entryReport,
                    policy,
                    'targetOnlyInvalidType',
                    `Entry ${entryKey}: target-only block has unsupported type "${block.type || 'unknown'}".`,
                    'error'
                );
            }
        });

        operations.forEach((op) => {
            const kind = String(op && op.kind ? op.kind : '').toLowerCase();
            if (!ALLOWED_OPERATION_KINDS.has(kind)) {
                unknownOperationCount += 1;
                addIssue(
                    report,
                    entryReport,
                    policy,
                    'unknownOperationKind',
                    `Entry ${entryKey}: operation kind "${kind || 'unknown'}" is not allowed by policy.`,
                    'warning'
                );
            }
            if (kind === 'split-paragraph') splitOps += 1;
            if (kind === 'merge-paragraphs') mergeOps += 1;
        });
    });

    return {
        entriesChecked: entries.length,
        targetOnlyBlocks,
        targetOnlyInvalidTypeCount,
        unknownOperationCount,
        splitOps,
        mergeOps
    };
}

function computeSimilarityFlags(sourceTexts, targetTexts) {
    if (sourceTexts.length === 0 || targetTexts.length === 0) {
        return { identicalRatio: 0, emptyTargetSegments: 0 };
    }

    const total = Math.min(sourceTexts.length, targetTexts.length);
    let identical = 0;
    let emptyTargetSegments = 0;

    for (let i = 0; i < total; i++) {
        const s = (sourceTexts[i] || '').trim();
        const t = (targetTexts[i] || '').trim();
        if (!t) {
            emptyTargetSegments += 1;
        }
        if (s && t && s === t) {
            identical += 1;
        }
    }

    return {
        identicalRatio: total > 0 ? identical / total : 0,
        emptyTargetSegments
    };
}

function loadGlossaryLocks(lang) {
    const filePath = path.join(__dirname, 'glossary_locks.json');
    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const selected = payload[String(lang || '').toLowerCase()] || [];
        return Array.isArray(selected) ? selected : [];
    } catch {
        return [];
    }
}

function countTermMatches(text, term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return (text.match(regex) || []).length;
}

function checkGlossaryDrift(sourceXml, targetXml, glossaryTerms) {
    const warnings = [];
    let checked = 0;
    let mismatched = 0;

    glossaryTerms.forEach((term) => {
        const sourceCount = countTermMatches(sourceXml, term);
        if (sourceCount === 0) {
            return;
        }
        checked += 1;
        const targetCount = countTermMatches(targetXml, term);
        if (targetCount < sourceCount) {
            mismatched += 1;
            warnings.push(`Glossary term drift: "${term}" appears ${sourceCount} time(s) in source but ${targetCount} time(s) in target.`);
        }
    });

    return { warnings, checked, mismatched };
}

async function runOptionalModelReview(payload, args) {
    const provider = (args.provider || '').toLowerCase();
    if (provider !== 'openai-compatible') {
        return null;
    }

    const apiKey = args['api-key'] || process.env.OPENAI_API_KEY;
    const baseUrl = (args['base-url'] || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = args.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    if (!apiKey) {
        return {
            warnings: ['Skipping model review: missing OPENAI_API_KEY.'],
            errors: []
        };
    }

    const systemPrompt = [
        'You are a translation QA checker for XML dictionary entries.',
        'Return strict JSON object with keys: errors (array), warnings (array), suggested_fixes (array).',
        'Focus on dropped meaning, suspicious paraphrases, and unintended changes to theological/technical terms.',
        'Do not include markdown.'
    ].join(' ');

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: JSON.stringify(payload)
                }
            ]
        })
    });

    if (!response.ok) {
        const body = await response.text();
        return {
            warnings: [`Model review request failed (${response.status}): ${body}`],
            errors: []
        };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        return {
            warnings: ['Model review returned empty content.'],
            errors: []
        };
    }

    try {
        const parsed = JSON.parse(content);
        return {
            errors: Array.isArray(parsed.errors) ? parsed.errors : [],
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
            suggested_fixes: Array.isArray(parsed.suggested_fixes) ? parsed.suggested_fixes : []
        };
    } catch (err) {
        return {
            warnings: ['Model review returned non-JSON content.'],
            errors: []
        };
    }
}

async function validate(sourceXml, targetXml, args = {}) {
    const policy = parsePolicy(args);
    const draftPayload = loadDraftPayload(args);

    const report = {
        valid: true,
        errors: [],
        warnings: [],
        suggested_fixes: [],
        metrics: {},
        policy,
        entryReports: []
    };

    const targetLang = String(args.lang || 'fr').toLowerCase();
    const glossaryTerms = loadGlossaryLocks(targetLang);

    const sourceKeys = extractEntryKeySequence(sourceXml);
    const targetKeys = extractEntryKeySequence(targetXml);

    if (JSON.stringify(sourceKeys) !== JSON.stringify(targetKeys)) {
        addIssue(
            report,
            null,
            policy,
            'entryKeySequenceMismatch',
            'Entry key sequence mismatch before LLM QA.',
            'error'
        );
    }

    const srcRefs = extractReferenceValues(sourceXml);
    const tgtRefs = extractReferenceValues(targetXml);
    if (JSON.stringify(srcRefs) !== JSON.stringify(tgtRefs)) {
        addIssue(
            report,
            null,
            policy,
            'referenceMismatch',
            'Reference mismatch before LLM QA.',
            'error'
        );
    }

    const sourceEntries = findEntryBlocks(sourceXml);
    const targetEntries = findEntryBlocks(targetXml);
    const totalEntries = Math.min(sourceEntries.length, targetEntries.length);

    let entriesWithHighIdentity = 0;
    let entriesWithEmptySegments = 0;
    let paragraphCountMismatches = 0;

    const samplePairs = [];

    const entryReportsByKey = new Map();

    for (let i = 0; i < totalEntries; i++) {
        const srcEntry = sourceEntries[i];
        const tgtEntry = targetEntries[i];
        const entryKey = extractEntryKey(srcEntry);
        const entryReport = {
            entryKey,
            errors: [],
            warnings: [],
            suggested_fixes: []
        };
        entryReportsByKey.set(String(entryKey), entryReport);
        report.entryReports.push(entryReport);

        const srcTexts = collectEntryText(srcEntry);
        const tgtTexts = collectEntryText(tgtEntry);

        const srcParagraphCount = countTranslatableParagraphs(srcEntry);
        const tgtParagraphCount = countTranslatableParagraphs(tgtEntry);
        if (srcParagraphCount !== tgtParagraphCount) {
            paragraphCountMismatches += 1;
            addIssue(
                report,
                entryReport,
                policy,
                'paragraphCountMismatch',
                `Entry ${entryKey}: translatable paragraph count changed (${srcParagraphCount} -> ${tgtParagraphCount}).`,
                'error'
            );
        }

        const flags = computeSimilarityFlags(srcTexts, tgtTexts);
        if (flags.identicalRatio > 0.9 && srcTexts.length > 5) {
            entriesWithHighIdentity += 1;
        }
        if (flags.emptyTargetSegments > 0) {
            entriesWithEmptySegments += 1;
            addIssue(
                report,
                entryReport,
                policy,
                'emptyTargetSegments',
                `Entry ${entryKey}: contains ${flags.emptyTargetSegments} empty translated segment(s).`,
                'error'
            );
        }

        if (samplePairs.length < 10) {
            samplePairs.push({
                entryKey,
                source: srcTexts.slice(0, 4),
                target: tgtTexts.slice(0, 4)
            });
        }
    }

    if (entriesWithHighIdentity > 0) {
        addIssue(
            report,
            null,
            policy,
            'highIdentity',
            `${entriesWithHighIdentity} entries appear mostly unchanged (high source/target identity).`,
            'warning'
        );
    }

    if (entriesWithEmptySegments > 0) {
        addIssue(
            report,
            null,
            policy,
            'emptyTargetSegments',
            `${entriesWithEmptySegments} entries include empty translated segments.`,
            'warning'
        );
    }

    if (paragraphCountMismatches > 0) {
        addIssue(
            report,
            null,
            policy,
            'paragraphCountMismatch',
            `${paragraphCountMismatches} entries changed paragraph counts.`,
            'warning'
        );
    }

    const glossaryCheck = checkGlossaryDrift(sourceXml, targetXml, glossaryTerms);
    glossaryCheck.warnings.forEach((warning) => {
        addIssue(report, null, policy, 'glossaryDrift', warning, 'warning');
    });

    const adaptation = analyzeAdaptationPolicies(draftPayload, policy, report, entryReportsByKey);
    if (paragraphCountMismatches > 0 && adaptation.splitOps === 0 && adaptation.mergeOps === 0) {
        addIssue(
            report,
            null,
            policy,
            'splitMergeWithoutOperation',
            'Paragraph count mismatches found, but no split-paragraph or merge-paragraphs operations were declared in draft JSON.',
            'warning'
        );
    }

    const modelReview = await runOptionalModelReview(
        {
            objective: 'QA review for translation quality and protected-token safety.',
            samplePairs,
            glossaryTerms,
            heuristics: {
                entriesWithHighIdentity,
                entriesWithEmptySegments,
                paragraphCountMismatches,
                glossaryTermsChecked: glossaryCheck.checked,
                glossaryTermsMismatched: glossaryCheck.mismatched
            }
        },
        args
    );

    if (modelReview) {
        report.errors.push(...(modelReview.errors || []));
        report.warnings.push(...(modelReview.warnings || []));
        report.suggested_fixes.push(...(modelReview.suggested_fixes || []));
    }

    report.metrics = {
        sourceEntries: sourceEntries.length,
        targetEntries: targetEntries.length,
        entriesChecked: totalEntries,
        entriesWithHighIdentity,
        entriesWithEmptySegments,
        paragraphCountMismatches,
        sourceReferences: srcRefs.length,
        targetReferences: tgtRefs.length,
        glossaryTermsConfigured: glossaryTerms.length,
        glossaryTermsChecked: glossaryCheck.checked,
        glossaryTermsMismatched: glossaryCheck.mismatched,
        adaptationEntriesChecked: adaptation.entriesChecked,
        targetOnlyBlocks: adaptation.targetOnlyBlocks,
        targetOnlyInvalidTypeCount: adaptation.targetOnlyInvalidTypeCount,
        unknownOperationCount: adaptation.unknownOperationCount,
        splitOps: adaptation.splitOps,
        mergeOps: adaptation.mergeOps
    };

    report.valid = report.errors.length === 0;
    return report;
}

async function main() {
    const args = parseArgs(process.argv);
    const srcPath = args.src ? path.resolve(process.cwd(), args.src) : null;
    const tgtPath = args.tgt ? path.resolve(process.cwd(), args.tgt) : null;

    if (!srcPath || !tgtPath) {
        console.error('Usage: node scripts/translation/validate_llm.js --src <source.xml> --tgt <target.xml> [--lang fr] [--provider openai-compatible] [--draft-json <file.json>] [--policy-file <file.json>] [--policy <inline-json>]');
        process.exit(2);
    }

    if (!fs.existsSync(srcPath) || !fs.existsSync(tgtPath)) {
        console.error('Source or target file does not exist.');
        process.exit(2);
    }

    const srcXml = fs.readFileSync(srcPath, 'utf8');
    const tgtXml = fs.readFileSync(tgtPath, 'utf8');

    const report = await validate(srcXml, tgtXml, args);
    console.log(JSON.stringify(report, null, 2));

    if (!report.valid) {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err && err.stack ? err.stack : String(err));
        process.exit(1);
    });
}

module.exports = {
    validate
};

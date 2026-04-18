const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    PROTECTED_SECTION_CONTENTS,
    extractEntryKeySequence,
    extractSectionContentSequence,
    extractReferenceValues
} = require('./freeze_rules');
const { createAdapter, chunkTextsByChars } = require('./mt_adapter');

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

function inferTargetPath(sourcePath, lang) {
    const ext = path.extname(sourcePath);
    const dir = path.dirname(sourcePath);
    const base = path.basename(sourcePath, ext);
    const nextBase = base.replace(/_en$/i, `_${lang}`);
    return path.join(dir, `${nextBase}${ext}`);
}

function inferDraftJsonPath(sourcePath, lang) {
    const ext = path.extname(sourcePath);
    const dir = path.dirname(sourcePath);
    const base = path.basename(sourcePath, ext);
    const nextBase = base.replace(/_en$/i, `_${lang}`);
    return path.join(dir, `${nextBase}.draft.json`);
}

function buildSummary(xmlText) {
    return {
        entries: extractEntryKeySequence(xmlText).length,
        sections: extractSectionContentSequence(xmlText).length,
        references: extractReferenceValues(xmlText).length
    };
}

function loadPromptProfiles() {
    const filePath = path.join(__dirname, 'prompt_profiles.json');
    if (!fs.existsSync(filePath)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveSystemPrompt(args, profiles) {
    if (args['prompt-file']) {
        const promptPath = path.resolve(process.cwd(), args['prompt-file']);
        return fs.readFileSync(promptPath, 'utf8');
    }
    if (args['system-prompt']) {
        return String(args['system-prompt']);
    }
    const profileName = String(args['prompt-profile'] || 'default');
    if (profiles[profileName] && profiles[profileName].systemPrompt) {
        return profiles[profileName].systemPrompt;
    }
    if (profiles.default && profiles.default.systemPrompt) {
        return profiles.default.systemPrompt;
    }
    return 'Translate prose while preserving XML tags and protected tokens.';
}

function findEntryBlocks(xmlText) {
    return [...xmlText.matchAll(/<ThemLex_Entry\b[\s\S]*?<\/ThemLex_Entry>/g)].map((m) => m[0]);
}

const MNEMONIC_REFERENCE_PATTERN = /\b(?:[A-Z])?\d{14}\b/g;

function extractMnemonicTokens(text) {
    return String(text || '').match(MNEMONIC_REFERENCE_PATTERN) || [];
}

function protectMnemonicTokens(text) {
    const tokens = [];
    const protectedText = String(text || '').replace(MNEMONIC_REFERENCE_PATTERN, (match) => {
        const token = `__MNEMONIC_REF_${tokens.length}__`;
        tokens.push(match);
        return token;
    });
    return { protectedText, tokens };
}

function restoreMnemonicTokens(text, tokens) {
    let restored = String(text || '');
    (tokens || []).forEach((value, idx) => {
        const marker = `__MNEMONIC_REF_${idx}__`;
        restored = restored.split(marker).join(value);
    });
    return restored;
}

function extractInnerTagText(xml, tagName) {
    const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`));
    return match ? match[1].trim() : '';
}

function detectBlockType(tagName) {
    if (tagName === 'Title') return 'title';
    if (tagName === 'Heading') return 'heading';
    if (tagName === 'Reference') return 'reference';
    return 'paragraph';
}

function detectLockedState(sectionContent, tagName) {
    if (tagName === 'Reference') return true;
    return PROTECTED_SECTION_CONTENTS.has((sectionContent || '').trim().toLowerCase());
}

function computeSha256(text) {
    return `sha256:${crypto.createHash('sha256').update(text || '', 'utf8').digest('hex')}`;
}

function buildEntryDraftJson(entryXml, options) {
    const entryKey = extractEntryKey(entryXml);
    const blocks = [];
    let blockCounter = 1;

    const entryTitle = extractInnerTagText(entryXml, 'Title');
    if (entryTitle) {
        blocks.push({
            id: `blk-${String(blockCounter++).padStart(4, '0')}`,
            class: 'source-mapped',
            type: 'title',
            sourceTag: 'Title',
            sourceAnchor: {
                sectionId: 'entry',
                sourcePath: `ThemLex_Entry[Key='${entryKey}']/Title[1]`
            },
            content: {
                text: entryTitle
            },
            flags: {
                locked: false,
                protected: false
            },
            order: blocks.length + 1
        });
    }

    const sectionRegex = /<Section([^>]*)>([\s\S]*?)<\/Section>/g;
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(entryXml)) !== null) {
        const sectionAttrs = sectionMatch[1] || '';
        const sectionBody = sectionMatch[2] || '';
        const contentAttrMatch = sectionAttrs.match(/\bContent="([^"]*)"/i);
        const sectionContent = (contentAttrMatch ? contentAttrMatch[1] : 'other').trim().toLowerCase();

        const nodeRegex = /<(Heading|Paragraph|Reference)>([\s\S]*?)<\/\1>/g;
        let nodeMatch;
        const ordinalsByTag = {
            Heading: 0,
            Paragraph: 0,
            Reference: 0
        };
        while ((nodeMatch = nodeRegex.exec(sectionBody)) !== null) {
            const tagName = nodeMatch[1];
            ordinalsByTag[tagName] = (ordinalsByTag[tagName] || 0) + 1;
            const sectionOrdinal = ordinalsByTag[tagName];
            const rawText = (nodeMatch[2] || '').trim();
            if (!rawText) {
                continue;
            }

            const isLocked = detectLockedState(sectionContent, tagName);
            blocks.push({
                id: `blk-${String(blockCounter++).padStart(4, '0')}`,
                class: 'source-mapped',
                type: detectBlockType(tagName),
                sourceTag: tagName,
                sourceAnchor: {
                    sectionId: sectionContent || 'other',
                    sourcePath: `ThemLex_Entry[Key='${entryKey}']/Section[Content='${sectionContent}']/${tagName}[${sectionOrdinal}]`
                },
                content: {
                    text: rawText
                },
                flags: {
                    locked: isLocked,
                    protected: isLocked
                },
                order: blocks.length + 1
            });
        }
    }

    return {
        schemaVersion: '1.0',
        entryKey,
        source: {
            dictionary: options.dictionary,
            sourceLang: options.sourceLang,
            targetLang: options.targetLang,
            sourceHash: computeSha256(entryXml)
        },
        metadata: {
            updatedAt: new Date().toISOString(),
            updatedBy: options.updatedBy || 'system',
            status: 'draft'
        },
        blocks,
        operations: []
    };
}

function inferDictionaryName(sourcePath) {
    const stem = path.basename(sourcePath, path.extname(sourcePath));
    const match = stem.match(/^([A-Za-z0-9]+)/);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
}

function mapSourceXmlToDraftJson(sourceXml, options) {
    const entryBlocks = findEntryBlocks(sourceXml);
    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        sourceFile: options.sourceFile,
        sourceHash: computeSha256(sourceXml),
        sourceLang: options.sourceLang,
        targetLang: options.targetLang,
        dictionary: options.dictionary,
        entries: entryBlocks.map((entryXml) => buildEntryDraftJson(entryXml, options))
    };
}

function selectDraftEntryByKey(draftPayload, entryKey) {
    if (!draftPayload || !Array.isArray(draftPayload.entries)) {
        return null;
    }
    return draftPayload.entries.find((entry) => String(entry.entryKey) === String(entryKey)) || null;
}

function queueKey(sectionId, sourceTag) {
    return `${sectionId || 'other'}::${sourceTag}`;
}

function buildReplacementQueues(draftEntry) {
    const queues = new Map();
    const titleQueue = [];

    (draftEntry.blocks || [])
        .filter((b) => b && b.class === 'source-mapped')
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach((block) => {
            const tag = block.sourceTag || (block.type === 'title' ? 'Title' : block.type === 'heading' ? 'Heading' : 'Paragraph');
            const text = (block.content && typeof block.content.text === 'string') ? block.content.text : '';
            if (tag === 'Title') {
                titleQueue.push(text);
                return;
            }
            const sectionId = block.sourceAnchor && block.sourceAnchor.sectionId
                ? String(block.sourceAnchor.sectionId).toLowerCase()
                : 'other';
            const key = queueKey(sectionId, tag);
            if (!queues.has(key)) {
                queues.set(key, []);
            }
            queues.get(key).push(text);
        });

    return { titleQueue, queues };
}

function serializeDraftEntryToXml(sourceEntryXml, draftEntry) {
    if (!draftEntry) {
        return sourceEntryXml;
    }

    const { titleQueue, queues } = buildReplacementQueues(draftEntry);
    let entryXml = sourceEntryXml;

    if (titleQueue.length > 0) {
        entryXml = replaceTagInnerText(entryXml, 'Title', (inner) => {
            return titleQueue.length > 0 ? titleQueue.shift() : inner;
        });
    }

    entryXml = entryXml.replace(/<Section([^>]*)>([\s\S]*?)<\/Section>/g, (full, attrs, body) => {
        const contentAttrMatch = (attrs || '').match(/\bContent="([^"]*)"/i);
        const sectionContent = (contentAttrMatch ? contentAttrMatch[1] : 'other').trim().toLowerCase();
        let nextBody = body;

        ['Heading', 'Paragraph', 'Reference'].forEach((tagName) => {
            const q = queues.get(queueKey(sectionContent, tagName));
            if (!q || q.length === 0) {
                return;
            }
            nextBody = replaceTagInnerText(nextBody, tagName, (inner) => {
                return q.length > 0 ? q.shift() : inner;
            });
        });

        return `<Section${attrs}>${nextBody}</Section>`;
    });

    return entryXml;
}

function serializeDraftJsonToXml(sourceXml, draftPayload) {
    const sourceEntries = findEntryBlocks(sourceXml);
    const draftEntries = new Map((draftPayload.entries || []).map((entry) => [String(entry.entryKey), entry]));

    let targetXml = sourceXml;
    let entriesSerialized = 0;
    let missingDraftEntries = 0;

    sourceEntries.forEach((entryXml) => {
        const key = extractEntryKey(entryXml);
        const draftEntry = draftEntries.get(String(key));
        if (!draftEntry) {
            missingDraftEntries += 1;
            return;
        }
        const updatedEntry = serializeDraftEntryToXml(entryXml, draftEntry);
        targetXml = targetXml.replace(entryXml, updatedEntry);
        entriesSerialized += 1;
    });

    return {
        targetXml,
        report: {
            entriesSerialized,
            missingDraftEntries,
            draftEntries: draftEntries.size
        }
    };
}

function extractEntryKey(entryXml) {
    const match = entryXml.match(/<ThemLex_Entry[^>]*\bKey="([^"]+)"/);
    return match ? match[1] : 'unknown';
}

function replaceTagInnerText(xmlText, tagName, replacer) {
    const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'g');
    return xmlText.replace(pattern, (_, inner) => `<${tagName}>${replacer(inner)}</${tagName}>`);
}

function buildSnippetManifestFromEntry(entryXml) {
    const snippets = [];
    let nextId = 0;

    // Entry title is translatable by default.
    const titleMatch = entryXml.match(/<Title>([\s\S]*?)<\/Title>/);
    if (titleMatch) {
        snippets.push({
            id: nextId++,
            type: 'title',
            sectionContent: null,
            original: titleMatch[1]
        });
    }

    const sectionRegex = /<Section([^>]*)>([\s\S]*?)<\/Section>/g;
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(entryXml)) !== null) {
        const sectionAttrs = sectionMatch[1] || '';
        const sectionBody = sectionMatch[2] || '';
        const contentAttrMatch = sectionAttrs.match(/\bContent="([^"]*)"/i);
        const contentValue = (contentAttrMatch ? contentAttrMatch[1] : 'other').trim().toLowerCase();

        if (PROTECTED_SECTION_CONTENTS.has(contentValue)) {
            continue;
        }

        const headingMatches = [...sectionBody.matchAll(/<Heading>([\s\S]*?)<\/Heading>/g)].map((m) => m[1]);
        const paragraphMatches = [...sectionBody.matchAll(/<Paragraph>([\s\S]*?)<\/Paragraph>/g)].map((m) => m[1]);

        headingMatches.forEach((text) => {
            snippets.push({
                id: nextId++,
                type: 'heading',
                sectionContent: contentValue,
                original: text
            });
        });

        paragraphMatches.forEach((text) => {
            snippets.push({
                id: nextId++,
                type: 'paragraph',
                sectionContent: contentValue,
                original: text
            });
        });
    }

    return snippets;
}

function applyEntryTranslations(entryXml, snippets, translations) {
    const queueByType = {
        title: [],
        heading: [],
        paragraph: []
    };

    snippets.forEach((s, idx) => {
        const translated = typeof translations[idx] === 'string' ? translations[idx] : s.original;
        queueByType[s.type].push(translated);
    });

    let nextEntry = entryXml;

    nextEntry = replaceTagInnerText(nextEntry, 'Title', () => {
        return queueByType.title.length > 0 ? queueByType.title.shift() : '';
    });

    // Apply heading and paragraph replacements section by section, skipping protected sections.
    nextEntry = nextEntry.replace(/<Section([^>]*)>([\s\S]*?)<\/Section>/g, (full, attrs, body) => {
        const contentAttrMatch = (attrs || '').match(/\bContent="([^"]*)"/i);
        const contentValue = (contentAttrMatch ? contentAttrMatch[1] : 'other').trim().toLowerCase();
        if (PROTECTED_SECTION_CONTENTS.has(contentValue)) {
            return full;
        }

        let nextBody = body;
        nextBody = replaceTagInnerText(nextBody, 'Heading', () => {
            return queueByType.heading.length > 0 ? queueByType.heading.shift() : '';
        });
        nextBody = replaceTagInnerText(nextBody, 'Paragraph', () => {
            return queueByType.paragraph.length > 0 ? queueByType.paragraph.shift() : '';
        });
        return `<Section${attrs}>${nextBody}</Section>`;
    });

    return nextEntry;
}

async function translateEntryWithFallback(entryXml, adapter, context, maxEntryChars, fallbackChunkChars) {
    const snippets = buildSnippetManifestFromEntry(entryXml);
    if (snippets.length === 0) {
        return {
            translatedEntry: entryXml,
            stats: { snippetCount: 0, fallbackUsed: false }
        };
    }

    const originals = snippets.map((s) => s.original);
    const protectedOriginals = originals.map((text) => protectMnemonicTokens(text));
    const sourceProtectedTexts = protectedOriginals.map((item) => item.protectedText);
    const totalChars = sourceProtectedTexts.reduce((sum, t) => sum + (t || '').length, 0);

    let translated = [];
    let fallbackUsed = false;

    if (totalChars <= maxEntryChars) {
        translated = await adapter.translateBatch(sourceProtectedTexts, context);
    } else {
        fallbackUsed = true;
        const chunks = chunkTextsByChars(sourceProtectedTexts, fallbackChunkChars);
        let cursor = 0;
        for (const chunk of chunks) {
            const out = await adapter.translateBatch(chunk, context);
            translated.push(...out);
            cursor += chunk.length;
        }
        if (translated.length !== sourceProtectedTexts.length) {
            translated = sourceProtectedTexts;
        }
    }

    translated = translated.map((text, idx) => {
        const restored = restoreMnemonicTokens(text, protectedOriginals[idx].tokens);
        const srcTokens = extractMnemonicTokens(originals[idx]);
        const outTokens = extractMnemonicTokens(restored);
        if (srcTokens.length !== outTokens.length || srcTokens.some((token, i) => token !== outTokens[i])) {
            return originals[idx];
        }
        return restored;
    });

    const translatedEntry = applyEntryTranslations(entryXml, snippets, translated);
    return {
        translatedEntry,
        stats: {
            snippetCount: snippets.length,
            fallbackUsed
        }
    };
}

async function runDraftTranslation(sourceXml, options) {
    const entryBlocks = findEntryBlocks(sourceXml);
    if (entryBlocks.length === 0) {
        return {
            targetXml: sourceXml,
            report: {
                entriesProcessed: 0,
                entriesWithFallback: 0,
                snippetsTranslated: 0
            }
        };
    }

    const adapter = createAdapter({
        provider: options.provider,
        model: options.model,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        systemPrompt: options.systemPrompt,
        maxBatchChars: options.maxBatchChars,
        retries: options.retries
    });

    let entriesWithFallback = 0;
    let snippetsTranslated = 0;
    const replacements = [];

    for (const entryBlock of entryBlocks) {
        const entryKey = extractEntryKey(entryBlock);
        const { translatedEntry, stats } = await translateEntryWithFallback(
            entryBlock,
            adapter,
            {
                targetLang: options.lang,
                systemPrompt: options.systemPrompt,
                entryKey
            },
            options.maxEntryChars,
            options.fallbackChunkChars
        );
        if (stats.fallbackUsed) {
            entriesWithFallback += 1;
        }
        snippetsTranslated += stats.snippetCount;
        replacements.push({ from: entryBlock, to: translatedEntry });
    }

    let targetXml = sourceXml;
    replacements.forEach(({ from, to }) => {
        targetXml = targetXml.replace(from, to);
    });

    return {
        targetXml,
        report: {
            entriesProcessed: entryBlocks.length,
            entriesWithFallback,
            snippetsTranslated
        }
    };
}

async function main() {
    const args = parseArgs(process.argv);
    const sourceArg = args.src;
    const lang = (args.lang || 'xx').toLowerCase();
    const mode = (args.mode || 'skeleton').toLowerCase();
    const dryRun = Boolean(args['dry-run']);
    const provider = (args.provider || 'passthrough').toLowerCase();
    const maxEntryChars = Number(args['max-entry-chars'] || 12000);
    const fallbackChunkChars = Number(args['fallback-chunk-chars'] || 6000);
    const maxBatchChars = Number(args['max-batch-chars'] || 12000);
    const retries = Number(args.retries || 2);
    const emitDraftJson = Boolean(args['emit-draft-json']);
    const draftJsonScope = String(args['draft-json-scope'] || 'batch').toLowerCase();

    if (!sourceArg) {
        console.error('Usage: node scripts/translation/translate_entries.js --src <source.xml> --lang <code> [--out <target.xml>] [--mode skeleton|draft|roundtrip] [--provider passthrough|mock|openai-compatible] [--prompt-profile default] [--emit-draft-json] [--draft-json-scope batch|entry] [--entry-key <key>] [--draft-json-in <file.json>] [--draft-json-out <file.json>] [--dry-run]');
        process.exit(2);
    }

    const sourcePath = path.resolve(process.cwd(), sourceArg);
    if (!fs.existsSync(sourcePath)) {
        console.error(`Source file not found: ${sourcePath}`);
        process.exit(2);
    }

    const outPath = args.out
        ? path.resolve(process.cwd(), args.out)
        : inferTargetPath(sourcePath, lang);

    const sourceXml = fs.readFileSync(sourcePath, 'utf8');
    const profiles = loadPromptProfiles();
    const systemPrompt = resolveSystemPrompt(args, profiles);
    const draftJsonOutPath = args['draft-json-out']
        ? path.resolve(process.cwd(), args['draft-json-out'])
        : inferDraftJsonPath(sourcePath, lang);
    const sourceLang = (args['source-lang'] || 'en').toLowerCase();
    const dictionary = inferDictionaryName(sourcePath);

    let targetXml = sourceXml;
    let translationReport = {
        entriesProcessed: 0,
        entriesWithFallback: 0,
        snippetsTranslated: 0
    };
    let roundtripReport = null;

    if (mode === 'draft') {
        const draftResult = await runDraftTranslation(sourceXml, {
            provider,
            model: args.model,
            apiKey: args['api-key'],
            baseUrl: args['base-url'],
            lang,
            systemPrompt,
            maxEntryChars,
            fallbackChunkChars,
            maxBatchChars,
            retries
        });
        targetXml = draftResult.targetXml;
        translationReport = draftResult.report;
    } else if (mode === 'roundtrip') {
        let inputDraft = null;
        if (args['draft-json-in']) {
            const inPath = path.resolve(process.cwd(), args['draft-json-in']);
            if (!fs.existsSync(inPath)) {
                throw new Error(`Draft JSON file not found: ${inPath}`);
            }
            inputDraft = JSON.parse(fs.readFileSync(inPath, 'utf8'));
        } else {
            inputDraft = mapSourceXmlToDraftJson(sourceXml, {
                sourceFile: sourcePath,
                sourceLang,
                targetLang: lang,
                dictionary,
                updatedBy: args['updated-by'] || 'system'
            });
        }
        const roundtrip = serializeDraftJsonToXml(sourceXml, inputDraft);
        targetXml = roundtrip.targetXml;
        roundtripReport = roundtrip.report;
    }

    const draftJsonPayload = mapSourceXmlToDraftJson(targetXml, {
        sourceFile: sourcePath,
        sourceLang,
        targetLang: lang,
        dictionary,
        updatedBy: args['updated-by'] || 'system'
    });

    if (!dryRun) {
        fs.writeFileSync(outPath, targetXml, 'utf8');
        if (emitDraftJson) {
            let draftToWrite = draftJsonPayload;
            if (draftJsonScope === 'entry') {
                const requestedEntryKey = args['entry-key'] || draftJsonPayload.entries[0]?.entryKey;
                const selectedEntry = selectDraftEntryByKey(draftJsonPayload, requestedEntryKey);
                if (!selectedEntry) {
                    throw new Error(`Could not find entry key for draft-json-scope=entry: ${requestedEntryKey}`);
                }
                draftToWrite = selectedEntry;
            }
            fs.writeFileSync(draftJsonOutPath, JSON.stringify(draftToWrite, null, 2), 'utf8');
        }
    }

    const summary = buildSummary(sourceXml);
    const targetSummary = buildSummary(targetXml);
    console.log(JSON.stringify({
        mode,
        dryRun,
        provider,
        source: sourcePath,
        target: outPath,
        language: lang,
        summary,
        targetSummary,
        translationReport,
        roundtripReport,
        promptProfile: args['prompt-profile'] || 'default',
        draftJson: {
            emitted: emitDraftJson && !dryRun,
            path: emitDraftJson ? draftJsonOutPath : null,
            scope: draftJsonScope,
            selectedEntryKey: draftJsonScope === 'entry' ? (args['entry-key'] || draftJsonPayload.entries[0]?.entryKey || null) : null,
            entries: draftJsonPayload.entries.length
        }
    }, null, 2));
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err && err.stack ? err.stack : String(err));
        process.exit(1);
    });
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
    PROTECTED_TAGS,
    PROTECTED_ATTRIBUTE_NAMES,
    extractMnemonicReferences,
    extractSectionContentSequence,
    extractEntryKeySequence,
    extractReferenceValues,
    extractAttributeValues
} = require('./freeze_rules');

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

function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function multisetSignature(values) {
    const counts = new Map();
    values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const sorted = [...counts.entries()].sort((a, b) => {
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
    });
    return sha256(JSON.stringify(sorted));
}

function countOpenClose(xmlText, tagName) {
    const open = (xmlText.match(new RegExp(`<${tagName}\\b`, 'g')) || []).length;
    const close = (xmlText.match(new RegExp(`</${tagName}>`, 'g')) || []).length;
    const selfClosing = (xmlText.match(new RegExp(`<${tagName}\\b[^>]*/>`, 'g')) || []).length;
    return {
        open,
        close,
        selfClosing,
        effectiveOpen: open - selfClosing
    };
}

function collectProtectedTagSignatures(xmlText) {
    const signatures = {};
    for (const tag of PROTECTED_TAGS) {
        const fullTagPattern = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'g');
        const selfClosingPattern = new RegExp(`<${tag}\\b[^>]*/>`, 'g');
        const blocks = [
            ...(xmlText.match(fullTagPattern) || []),
            ...(xmlText.match(selfClosingPattern) || [])
        ].map((b) => b.trim());

        signatures[tag] = {
            count: blocks.length,
            hash: multisetSignature(blocks)
        };
    }
    return signatures;
}

function validate(srcXml, tgtXml) {
    const errors = [];
    const warnings = [];

    if (!srcXml.includes('<Thematic_Lexicon') || !tgtXml.includes('<Thematic_Lexicon')) {
        errors.push('Missing <Thematic_Lexicon> root element in source or target.');
    }

    const sourceEntryKeys = extractEntryKeySequence(srcXml);
    const targetEntryKeys = extractEntryKeySequence(tgtXml);
    if (JSON.stringify(sourceEntryKeys) !== JSON.stringify(targetEntryKeys)) {
        errors.push('Entry key sequence mismatch (ThemLex_Entry@Key changed or reordered).');
    }

    const sourceSectionSequence = extractSectionContentSequence(srcXml);
    const targetSectionSequence = extractSectionContentSequence(tgtXml);
    if (JSON.stringify(sourceSectionSequence) !== JSON.stringify(targetSectionSequence)) {
        errors.push('Section Content sequence mismatch (Section@Content changed or reordered).');
    }

    const sourceRefs = extractReferenceValues(srcXml);
    const targetRefs = extractReferenceValues(tgtXml);
    if (JSON.stringify(sourceRefs) !== JSON.stringify(targetRefs)) {
        errors.push('Reference value mismatch (<Reference> values changed).');
    }

    const srcMnemonic = extractMnemonicReferences(srcXml);
    const tgtMnemonic = extractMnemonicReferences(tgtXml);
    if (JSON.stringify(srcMnemonic) !== JSON.stringify(tgtMnemonic)) {
        errors.push('14-digit mnemonic references changed.');
    }

    for (const attrName of PROTECTED_ATTRIBUTE_NAMES) {
        const srcAttr = extractAttributeValues(srcXml, attrName);
        const tgtAttr = extractAttributeValues(tgtXml, attrName);
        if (JSON.stringify(srcAttr) !== JSON.stringify(tgtAttr)) {
            errors.push(`Protected attribute mismatch for ${attrName}.`);
        }
    }

    const srcTagSignatures = collectProtectedTagSignatures(srcXml);
    const tgtTagSignatures = collectProtectedTagSignatures(tgtXml);
    for (const tag of PROTECTED_TAGS) {
        const srcSig = srcTagSignatures[tag];
        const tgtSig = tgtTagSignatures[tag];
        if (srcSig.count !== tgtSig.count || srcSig.hash !== tgtSig.hash) {
            errors.push(`Protected tag payload changed for <${tag}>.`);
        }
    }

    const requiredPairs = ['Thematic_Lexicon', 'ThemLex_Entry', 'Title', 'Sections', 'Section', 'Paragraphs', 'Paragraph'];
    for (const tag of requiredPairs) {
        const srcCount = countOpenClose(srcXml, tag);
        const tgtCount = countOpenClose(tgtXml, tag);
        if (srcCount.effectiveOpen !== srcCount.close) {
            warnings.push(`Source may be malformed around <${tag}> (open ${srcCount.open}, self-closing ${srcCount.selfClosing}, close ${srcCount.close}).`);
        }
        if (tgtCount.effectiveOpen !== tgtCount.close) {
            warnings.push(`Target may be malformed around <${tag}> (open ${tgtCount.open}, self-closing ${tgtCount.selfClosing}, close ${tgtCount.close}).`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        metrics: {
            sourceEntries: sourceEntryKeys.length,
            targetEntries: targetEntryKeys.length,
            sourceReferences: sourceRefs.length,
            targetReferences: targetRefs.length,
            sourceMnemonicRefs: srcMnemonic.length,
            targetMnemonicRefs: tgtMnemonic.length
        }
    };
}

function main() {
    const args = parseArgs(process.argv);
    const srcPath = args.src ? path.resolve(process.cwd(), args.src) : null;
    const tgtPath = args.tgt ? path.resolve(process.cwd(), args.tgt) : null;

    if (!srcPath || !tgtPath) {
        console.error('Usage: node scripts/translation/validate_deterministic.js --src <source.xml> --tgt <target.xml>');
        process.exit(2);
    }

    if (!fs.existsSync(srcPath) || !fs.existsSync(tgtPath)) {
        console.error('Source or target file does not exist.');
        process.exit(2);
    }

    const srcXml = fs.readFileSync(srcPath, 'utf8');
    const tgtXml = fs.readFileSync(tgtPath, 'utf8');

    const report = validate(srcXml, tgtXml);

    console.log(JSON.stringify(report, null, 2));

    if (!report.valid) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    validate
};

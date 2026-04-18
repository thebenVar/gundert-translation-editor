const PROTECTED_SECTION_CONTENTS = new Set([
    'reference',
    'references'
]);

const PROTECTED_TAGS = new Set([
    'Reference',
    'Lemma',
    'Transliteration',
    'LanguageSet',
    'LanguageSets',
    'BibleImage',
    'BibleImages',
    'Collection',
    'Path',
    'FileName',
    'Copyright',
    'Definition',
    'Caption'
]);

const PROTECTED_ATTRIBUTE_NAMES = new Set([
    'Key',
    'Content',
    'target',
    'Id',
    'Language'
]);

const MNEMONIC_REFERENCE_PATTERN = /\b\d{14}\b/g;

function extractMnemonicReferences(xmlText) {
    return (xmlText.match(MNEMONIC_REFERENCE_PATTERN) || []).map((r) => r.trim());
}

function extractSectionContentSequence(xmlText) {
    return [...xmlText.matchAll(/<Section[^>]*Content="([^"]*)"/g)].map((m) => (m[1] || '').trim().toLowerCase());
}

function extractEntryKeySequence(xmlText) {
    return [...xmlText.matchAll(/<ThemLex_Entry[^>]*Key="([^"]+)"/g)].map((m) => m[1].trim());
}

function extractReferenceValues(xmlText) {
    return [...xmlText.matchAll(/<Reference>([^<]+)<\/Reference>/g)].map((m) => m[1].trim());
}

function extractAttributeValues(xmlText, attrName) {
    const pattern = new RegExp(`\\b${attrName}="([^"]*)"`, 'g');
    return [...xmlText.matchAll(pattern)].map((m) => m[1].trim());
}

module.exports = {
    PROTECTED_SECTION_CONTENTS,
    PROTECTED_TAGS,
    PROTECTED_ATTRIBUTE_NAMES,
    MNEMONIC_REFERENCE_PATTERN,
    extractMnemonicReferences,
    extractSectionContentSequence,
    extractEntryKeySequence,
    extractReferenceValues,
    extractAttributeValues
};

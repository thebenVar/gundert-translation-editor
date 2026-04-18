const fs = require('fs');
const path = require('path');

const dictionaries = [
    { baseName: 'FAUNA', category: 'Fauna', color: '#3498db' },
    { baseName: 'FLORA', category: 'Flora', color: '#2ecc71' },
    { baseName: 'REALIA', category: 'Realia', color: '#9b59b6' }
];

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

function resolveXmlPath(baseName, lang) {
    const requested = path.join(__dirname, '..', 'data', 'xml', `${baseName}_${lang}.xml`);
    if (fs.existsSync(requested)) {
        return { xmlPath: requested, resolvedLang: lang, usedFallback: false };
    }

    const fallback = path.join(__dirname, '..', 'data', 'xml', `${baseName}_en.xml`);
    if (fs.existsSync(fallback)) {
        return { xmlPath: fallback, resolvedLang: 'en', usedFallback: true };
    }

    return { xmlPath: null, resolvedLang: null, usedFallback: false };
}

// USFM Book Map (BBB part of 14-digit ref)
const BOOK_MAP = {
    "001": "GEN", "002": "EXO", "003": "LEV", "004": "NUM", "005": "DEU", "006": "JOS", "007": "JDG", "008": "RUT", "009": "1SA",
    "010": "2SA", "011": "1KI", "012": "2KI", "013": "1CH", "014": "2CH", "015": "EZR", "016": "NEH", "017": "EST", "018": "JOB",
    "019": "PSA", "020": "PRO", "021": "ECC", "022": "SNG", "023": "ISA", "024": "JER", "025": "LAM", "026": "EZK", "027": "DAN",
    "028": "HOS", "029": "JOE", "030": "AMO", "031": "OBA", "032": "JON", "033": "MIC", "034": "NAM", "035": "HAB", "036": "ZEP",
    "037": "HAG", "038": "ZEC", "039": "MAL",
    "040": "MAT", "041": "MRK", "042": "LUK", "043": "JHN", "044": "ACT", "045": "ROM", "046": "1CO", "047": "2CO", "048": "GAL",
    "049": "EPH", "050": "PHP", "051": "COL", "052": "1TH", "053": "2TH", "054": "1TI", "055": "2TI", "056": "TIT", "057": "PHM",
    "058": "HEB", "059": "JAS", "060": "1PE", "061": "2PE", "062": "1JN", "063": "2JN", "064": "3JN", "065": "JUD", "066": "REV",
    // Deutero/Apocrypha (guessing based on common UBS schemes if needed)
    "067": "TOB", "068": "JDT", "070": "WIS", "071": "SIR", "072": "BAR", "077": "1MA", "078": "2MA", "079": "3MA", "080": "4MA",
    "081": "1ES", "082": "2ES"
};

function decodeRef(ref) {
    if (!ref || ref.length < 9) return ref;
    const b = ref.substring(0, 3);
    const c = parseInt(ref.substring(3, 6));
    const v = parseInt(ref.substring(6, 9));
    const book = BOOK_MAP[b] || b;
    return `${book} ${c}:${v}`;
}

function decodeRefWithPosition(ref) {
    if (!ref || ref.length !== 14) return ref;
    const display = decodeRef(ref);
    const position = ref.substring(9);
    return `${display}_{${position}}`;
}

const analyze = (options) => {
    const requestedLang = (options.lang || 'en').toLowerCase();
    const masterStats = { totalEntries: 0, totalWords: 0, totalImages: 0, dictionaries: [] };
    const allEntries = [];
    const languageResolution = [];

    dictionaries.forEach(dictInfo => {
        const resolved = resolveXmlPath(dictInfo.baseName, requestedLang);
        if (!resolved.xmlPath) return;

        const xmlPath = resolved.xmlPath;
        languageResolution.push({
            dictionary: dictInfo.baseName,
            requestedLang,
            resolvedLang: resolved.resolvedLang,
            usedFallback: resolved.usedFallback,
            path: path.relative(path.join(__dirname, '..'), xmlPath)
        });

        const xmlContent = fs.readFileSync(xmlPath, 'utf8');
        const imageCount = (xmlContent.match(/<Image/g) || []).length;
        
        // --- Hierarchy Analysis ---
        const chapters = [];
        let currentChapter = null;
        let dictWords = 0;
        let dictEntries = 0;

        const entryBlocks = xmlContent.split('<ThemLex_Entry');
        
        entryBlocks.forEach(block => {
            const keyMatch = block.match(/Key="([^"]+)"/);
            const titleMatch = block.match(/<Title>([^<]+)<\/Title>/);
            if (!keyMatch || !titleMatch) return;

            const key = keyMatch[1];
            const title = titleMatch[1];
            if (key === '0' || key === '0.1') return;

            // Process content into Sense-like sections
            const sections = [];
            const sectionRegex = /<Section[^>]*Content="([^"]*)"[^>]*>([\s\S]*?)<\/Section>/g;
            let sMatch;
            while ((sMatch = sectionRegex.exec(block)) !== null) {
                const type = sMatch[1] || 'other';
                let sBody = sMatch[2];

                // Preserve full mnemonic references; expose readable form as metadata only.
                sBody = sBody.replace(
                    /<s>(\d{14})<\/s>/g,
                    (m, r) => `<span class="ref-link" data-usfm="${decodeRefWithPosition(r)}" title="${decodeRefWithPosition(r)}">${r}</span>`
                );
                sBody = sBody.replace(
                    /<Reference>(\d{14})<\/Reference>/g,
                    (m, r) => `<span class="ref-link" data-usfm="${decodeRefWithPosition(r)}" title="${decodeRefWithPosition(r)}">${r}</span>`
                );

                // Basic HTML cleanup
                sBody = sBody.replace(/<Paragraph>/g, '<p>').replace(/<\/Paragraph>/g, '</p>')
                             .replace(/<Heading>/g, '<h4>').replace(/<\/Heading>/g, '</h4>')
                             .replace(/<Image Id="([^"]*)"\/>/g, '<div class="image-box">Image: $1</div>')
                             .replace(/<LanguageSet Language="([^"]*)">/g, '<div class="lang-set"><strong>$1</strong>')
                             .replace(/<\/LanguageSet>/g, '</div>')
                             .replace(/<Lemma>/g, '<em>').replace(/<\/Lemma>/g, '</em> ')
                             .replace(/<Transliteration>/g, '[').replace(/<\/Transliteration>/g, '] ')
                             .replace(/<References>/g, '<div class="ref-list">').replace(/<\/References>/g, '</div>');

                sections.push({ type, html: sBody });
            }

            const textOnly = block.replace(/<[^>]*>/g, ' ').trim();
            const words = textOnly.split(/\s+/).filter(w => w.length > 0).length;

            const entryObj = {
                key, title, category: dictInfo.category,
                content: sections.map(s =>
                    `<div class="section-box"><div class="section-label">${s.type}</div>${s.html}</div>`
                ).join('\n'),
                sections, wordCount: words,
                chapterKey: key.split('.')[0],
                sourceLang: resolved.resolvedLang,
                requestedLang,
                sourceDictionary: dictInfo.baseName
            };
            allEntries.push(entryObj);

            // Hierarchy
            const parts = key.split('.');
            if (parts.length === 1) {
                currentChapter = { key, title, words: 0, subs: [] };
                chapters.push(currentChapter);
            } else if (parts.length === 2 && currentChapter) {
                currentChapter.subs.push({ key, title, words });
                currentChapter.words += words;
                dictEntries++;
            } else if (currentChapter) {
                currentChapter.words += words;
                dictEntries++;
            }
            dictWords += words;
        });

        masterStats.dictionaries.push({
            category: dictInfo.category,
            color: dictInfo.color,
            sourceDictionary: dictInfo.baseName,
            sourceLang: resolved.resolvedLang,
            totalWords: dictWords,
            totalEntries: dictEntries,
            chapters: chapters
        });
        masterStats.totalWords += dictWords;
        masterStats.totalEntries += dictEntries;
    });

    masterStats.requestedLang = requestedLang;
    masterStats.languageResolution = languageResolution;

    fs.writeFileSync(path.join(__dirname, '..', 'data', 'stats.json'), JSON.stringify(masterStats, null, 2));
    fs.writeFileSync(
        path.join(__dirname, '..', 'data', 'entries.js'),
        `const ALL_ENTRIES = ${JSON.stringify(allEntries, null, 2)};\n` +
        `const ALL_DICTIONARY_ENTRIES = ALL_ENTRIES;\n` +
        `const MASTER_STATS = ${JSON.stringify(masterStats, null, 2)};\n` +
        `if (typeof window !== 'undefined') {\n` +
        `  window.ALL_ENTRIES = ALL_ENTRIES;\n` +
        `  window.ALL_DICTIONARY_ENTRIES = ALL_DICTIONARY_ENTRIES;\n` +
        `  window.MASTER_STATS = MASTER_STATS;\n` +
        `}`
    );
    console.log(`Processed all entries with mnemonic refs preserved and hierarchy (requested lang: ${requestedLang}).`);
};

const args = parseArgs(process.argv);
analyze({
    lang: args.lang || 'en'
});

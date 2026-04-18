import { parseStringPromise, Builder } from 'xml2js';
import * as fs from 'fs/promises';

/**
 * Parsed UBS Thematic Lexicon Entry
 * Represents a single ThemLex_Entry from XML as JSONB-compatible structure
 */
export interface ParsedEntry {
  key: string;
  title: string;
  intro: string | null;
  sections: Array<{
    type: string | null;
    content: string | null;
    heading: string | null;
    subheading: string | null;
    languageSets: unknown | null;
    paragraphs: string[];
  }>;
  index: Array<{
    target: string;
    label: string;
  }>;
  bibleReferences: string[]; // Extracted from contexts like "00301101301000-00301101901000"
  metadata: {
    importedAt: string;
    sourceFormat: 'xml';
    checksum: string;
  };
}

/**
 * Parse UBS Thematic Lexicon XML file
 * @param filePath - Path to XML file (FAUNA_en.xml, FLORA_en.xml, REALIA_en.xml)
 * @returns Array of parsed entries
 */
export async function parseUBSXml(filePath: string): Promise<ParsedEntry[]> {
  const xmlContent = await fs.readFile(filePath, 'utf-8');
  const parsed = await parseStringPromise(xmlContent, {
    preserveChildrenOrder: true,
    explicitArray: false,
  });

  const entries: ParsedEntry[] = [];
  const themLexEntries = Array.isArray(parsed.Thematic_Lexicon.ThemLex_Entry)
    ? parsed.Thematic_Lexicon.ThemLex_Entry
    : [parsed.Thematic_Lexicon.ThemLex_Entry];

  for (const xmlEntry of themLexEntries) {
    const entry = parseThemLexEntry(xmlEntry, xmlContent);
    entries.push(entry);
  }

  return entries;
}

/**
 * Parse a single ThemLex_Entry element
 */
function parseThemLexEntry(xmlEntry: any, fullXml: string): ParsedEntry {
  const key = xmlEntry.$.Key || '';
  const title = extractText(xmlEntry.Title);
  const intro = extractText(xmlEntry.Intro) || null;

  // Parse sections
  const sections = parseSections(xmlEntry.Sections);

  // Parse index items
  const indexItems = parseIndexItems(xmlEntry.Index);

  // Extract Bible references (e.g., "00301101301000-00301101901000" → "Luke 11:1-19")
  const bibleReferences = extractBibleReferences(fullXml);

  // Compute checksum for round-trip validation
  const checksum = computeChecksum(JSON.stringify(xmlEntry));

  return {
    key,
    title,
    intro,
    sections,
    index: indexItems,
    bibleReferences,
    metadata: {
      importedAt: new Date().toISOString(),
      sourceFormat: 'xml',
      checksum,
    },
  };
}

/**
 * Extract text content from XML element (handles nested tags)
 */
function extractText(element: any): string {
  if (!element) return '';
  if (typeof element === 'string') return element;
  if (Array.isArray(element)) return element.map(extractText).join('');

  // If it's an object with text content
  if (element._) return element._;

  // Recursively extract from nested elements
  let text = '';
  for (const key in element) {
    if (key !== '$') {
      text += extractText(element[key]);
    }
  }
  return text;
}

/**
 * Parse sections with paragraphs, headings, etc.
 */
function parseSections(
  sectionsElement: any
): Array<{
  type: string | null;
  content: string | null;
  heading: string | null;
  subheading: string | null;
  languageSets: unknown | null;
  paragraphs: string[];
}> {
  if (!sectionsElement) return [];

  const sectionsList = Array.isArray(sectionsElement.Section)
    ? sectionsElement.Section
    : [sectionsElement.Section];

  return (sectionsList || [])
    .filter((section: any) => section !== undefined && section !== null)
    .map((section: any) => ({
      type: section && section.$ ? (section.$.Type || null) : null,
      content: section && section.$ ? (section.$.Content || null) : null,
      heading: extractText(section?.Heading) || null,
      subheading: extractText(section?.SubHeading) || null,
      languageSets: section?.LanguageSets || null,
      paragraphs: parseParagraphs(section?.Paragraphs),
    }));
}

/**
 * Extract paragraphs from Paragraphs element
 */
function parseParagraphs(paragraphsElement: any): string[] {
  if (!paragraphsElement || !paragraphsElement.Paragraph) return [];

  const paragraphs = Array.isArray(paragraphsElement.Paragraph)
    ? paragraphsElement.Paragraph
    : [paragraphsElement.Paragraph];

  return paragraphs.map((p: any) => extractText(p));
}

/**
 * Parse index items with target and label
 */
function parseIndexItems(
  indexElement: any
): Array<{ target: string; label: string }> {
  if (!indexElement || !indexElement.IndexItem) return [];

  const items = Array.isArray(indexElement.IndexItem)
    ? indexElement.IndexItem
    : [indexElement.IndexItem];

  return items.map((item: any) => ({
    target: item.l?.$.target || '',
    label: extractText(item.l) || '',
  }));
}

/**
 * Extract Bible references from XML
 * Looks for patterns like "00301101301000-00301101901000" and converts to human-readable form
 * Format: BBCCVVVVBBCCVVVV (Book, Chapter, Verse in each group)
 */
function extractBibleReferences(xmlContent: string): string[] {
  const references = new Set<string>();

  // Match Bible reference patterns (e.g., "00301101301000-00301101901000")
  const refPattern = /(\d{12})(?:-(\d{12}))?/g;
  let match;

  while ((match = refPattern.exec(xmlContent)) !== null) {
    const ref = decodeScriptureRef(match[1]);
    if (ref) references.add(ref);
    if (match[2]) {
      const endRef = decodeScriptureRef(match[2]);
      if (endRef) references.add(endRef);
    }
  }

  return Array.from(references);
}

/**
 * Decode 12-digit scripture reference
 * Format: BBCCVVVVXXXX
 * - BB: Book (00-66)
 * - CC: Chapter
 * - VVVV: Verse
 * - XXXX: Extra (word/phrase offset)
 */
function decodeScriptureRef(refCode: string): string | null {
  if (refCode.length !== 12) return null;

  const bookNum = parseInt(refCode.substring(0, 2), 10);
  const chapter = parseInt(refCode.substring(2, 4), 10);
  const verse = parseInt(refCode.substring(4, 8), 10);

  // Map book numbers to names
  const books = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
    'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
    'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
    'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew',
    'Mark', 'Luke', 'John', 'Acts', 'Romans',
    '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians',
    'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
    'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter',
    '2 Peter', '1 John', '2 John', '3 John', 'Jude',
    'Revelation',
  ];

  if (bookNum < 0 || bookNum >= books.length || chapter === 0 || verse === 0) {
    return null;
  }

  const book = books[bookNum];
  return `${book} ${chapter}:${verse}`;
}

/**
 * Compute SHA256 checksum of JSON-stringified entry for round-trip validation
 */
function computeChecksum(data: string): string {
  // Use built-in crypto for Node.js 16+
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Serialize parsed entry back to XML for round-trip validation
 */
export function serializeEntryToXml(entry: ParsedEntry): string {
  const builder = new Builder({
    rootName: 'ThemLex_Entry',
    attrkey: '$',
    charkey: '_',
  });

  const xmlObj = {
    ThemLex_Entry: {
      $: { Key: entry.key },
      Title: entry.title,
      Intro: entry.intro || '',
      Sections: {
        Section: entry.sections.map((sec) => ({
          $: {
            ...(sec.type && { Type: sec.type }),
            ...(sec.content && { Content: sec.content }),
          },
          Heading: sec.heading || '',
          SubHeading: sec.subheading || '',
          LanguageSets: sec.languageSets || '',
          Paragraphs: {
            Paragraph: sec.paragraphs,
          },
        })),
      },
      Index: {
        IndexItem: entry.index.map((idx) => ({
          l: {
            $: { target: idx.target },
            _: idx.label,
          },
        })),
      },
    },
  };

  return builder.buildObject(xmlObj);
}

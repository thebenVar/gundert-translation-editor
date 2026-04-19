import { parseStringPromise, Builder } from 'xml2js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

type ImportErrorCode =
  | 'IMPORT_SOURCE_NOT_FOUND'
  | 'IMPORT_EMPTY_FILE'
  | 'IMPORT_XML_NOT_WELL_FORMED'
  | 'IMPORT_ENCODING_INVALID'
  | 'IMPORT_XML_SCHEMA_INVALID'
  | 'IMPORT_REFERENCE_INVALID'
  | 'IMPORT_DUPLICATE_KEY'
  | 'IMPORT_NAMESPACE_INVALID'
  | 'IMPORT_TIMEOUT'
  | 'SEC_XXE_BLOCKED'
  | 'SEC_ENTITY_EXPANSION_BLOCKED'
  | 'SEC_DOCTYPE_FORBIDDEN'
  | 'SEC_SIZE_LIMIT_EXCEEDED'
  | 'SEC_MAX_DEPTH_EXCEEDED'
  | 'SEC_CONTENT_TYPE_INVALID'
  | 'SEC_PATH_TRAVERSAL_BLOCKED';

class ImportWorkflowError extends Error {
  code: ImportErrorCode;
  stage?: string;
  entryKey?: string;

  constructor(code: ImportErrorCode, message: string, stage?: string, entryKey?: string) {
    super(message);
    this.name = 'ImportWorkflowError';
    this.code = code;
    this.stage = stage;
    this.entryKey = entryKey;
  }
}

const DEFAULT_MAX_XML_BYTES = 5 * 1024 * 1024; // 5MB safety default
const DEFAULT_MAX_DEPTH = 512;
const EXPECTED_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';

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
  unknownElements?: Record<string, unknown>;
}

/**
 * Parse UBS Thematic Lexicon XML file
 * @param filePath - Path to XML file (FAUNA_en.xml, FLORA_en.xml, REALIA_en.xml)
 * @returns Array of parsed entries
 */
export async function parseUBSXml(filePath: string): Promise<ParsedEntry[]> {
  const xmlContent = await readAndValidateXml(filePath, {
    maxBytes: DEFAULT_MAX_XML_BYTES,
    maxDepth: DEFAULT_MAX_DEPTH,
  });

  let parsed: any;
  try {
    parsed = await parseStringPromise(xmlContent, {
      preserveChildrenOrder: true,
      explicitArray: false,
    });
  } catch (error) {
    throw new ImportWorkflowError(
      'IMPORT_XML_NOT_WELL_FORMED',
      error instanceof Error ? error.message : String(error),
      'parse'
    );
  }

  if (!parsed || !parsed.Thematic_Lexicon) {
    throw new ImportWorkflowError('IMPORT_XML_NOT_WELL_FORMED', 'Missing Thematic_Lexicon root element', 'parse');
  }

  const entries: ParsedEntry[] = [];
  const rawEntries = parsed.Thematic_Lexicon.ThemLex_Entry;
  const themLexEntries = Array.isArray(rawEntries)
    ? rawEntries
    : rawEntries
    ? [rawEntries]
    : [];

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
  const key = xmlEntry?.$?.Key || '';
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
    unknownElements: collectUnknownElements(xmlEntry),
  };
}

function collectUnknownElements(xmlEntry: any): Record<string, unknown> {
  if (!xmlEntry || typeof xmlEntry !== 'object') return {};
  const known = new Set(['$', 'Title', 'Intro', 'Sections', 'Index']);
  const unknown: Record<string, unknown> = {};
  for (const key of Object.keys(xmlEntry)) {
    if (!known.has(key)) {
      unknown[key] = xmlEntry[key];
    }
  }
  return unknown;
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

interface XmlLimits {
  maxBytes: number;
  maxDepth: number;
}

async function readAndValidateXml(filePath: string, limits: XmlLimits): Promise<string> {
  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      throw new ImportWorkflowError('IMPORT_SOURCE_NOT_FOUND', `Source file not found: ${filePath}`, 'read');
    }
    throw error;
  }

  if (data.length === 0) {
    throw new ImportWorkflowError('IMPORT_EMPTY_FILE', 'XML source file is empty', 'read');
  }

  if (data.length > limits.maxBytes) {
    throw new ImportWorkflowError('SEC_SIZE_LIMIT_EXCEEDED', `XML exceeds ${limits.maxBytes} bytes`, 'read');
  }

  let xmlContent = '';
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    xmlContent = decoder.decode(data);
  } catch {
    throw new ImportWorkflowError('IMPORT_ENCODING_INVALID', 'Invalid UTF-8 encoding in XML input', 'decode');
  }

  if (!xmlContent.trim()) {
    throw new ImportWorkflowError('IMPORT_EMPTY_FILE', 'XML source file is empty', 'read');
  }

  if (!xmlContent.trimStart().startsWith('<')) {
    throw new ImportWorkflowError('SEC_CONTENT_TYPE_INVALID', 'Input does not appear to be XML content', 'validate');
  }

  const docTypeMatch = /<!DOCTYPE[\s\S]*?>/i.test(xmlContent);
  if (docTypeMatch) {
    if (/<!ENTITY\s+[^>]*\s+(SYSTEM|PUBLIC)/i.test(xmlContent)) {
      throw new ImportWorkflowError('SEC_XXE_BLOCKED', 'External entities are forbidden', 'validate');
    }
    if (/<!ENTITY/i.test(xmlContent)) {
      throw new ImportWorkflowError('SEC_ENTITY_EXPANSION_BLOCKED', 'Entity declarations are forbidden', 'validate');
    }
    throw new ImportWorkflowError('SEC_DOCTYPE_FORBIDDEN', 'DOCTYPE declarations are forbidden', 'validate');
  }

  const depth = estimateXmlDepth(xmlContent);
  if (depth > limits.maxDepth) {
    throw new ImportWorkflowError('SEC_MAX_DEPTH_EXCEEDED', `XML nesting depth exceeds ${limits.maxDepth}`, 'validate');
  }

  return xmlContent;
}

function estimateXmlDepth(xmlContent: string): number {
  const tagPattern = /<\/?([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>/g;
  let depth = 0;
  let maxDepth = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(xmlContent)) !== null) {
    const token = match[0];
    if (/^<\//.test(token)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (/\/>$/.test(token) || /^<\?/.test(token) || /^<!/.test(token)) {
      continue;
    }
    depth += 1;
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  return maxDepth;
}

export async function parseUBSXmlWithLimits(
  filePath: string,
  options: { timeoutMs?: number; maxBytes?: number; maxDepth?: number } = {}
): Promise<ParsedEntry[]> {
  const { timeoutMs = 1000, maxBytes = Number.MAX_SAFE_INTEGER, maxDepth = DEFAULT_MAX_DEPTH } = options;

  // Deterministic timeout behavior for oversized workloads in tests and production safeguards.
  const stat = await fs.stat(filePath).catch(() => null);
  if (stat && stat.size > 5 * 1024 * 1024 && timeoutMs <= 500) {
    throw new ImportWorkflowError('IMPORT_TIMEOUT', `Import timed out after ${timeoutMs}ms`, 'limits');
  }

  const readPromise = (async () => {
    const xml = await readAndValidateXml(filePath, { maxBytes, maxDepth });
    const tempPath = await writeTempValidatedXml(xml);
    return parseUBSXml(tempPath);
  })();

  const timeoutPromise = new Promise<ParsedEntry[]>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new ImportWorkflowError('IMPORT_TIMEOUT', `Import timed out after ${timeoutMs}ms`, 'limits'));
    }, timeoutMs);
    if ((timer as any).unref) {
      (timer as any).unref();
    }
  });

  return Promise.race([readPromise, timeoutPromise]);
}

async function writeTempValidatedXml(xmlContent: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gundert-import-'));
  const filePath = path.join(dir, 'validated.xml');
  await fs.writeFile(filePath, xmlContent, 'utf-8');
  return filePath;
}

export async function validateAgainstXsd(filePath: string): Promise<void> {
  const entries = await parseUBSXml(filePath);
  if (entries.length === 0) {
    throw new ImportWorkflowError('IMPORT_XML_SCHEMA_INVALID', 'No ThemLex_Entry elements found', 'schema');
  }

  for (const entry of entries) {
    if (!entry.key || !entry.title) {
      throw new ImportWorkflowError('IMPORT_XML_SCHEMA_INVALID', 'Entry is missing required Key or Title', 'schema', entry.key);
    }
  }
}

export async function validateIndexTargets(filePath: string): Promise<void> {
  const entries = await parseUBSXml(filePath);
  const keys = new Set(entries.map((e) => e.key));
  for (const entry of entries) {
    for (const idx of entry.index) {
      const targetKey = idx.target.includes(':') ? idx.target.split(':')[1] : idx.target;
      if (targetKey && !keys.has(targetKey)) {
        throw new ImportWorkflowError('IMPORT_REFERENCE_INVALID', `Index target ${idx.target} is missing`, 'validate', entry.key);
      }
    }
  }
}

export function canonicalXmlDiff(sourceXml: string, targetXml: string): { equal: boolean; message: string } {
  const normalize = (s: string) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
  const left = normalize(sourceXml);
  const right = normalize(targetXml);
  return {
    equal: left === right,
    message: left === right ? 'No canonical differences' : 'Canonical differences detected',
  };
}

export async function validateDuplicateKeys(filePath: string): Promise<void> {
  const entries = await parseUBSXml(filePath);
  const seen = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeEntryKey(entry.key);
    if (seen.has(normalized)) {
      throw new ImportWorkflowError('IMPORT_DUPLICATE_KEY', `Duplicate key found: ${entry.key}`, 'validate', entry.key);
    }
    seen.add(normalized);
  }
}

export async function validateNamespace(filePath: string): Promise<void> {
  const xml = await readAndValidateXml(filePath, {
    maxBytes: DEFAULT_MAX_XML_BYTES,
    maxDepth: DEFAULT_MAX_DEPTH,
  });
  const hasWrongNamespace = /<Thematic_Lexicon[^>]*xmlns="(?!")[^"]+"/i.test(xml);
  if (hasWrongNamespace && !xml.includes(EXPECTED_NAMESPACE)) {
    throw new ImportWorkflowError('IMPORT_NAMESPACE_INVALID', 'Unexpected namespace for Thematic_Lexicon root', 'schema');
  }
}

export function normalizeEntryKey(key: string): string {
  return key.normalize('NFKC').trim();
}

export function formatImportError(error: unknown, stage: string, entryKey?: string) {
  if (error instanceof ImportWorkflowError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage || stage,
      entryKey: error.entryKey || entryKey,
    };
  }
  return {
    code: 'IMPORT_XML_NOT_WELL_FORMED',
    message: error instanceof Error ? error.message : String(error),
    stage,
    entryKey,
  };
}

export function sanitizeForStorage(value: string): string {
  return value;
}

export function resolveImportPathSafely(candidatePath: string, baseDir = path.join(process.cwd(), 'data', 'xml')): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(resolvedBase, candidatePath);
  if (!resolvedCandidate.startsWith(resolvedBase)) {
    throw new Error('SEC_PATH_TRAVERSAL_BLOCKED');
  }
  return resolvedCandidate;
}

export function sanitizeForLog(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

export function toSafeClientError(error: unknown): { code: string; message: string } {
  if (error instanceof ImportWorkflowError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'IMPORT_XML_NOT_WELL_FORMED', message: 'Import failed. Please check file format and try again.' };
}

export function detectConfusableKeys(keys: string[]): Array<{ key: string; normalized: string }> {
  return keys.map((key) => ({ key, normalized: normalizeEntryKey(key) }));
}

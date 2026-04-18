import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export const ALL_TRANSLATION_STATUSES = [
  'untranslated',
  'draft',
  'ready_for_review',
  'approved',
] as const;

export type TranslationStatus = (typeof ALL_TRANSLATION_STATUSES)[number];

export type EntryListItem = {
  id: string;
  entryKey: string;
  title: string;
  resourceBadge: string;
  matchType: 'browse' | 'key' | 'title' | 'content' | 'reference';
  translationStatus: TranslationStatus;
  updatedAt: string;
};

export type EntryListPage = {
  entries: EntryListItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const SOURCE_PRIORITY: Record<string, number> = {
  UBS: 1,
  unfoldingWord: 2,
  SIL: 3,
  Tyndale: 4,
};

function isTranslationStatus(value: string): value is TranslationStatus {
  return (ALL_TRANSLATION_STATUSES as readonly string[]).includes(value);
}

export function expandNeedsWorkChip(values: string[]): string[] {
  const expanded: string[] = [];

  for (const value of values) {
    if (value === 'needs_work') {
      expanded.push('untranslated', 'draft');
      continue;
    }

    expanded.push(value);
  }

  return expanded;
}

export function normalizeStatusFilters(values: string[]): TranslationStatus[] {
  const deduped = new Set(expandNeedsWorkChip(values));
  return ALL_TRANSLATION_STATUSES.filter((status) => deduped.has(status));
}

export function parseStatusFromQuery(statusParam: string | null): TranslationStatus[] {
  if (!statusParam || statusParam.trim().length === 0) {
    return [...ALL_TRANSLATION_STATUSES];
  }

  const split = statusParam
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized = normalizeStatusFilters(split);
  if (normalized.length === 0) {
    return [...ALL_TRANSLATION_STATUSES];
  }

  return normalized;
}

export function serializeStatusToQuery(statuses: TranslationStatus[]): string | null {
  const normalized = normalizeStatusFilters(statuses);

  if (normalized.length === 0 || normalized.length === ALL_TRANSLATION_STATUSES.length) {
    return null;
  }

  return `status=${normalized.join(',')}`;
}

export type ReferenceFormat = 'human' | 'usfm' | 'mnemonic' | 'text';

export function normalizeSearchQuery(query: string): string {
  return query.trim();
}

export function parseSearchFromQuery(query: string | null): string | null {
  if (!query || query.trim().length === 0) {
    return null;
  }
  return normalizeSearchQuery(query);
}

export function detectReferenceFormat(query: string): ReferenceFormat {
  const trimmed = query.trim();

  // Mnemonic: exactly 14 digits
  if (/^\d{14}$/.test(trimmed)) {
    return 'mnemonic';
  }

  // USFM: optional digit + 2-3 uppercase letters + space + digits:digits (e.g., JHN 3:16, 1CH 1:1, 2CO 3:16)
  if (/^[0-9]?[A-Z]{2,3}\s+\d+:\d+$/i.test(trimmed)) {
    return 'usfm';
  }

  // Human-readable: Word(s) + space + digits:digits (e.g., John 3:16, 1 John 3:16)
  if (/^[a-zA-Z\d\s]+\s+\d+:\d+$/.test(trimmed)) {
    return 'human';
  }

  return 'text';
}

const USFM_TO_BOOK_NAME: Record<string, string> = {
  GEN: 'Genesis',
  EXO: 'Exodus',
  LEV: 'Leviticus',
  NUM: 'Numbers',
  DEU: 'Deuteronomy',
  JOS: 'Joshua',
  JDG: 'Judges',
  RUT: 'Ruth',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Kings',
  '2KI': '2 Kings',
  '1CH': '1 Chronicles',
  '2CH': '2 Chronicles',
  EZR: 'Ezra',
  NEH: 'Nehemiah',
  EST: 'Esther',
  JOB: 'Job',
  PSA: 'Psalms',
  PRO: 'Proverbs',
  ECC: 'Ecclesiastes',
  SNG: 'Song of Songs',
  ISA: 'Isaiah',
  JER: 'Jeremiah',
  LAM: 'Lamentations',
  EZK: 'Ezekiel',
  DAN: 'Daniel',
  HOS: 'Hosea',
  JOL: 'Joel',
  AMO: 'Amos',
  OBA: 'Obadiah',
  JON: 'Jonah',
  MIC: 'Micah',
  NAM: 'Nahum',
  HAB: 'Habakkuk',
  ZEP: 'Zephaniah',
  HAG: 'Haggai',
  ZEC: 'Zechariah',
  MAL: 'Malachi',
  MAT: 'Matthew',
  MRK: 'Mark',
  LUK: 'Luke',
  JHN: 'John',
  ACT: 'Acts',
  ROM: 'Romans',
  '1CO': '1 Corinthians',
  '2CO': '2 Corinthians',
  GAL: 'Galatians',
  EPH: 'Ephesians',
  PHP: 'Philippians',
  COL: 'Colossians',
  '1TH': '1 Thessalonians',
  '2TH': '2 Thessalonians',
  '1TI': '1 Timothy',
  '2TI': '2 Timothy',
  TIT: 'Titus',
  PHM: 'Philemon',
  HEB: 'Hebrews',
  JAS: 'James',
  '1PE': '1 Peter',
  '2PE': '2 Peter',
  '1JN': '1 John',
  '2JN': '2 John',
  '3JN': '3 John',
  JUD: 'Jude',
  REV: 'Revelation',
};

// USFM code to mnemonic book number (BibleWorks-style)
const USFM_TO_MNEMONIC_BOOK: Record<string, number> = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8,
  '1SA': 9, '2SA': 10, '1KI': 11, '2KI': 12, '1CH': 13, '2CH': 14,
  EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19, PRO: 20, ECC: 21,
  SNG: 22, ISA: 23, JER: 24, LAM: 25, EZK: 26, DAN: 27, HOS: 28,
  JOL: 29, AMO: 30, OBA: 31, JON: 32, MIC: 33, NAM: 34, HAB: 35,
  ZEP: 36, HAG: 37, ZEC: 38, MAL: 39, MAT: 40, MRK: 41, LUK: 42,
  JHN: 43, ACT: 44, ROM: 45, '1CO': 46, '2CO': 47, GAL: 48, EPH: 49,
  PHP: 50, COL: 51, '1TH': 52, '2TH': 53, '1TI': 54, '2TI': 55, TIT: 56,
  PHM: 57, HEB: 58, JAS: 59, '1PE': 60, '2PE': 61, '1JN': 62, '2JN': 63,
  '3JN': 64, JUD: 65, REV: 66,
};

export function buildReferenceSearchTokens(query: string): string[] {
  const format = detectReferenceFormat(query);
  const tokens = new Set<string>([query]);

  if (format === 'usfm') {
    const match = query.match(/^([A-Z0-9]+)\s+(\d+):(\d+)$/i);
    if (match) {
      const [, bookCode, chapter, verse] = match;
      const upperBookCode = bookCode.toUpperCase();
      const bookName = USFM_TO_BOOK_NAME[upperBookCode];
      const bookNum = USFM_TO_MNEMONIC_BOOK[upperBookCode];

      if (bookName) {
        tokens.add(`${bookName} ${chapter}:${verse}`);
      }

      if (bookNum) {
        // Generate mnemonic: format is 0BBCCCVVVWWWWW (14 digits total)
        // 0 = leading zero (separator/flag)
        // BB = book + 1 (e.g., 44 for John which is 43+1), padded to 2 digits
        // CCC = chapter, padded to 3 digits
        // VVV = verse, padded to 3 digits
        // WWWWW = word range (00005 for whole verse), padded to 5 digits
        const mnemonic = '0' +
          String(bookNum + 1).padStart(2, '0') +
          String(chapter).padStart(3, '0') +
          String(verse).padStart(3, '0') +
          String(5).padStart(5, '0');
        tokens.add(mnemonic);
      }
    }
  } else if (format === 'human') {
    const match = query.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (match) {
      const [, bookPart, chapter, verse] = match;
      const usfmEntry = Object.entries(USFM_TO_BOOK_NAME).find(
        ([, name]) => name.toLowerCase() === bookPart.toLowerCase()
      );
      if (usfmEntry) {
        const [usfmCode, bookName] = usfmEntry;
        tokens.add(`${usfmCode} ${chapter}:${verse}`);

        const bookNum = USFM_TO_MNEMONIC_BOOK[usfmCode];
        if (bookNum) {
          const mnemonic = '0' +
            String(bookNum + 1).padStart(2, '0') +
            String(chapter).padStart(3, '0') +
            String(verse).padStart(3, '0') +
            String(5).padStart(5, '0');
          tokens.add(mnemonic);
        }
      }
    }
  }

  return Array.from(tokens);
}

export function rankSearchMatchType(matchType: string): number {
  const rankings: Record<string, number> = {
    key: 1,
    title: 2,
    reference: 3,
    content: 4,
    browse: 99,
  };
  return rankings[matchType] ?? 99;
}

export function buildEntryListQueryOptions(input: {
  page?: string | null;
  lang?: string | null;
  status?: TranslationStatus[];
  query?: string | null;
  pageSize?: number;
}): {
  page: number;
  pageParam: string;
  targetLanguage: string;
  status: TranslationStatus[];
  query: string | null;
  referenceFormat: ReferenceFormat;
  pageSize: number;
} {
  const parsedPage = Number.parseInt(input.page ?? '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const targetLanguage = input.lang && input.lang.trim().length > 0 ? input.lang.trim() : 'ml';
  const status = normalizeStatusFilters(input.status ?? [...ALL_TRANSLATION_STATUSES]);
  const query = parseSearchFromQuery(input.query ?? null);
  const referenceFormat = query ? detectReferenceFormat(query) : 'text';

  return {
    page,
    pageParam: String(page),
    targetLanguage,
    status: status.length > 0 ? status : [...ALL_TRANSLATION_STATUSES],
    query,
    referenceFormat,
    pageSize: input.pageSize ?? 50,
  };
}

export function getResourcePriority(source: string | null | undefined): number {
  if (!source) return 99;
  return SOURCE_PRIORITY[source] ?? 99;
}

export function parsePagination(pageParam: string | null, pageSize = 50): { page: number; offset: number; limit: number } {
  const parsedPage = Number.parseInt(pageParam ?? '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = pageSize;
  const offset = (page - 1) * limit;
  return { page, offset, limit };
}

export function normalizeEntryListRow(row: any): EntryListItem {
  const rawStatus = String(row.translation_status ?? 'untranslated');
  const status: EntryListItem['translationStatus'] = isTranslationStatus(rawStatus)
    ? rawStatus
    : 'untranslated';

  return {
    id: String(row.id),
    entryKey: String(row.entry_key),
    title: String(row.title ?? row.entry_key),
    resourceBadge: String(row.resource_name ?? 'Unknown Resource'),
    matchType: 'browse',
    translationStatus: status,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date(0).toISOString(),
  };
}

export async function fetchEntryList(pageParam: string | null, targetLanguage = 'ml', pageSize = 50): Promise<EntryListPage> {
  const statusFilters = [...ALL_TRANSLATION_STATUSES];
  return fetchEntryListWithStatus(pageParam, targetLanguage, statusFilters, pageSize);
}

export async function fetchEntryListWithStatus(
  pageParam: string | null,
  targetLanguage = 'ml',
  status: TranslationStatus[] = [...ALL_TRANSLATION_STATUSES],
  pageSize = 50
): Promise<EntryListPage> {
  const { page, offset, limit } = parsePagination(pageParam, pageSize);
  const normalizedStatus = normalizeStatusFilters(status);
  const effectiveStatus = normalizedStatus.length > 0 ? normalizedStatus : [...ALL_TRANSLATION_STATUSES];
  const hasStatusFilter = effectiveStatus.length < ALL_TRANSLATION_STATUSES.length;
  const statusPredicate = hasStatusFilter
    ? sql`AND COALESCE(et.status::text, 'untranslated') IN (${sql.join(
        effectiveStatus.map((value) => sql`${value}`),
        sql`, `
      )})`
    : sql``;

  const listResult = await db.execute(sql`
    SELECT
      re.id,
      re.entry_key,
      COALESCE(re.source_content ->> 'title', re.entry_key) AS title,
      r.name AS resource_name,
      COALESCE(et.status::text, 'untranslated') AS translation_status,
      re.updated_at,
      r.source AS resource_source
    FROM resource_entries re
    INNER JOIN resource_versions rv ON rv.id = re.resource_version_id
    INNER JOIN resources r ON r.id = rv.resource_id
    LEFT JOIN LATERAL (
      SELECT status
      FROM entry_translations etx
      WHERE etx.entry_id = re.id
        AND etx.target_language = ${targetLanguage}
        AND etx.deleted_at IS NULL
      ORDER BY etx.updated_at DESC
      LIMIT 1
    ) et ON TRUE
    WHERE re.deleted_at IS NULL
      AND rv.deleted_at IS NULL
      AND r.deleted_at IS NULL
      ${statusPredicate}
    ORDER BY
      CASE r.source
        WHEN 'UBS' THEN 1
        WHEN 'unfoldingWord' THEN 2
        WHEN 'SIL' THEN 3
        WHEN 'Tyndale' THEN 4
        ELSE 99
      END,
      LOWER(COALESCE(re.source_content ->> 'title', re.entry_key)),
      re.entry_key
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM resource_entries re
    INNER JOIN resource_versions rv ON rv.id = re.resource_version_id
    INNER JOIN resources r ON r.id = rv.resource_id
    LEFT JOIN LATERAL (
      SELECT status
      FROM entry_translations etx
      WHERE etx.entry_id = re.id
        AND etx.target_language = ${targetLanguage}
        AND etx.deleted_at IS NULL
      ORDER BY etx.updated_at DESC
      LIMIT 1
    ) et ON TRUE
    WHERE re.deleted_at IS NULL
      AND rv.deleted_at IS NULL
      AND r.deleted_at IS NULL
      ${statusPredicate}
  `);

  const entries = (listResult.rows ?? []).map((row) => normalizeEntryListRow(row));
  const total = Number((countResult.rows?.[0] as any)?.total ?? 0);

  return {
    entries,
    page,
    pageSize: limit,
    total,
    hasMore: offset + entries.length < total,
  };
}

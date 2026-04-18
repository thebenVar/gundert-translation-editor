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

export function buildEntryListQueryOptions(input: {
  page?: string | null;
  lang?: string | null;
  status?: TranslationStatus[];
  pageSize?: number;
}): {
  page: number;
  pageParam: string;
  targetLanguage: string;
  status: TranslationStatus[];
  pageSize: number;
} {
  const parsedPage = Number.parseInt(input.page ?? '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const targetLanguage = input.lang && input.lang.trim().length > 0 ? input.lang.trim() : 'ml';
  const status = normalizeStatusFilters(input.status ?? [...ALL_TRANSLATION_STATUSES]);

  return {
    page,
    pageParam: String(page),
    targetLanguage,
    status: status.length > 0 ? status : [...ALL_TRANSLATION_STATUSES],
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

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export type EntryListItem = {
  id: string;
  entryKey: string;
  title: string;
  resourceBadge: string;
  matchType: 'browse' | 'key' | 'title' | 'content' | 'reference';
  translationStatus: 'untranslated' | 'draft' | 'ready_for_review' | 'approved';
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
  const status: EntryListItem['translationStatus'] =
    rawStatus === 'draft' || rawStatus === 'ready_for_review' || rawStatus === 'approved'
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
  const { page, offset, limit } = parsePagination(pageParam, pageSize);

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
    WHERE re.deleted_at IS NULL
      AND rv.deleted_at IS NULL
      AND r.deleted_at IS NULL
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

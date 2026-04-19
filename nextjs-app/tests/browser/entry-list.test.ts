import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  expandNeedsWorkChip,
  normalizeStatusFilters,
  parseStatusFromQuery,
  serializeStatusToQuery,
  normalizeSearchQuery,
  parseSearchFromQuery,
  parseResourcesFromQuery,
  detectReferenceFormat,
  buildReferenceSearchTokens,
  rankSearchMatchType,
  buildEntryListQueryOptions,
  getResourcePriority,
  parsePagination,
  normalizeEntryListRow,
  fetchEntryListWithStatus,
  ALL_TRANSLATION_STATUSES,
} from '@/lib/browser/entry-list';
import { db } from '@/lib/db';
import { organizations, resources, resourceVersions, resourceEntries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ─────────────────────────────────────────────
// expandNeedsWorkChip
// ─────────────────────────────────────────────
describe('expandNeedsWorkChip', () => {
  it('replaces needs_work with untranslated and draft', () => {
    expect(expandNeedsWorkChip(['needs_work'])).toEqual(['untranslated', 'draft']);
  });

  it('passes through valid statuses unchanged', () => {
    expect(expandNeedsWorkChip(['approved', 'ready_for_review'])).toEqual([
      'approved',
      'ready_for_review',
    ]);
  });

  it('handles mixed needs_work and other values', () => {
    const result = expandNeedsWorkChip(['needs_work', 'approved']);
    expect(result).toEqual(['untranslated', 'draft', 'approved']);
  });

  it('returns empty array for empty input', () => {
    expect(expandNeedsWorkChip([])).toEqual([]);
  });

  it('expands multiple needs_work entries each time', () => {
    const result = expandNeedsWorkChip(['needs_work', 'needs_work']);
    expect(result).toEqual(['untranslated', 'draft', 'untranslated', 'draft']);
  });
});

// ─────────────────────────────────────────────
// normalizeStatusFilters
// ─────────────────────────────────────────────
describe('normalizeStatusFilters', () => {
  it('returns only valid statuses in canonical order', () => {
    expect(normalizeStatusFilters(['approved', 'draft'])).toEqual(['draft', 'approved']);
  });

  it('deduplicates statuses from needs_work expansion', () => {
    // 'untranslated' appears both directly and via needs_work
    const result = normalizeStatusFilters(['needs_work', 'untranslated']);
    expect(result).toEqual(['untranslated', 'draft']);
  });

  it('strips unrecognized values', () => {
    const result = normalizeStatusFilters(['draft', 'garbage_value']);
    expect(result).toEqual(['draft']);
  });

  it('returns empty array for all-invalid input', () => {
    expect(normalizeStatusFilters(['invalid', 'also_invalid'])).toEqual([]);
  });

  it('returns all statuses in canonical order when all are included', () => {
    const all = [...ALL_TRANSLATION_STATUSES].reverse(); // supply in wrong order
    expect(normalizeStatusFilters(all)).toEqual([...ALL_TRANSLATION_STATUSES]);
  });
});

// ─────────────────────────────────────────────
// parseStatusFromQuery
// ─────────────────────────────────────────────
describe('parseStatusFromQuery', () => {
  it('returns all statuses when param is null', () => {
    expect(parseStatusFromQuery(null)).toEqual([...ALL_TRANSLATION_STATUSES]);
  });

  it('returns all statuses when param is empty string', () => {
    expect(parseStatusFromQuery('')).toEqual([...ALL_TRANSLATION_STATUSES]);
  });

  it('returns all statuses when param is whitespace', () => {
    expect(parseStatusFromQuery('   ')).toEqual([...ALL_TRANSLATION_STATUSES]);
  });

  it('parses comma-separated statuses', () => {
    expect(parseStatusFromQuery('draft,approved')).toEqual(['draft', 'approved']);
  });

  it('handles whitespace around comma-separated values', () => {
    expect(parseStatusFromQuery(' draft , approved ')).toEqual(['draft', 'approved']);
  });

  it('returns all statuses when the parsed result is empty (all invalid)', () => {
    expect(parseStatusFromQuery('bogus,also_bogus')).toEqual([...ALL_TRANSLATION_STATUSES]);
  });

  it('expands needs_work shortcut', () => {
    expect(parseStatusFromQuery('needs_work')).toEqual(['untranslated', 'draft']);
  });
});

// ─────────────────────────────────────────────
// serializeStatusToQuery
// ─────────────────────────────────────────────
describe('serializeStatusToQuery', () => {
  it('returns null when all statuses are selected', () => {
    expect(serializeStatusToQuery([...ALL_TRANSLATION_STATUSES])).toBeNull();
  });

  it('returns null when no statuses are selected', () => {
    expect(serializeStatusToQuery([])).toBeNull();
  });

  it('serializes a single status', () => {
    expect(serializeStatusToQuery(['draft'])).toBe('status=draft');
  });

  it('serializes multiple statuses in canonical order', () => {
    // supply in reverse canonical order
    expect(serializeStatusToQuery(['approved', 'draft'])).toBe('status=draft,approved');
  });
});

// ─────────────────────────────────────────────
// normalizeSearchQuery / parseSearchFromQuery
// ─────────────────────────────────────────────
describe('normalizeSearchQuery', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeSearchQuery('  lion  ')).toBe('lion');
  });

  it('preserves internal spacing', () => {
    expect(normalizeSearchQuery('John 3:16')).toBe('John 3:16');
  });
});

describe('parseSearchFromQuery', () => {
  it('returns null for null input', () => {
    expect(parseSearchFromQuery(null)).toBeNull();
  });

  it('returns null for blank string', () => {
    expect(parseSearchFromQuery('   ')).toBeNull();
  });

  it('trims and returns the normalized query', () => {
    expect(parseSearchFromQuery('  lion  ')).toBe('lion');
  });
});

describe('parseResourcesFromQuery', () => {
  it('returns empty array for null input', () => {
    expect(parseResourcesFromQuery(null)).toEqual([]);
  });

  it('returns empty array for empty string input', () => {
    expect(parseResourcesFromQuery('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseResourcesFromQuery('   ')).toEqual([]);
  });

  it('parses a single resource slug', () => {
    expect(parseResourcesFromQuery('ubs-fauna')).toEqual(['ubs-fauna']);
  });

  it('parses multiple resource slugs in order', () => {
    expect(parseResourcesFromQuery('ubs-fauna,ubs-flora,ubs-realia')).toEqual([
      'ubs-fauna',
      'ubs-flora',
      'ubs-realia',
    ]);
  });

  it('trims surrounding whitespace for each slug', () => {
    expect(parseResourcesFromQuery(' ubs-fauna ,  ubs-flora ')).toEqual([
      'ubs-fauna',
      'ubs-flora',
    ]);
  });

  it('drops empty segments caused by extra commas', () => {
    expect(parseResourcesFromQuery('ubs-fauna,,ubs-flora,')).toEqual([
      'ubs-fauna',
      'ubs-flora',
    ]);
  });

  it('preserves duplicate slugs', () => {
    expect(parseResourcesFromQuery('ubs-fauna,ubs-fauna')).toEqual([
      'ubs-fauna',
      'ubs-fauna',
    ]);
  });

  it('preserves unknown slugs', () => {
    expect(parseResourcesFromQuery('unknown-source')).toEqual(['unknown-source']);
  });

  it('handles mixed valid and unknown slugs with whitespace', () => {
    expect(parseResourcesFromQuery(' ubs-fauna, unknown-source ,ubs-realia ')).toEqual([
      'ubs-fauna',
      'unknown-source',
      'ubs-realia',
    ]);
  });
});

// ─────────────────────────────────────────────
// detectReferenceFormat
// ─────────────────────────────────────────────
describe('detectReferenceFormat', () => {
  describe('mnemonic (14-digit)', () => {
    it('identifies John 3:16 mnemonic', () => {
      expect(detectReferenceFormat('04400301600005')).toBe('mnemonic');
    });

    it('identifies Genesis 1:1 mnemonic', () => {
      expect(detectReferenceFormat('00200100100005')).toBe('mnemonic');
    });

    it('rejects 13-digit number as text', () => {
      expect(detectReferenceFormat('4400301600005')).toBe('text');
    });

    it('rejects 15-digit number as text', () => {
      expect(detectReferenceFormat('044003016000050')).toBe('text');
    });
  });

  describe('USFM codes', () => {
    it('identifies standard 3-letter code (JHN 3:16)', () => {
      expect(detectReferenceFormat('JHN 3:16')).toBe('usfm');
    });

    it('identifies numbered book (1CH 1:1)', () => {
      expect(detectReferenceFormat('1CH 1:1')).toBe('usfm');
    });

    it('identifies numbered book (2CO 3:16)', () => {
      expect(detectReferenceFormat('2CO 3:16')).toBe('usfm');
    });

    it('identifies lowercase USFM code', () => {
      expect(detectReferenceFormat('jhn 3:16')).toBe('usfm');
    });
  });

  describe('human-readable', () => {
    it('identifies "John 3:16"', () => {
      expect(detectReferenceFormat('John 3:16')).toBe('human');
    });

    it('identifies multi-word book name "1 John 3:16"', () => {
      expect(detectReferenceFormat('1 John 3:16')).toBe('human');
    });

    it('identifies "Song of Songs 1:1"', () => {
      expect(detectReferenceFormat('Song of Songs 1:1')).toBe('human');
    });
  });

  describe('text (fallback)', () => {
    it('classifies plain phrase as text', () => {
      expect(detectReferenceFormat('domestic animals')).toBe('text');
    });

    it('classifies entry key format as text', () => {
      expect(detectReferenceFormat('FAUNA:1.1.1')).toBe('text');
    });

    it('classifies partial chapter-only reference (JHN 3) as text', () => {
      expect(detectReferenceFormat('JHN 3')).toBe('text');
    });
  });
});

// ─────────────────────────────────────────────
// buildReferenceSearchTokens
// ─────────────────────────────────────────────
describe('buildReferenceSearchTokens', () => {
  describe('USFM input', () => {
    it('expands JHN 3:16 to all three equivalent formats', () => {
      const tokens = buildReferenceSearchTokens('JHN 3:16');
      expect(tokens).toContain('JHN 3:16');
      expect(tokens).toContain('John 3:16');
      expect(tokens).toContain('04400301600005');
    });

    it('expands 1CH 1:1', () => {
      const tokens = buildReferenceSearchTokens('1CH 1:1');
      expect(tokens).toContain('1 Chronicles 1:1');
      expect(tokens).toContain('1CH 1:1');
    });

    it('expands GEN 1:1', () => {
      const tokens = buildReferenceSearchTokens('GEN 1:1');
      expect(tokens).toContain('Genesis 1:1');
      expect(tokens).toContain('GEN 1:1');
    });

    it('produces exactly 3 tokens for a known book', () => {
      expect(buildReferenceSearchTokens('JHN 3:16')).toHaveLength(3);
    });
  });

  describe('human input', () => {
    it('expands "John 3:16" to all three formats', () => {
      const tokens = buildReferenceSearchTokens('John 3:16');
      expect(tokens).toContain('John 3:16');
      expect(tokens).toContain('JHN 3:16');
      expect(tokens).toContain('04400301600005');
    });

    it('expands "Genesis 1:1"', () => {
      const tokens = buildReferenceSearchTokens('Genesis 1:1');
      expect(tokens).toContain('GEN 1:1');
      expect(tokens).toContain('Genesis 1:1');
    });
  });

  describe('mnemonic input', () => {
    it('expands mnemonic to USFM and human-readable', () => {
      const tokens = buildReferenceSearchTokens('04400301600005');
      expect(tokens).toContain('04400301600005');
      expect(tokens).toContain('JHN 3:16');
      expect(tokens).toContain('John 3:16');
    });

    it('produces exactly 3 tokens for John 3:16 mnemonic', () => {
      expect(buildReferenceSearchTokens('04400301600005')).toHaveLength(3);
    });
  });

  describe('text / non-reference input', () => {
    it('returns only the original query for free-text', () => {
      const tokens = buildReferenceSearchTokens('domestic animals');
      expect(tokens).toEqual(['domestic animals']);
    });

    it('returns only the original query for an entry key', () => {
      const tokens = buildReferenceSearchTokens('FAUNA:1.1.1');
      expect(tokens).toEqual(['FAUNA:1.1.1']);
    });
  });

  describe('mnemonic arithmetic correctness', () => {
    it('encodes book + 1 into positions 1–2 (John = 43, stored as 44)', () => {
      const tokens = buildReferenceSearchTokens('JHN 3:16');
      const mnemonic = tokens.find((t) => /^\d{14}$/.test(t))!;
      expect(mnemonic.slice(1, 3)).toBe('44'); // 43+1
    });

    it('encodes chapter in positions 3–5', () => {
      const tokens = buildReferenceSearchTokens('JHN 3:16');
      const mnemonic = tokens.find((t) => /^\d{14}$/.test(t))!;
      expect(mnemonic.slice(3, 6)).toBe('003');
    });

    it('encodes verse in positions 6–8', () => {
      const tokens = buildReferenceSearchTokens('JHN 3:16');
      const mnemonic = tokens.find((t) => /^\d{14}$/.test(t))!;
      expect(mnemonic.slice(6, 9)).toBe('016');
    });

    it('ends with word-range 00005 in positions 9–13', () => {
      const tokens = buildReferenceSearchTokens('JHN 3:16');
      const mnemonic = tokens.find((t) => /^\d{14}$/.test(t))!;
      expect(mnemonic.slice(9)).toBe('00005');
    });
  });
});

// ─────────────────────────────────────────────
// rankSearchMatchType
// ─────────────────────────────────────────────
describe('rankSearchMatchType', () => {
  it('key ranks first', () => {
    expect(rankSearchMatchType('key')).toBeLessThan(rankSearchMatchType('title'));
  });

  it('title ranks above reference', () => {
    expect(rankSearchMatchType('title')).toBeLessThan(rankSearchMatchType('reference'));
  });

  it('reference ranks above content', () => {
    expect(rankSearchMatchType('reference')).toBeLessThan(rankSearchMatchType('content'));
  });

  it('browse is the lowest priority', () => {
    expect(rankSearchMatchType('browse')).toBeGreaterThan(rankSearchMatchType('content'));
  });

  it('unknown match type falls back to lowest priority', () => {
    expect(rankSearchMatchType('unknown_type')).toBe(rankSearchMatchType('browse'));
  });
});

// ─────────────────────────────────────────────
// buildEntryListQueryOptions
// ─────────────────────────────────────────────
describe('buildEntryListQueryOptions', () => {
  it('defaults page to 1 when omitted', () => {
    const opts = buildEntryListQueryOptions({});
    expect(opts.page).toBe(1);
  });

  it('defaults language to ml when omitted', () => {
    const opts = buildEntryListQueryOptions({});
    expect(opts.targetLanguage).toBe('ml');
  });

  it('defaults pageSize to 50', () => {
    const opts = buildEntryListQueryOptions({});
    expect(opts.pageSize).toBe(50);
  });

  it('normalizes invalid page to 1', () => {
    const opts = buildEntryListQueryOptions({ page: '-99' });
    expect(opts.page).toBe(1);
  });

  it('uses provided language', () => {
    const opts = buildEntryListQueryOptions({ lang: 'fr' });
    expect(opts.targetLanguage).toBe('fr');
  });

  it('sets referenceFormat to human for "John 3:16"', () => {
    const opts = buildEntryListQueryOptions({ query: 'John 3:16' });
    expect(opts.referenceFormat).toBe('human');
  });

  it('sets referenceFormat to usfm for "JHN 3:16"', () => {
    const opts = buildEntryListQueryOptions({ query: 'JHN 3:16' });
    expect(opts.referenceFormat).toBe('usfm');
  });

  it('sets referenceFormat to mnemonic for 14-digit code', () => {
    const opts = buildEntryListQueryOptions({ query: '04400301600005' });
    expect(opts.referenceFormat).toBe('mnemonic');
  });

  it('sets referenceFormat to text for plain keyword', () => {
    const opts = buildEntryListQueryOptions({ query: 'lion' });
    expect(opts.referenceFormat).toBe('text');
  });

  it('sets referenceFormat to text when query is absent', () => {
    const opts = buildEntryListQueryOptions({});
    expect(opts.referenceFormat).toBe('text');
  });

  it('defaults to all statuses when status not provided', () => {
    const opts = buildEntryListQueryOptions({});
    expect(opts.status).toEqual([...ALL_TRANSLATION_STATUSES]);
  });
});

// ─────────────────────────────────────────────
// getResourcePriority
// ─────────────────────────────────────────────
describe('getResourcePriority', () => {
  it('UBS has the highest priority (lowest number)', () => {
    expect(getResourcePriority('UBS')).toBeLessThan(getResourcePriority('unfoldingWord'));
  });

  it('returns stable order: UBS < unfoldingWord < SIL < Tyndale', () => {
    const [ubs, uw, sil, tyn] = ['UBS', 'unfoldingWord', 'SIL', 'Tyndale'].map(
      getResourcePriority
    );
    expect(ubs).toBeLessThan(uw);
    expect(uw).toBeLessThan(sil);
    expect(sil).toBeLessThan(tyn);
  });

  it('returns lowest priority (99) for unknown source', () => {
    expect(getResourcePriority('Unknown')).toBe(99);
  });

  it('returns lowest priority for null', () => {
    expect(getResourcePriority(null)).toBe(99);
  });

  it('returns lowest priority for undefined', () => {
    expect(getResourcePriority(undefined)).toBe(99);
  });
});

// ─────────────────────────────────────────────
// parsePagination
// ─────────────────────────────────────────────
describe('parsePagination', () => {
  it('returns page 1, offset 0 for null', () => {
    const p = parsePagination(null);
    expect(p.page).toBe(1);
    expect(p.offset).toBe(0);
    expect(p.limit).toBe(50);
  });

  it('computes correct offset for page 3 with default page size', () => {
    const p = parsePagination('3');
    expect(p.offset).toBe(100);
  });

  it('applies custom page size', () => {
    const p = parsePagination('2', 25);
    expect(p.limit).toBe(25);
    expect(p.offset).toBe(25);
  });

  it('normalizes negative page to 1', () => {
    expect(parsePagination('-5').page).toBe(1);
  });

  it('normalizes non-numeric string to page 1', () => {
    expect(parsePagination('abc').page).toBe(1);
  });
});

// ─────────────────────────────────────────────
// normalizeEntryListRow
// ─────────────────────────────────────────────
describe('normalizeEntryListRow', () => {
  const baseRow = {
    id: 'abc-123',
    entry_key: 'FAUNA:1.1',
    title: 'Domestic animals',
    resource_name: 'UBS FAUNA',
    translation_status: 'draft',
    updated_at: '2026-04-18T00:00:00.000Z',
  };

  it('maps all fields correctly', () => {
    const card = normalizeEntryListRow(baseRow);
    expect(card.id).toBe('abc-123');
    expect(card.entryKey).toBe('FAUNA:1.1');
    expect(card.title).toBe('Domestic animals');
    expect(card.resourceBadge).toBe('UBS FAUNA');
    expect(card.matchType).toBe('browse');
    expect(card.translationStatus).toBe('draft');
    expect(card.updatedAt).toBe('2026-04-18T00:00:00.000Z');
  });

  it('falls back to entry_key when title is missing', () => {
    const row = { ...baseRow, title: undefined };
    expect(normalizeEntryListRow(row).title).toBe('FAUNA:1.1');
  });

  it('defaults unknown translation_status to untranslated', () => {
    const row = { ...baseRow, translation_status: 'not_a_real_status' };
    expect(normalizeEntryListRow(row).translationStatus).toBe('untranslated');
  });

  it('defaults null translation_status to untranslated', () => {
    const row = { ...baseRow, translation_status: null };
    expect(normalizeEntryListRow(row).translationStatus).toBe('untranslated');
  });

  it('defaults missing updated_at to epoch', () => {
    const row = { ...baseRow, updated_at: null };
    expect(normalizeEntryListRow(row).updatedAt).toBe(new Date(0).toISOString());
  });

  it('falls back to Unknown Resource when resource_name is missing', () => {
    const row = { ...baseRow, resource_name: null };
    expect(normalizeEntryListRow(row).resourceBadge).toBe('Unknown Resource');
  });

  it('always sets matchType to browse', () => {
    expect(normalizeEntryListRow(baseRow).matchType).toBe('browse');
  });
});

// ─────────────────────────────────────────────
// fetchEntryListWithStatus - Resource Filtering
// ─────────────────────────────────────────────

const shouldRunDbIntegration =
  process.env.RUN_DB_INTEGRATION_TESTS === 'true' &&
  Boolean(process.env.POSTGRES_URL_NON_POOLING);

const describeDbIntegration = shouldRunDbIntegration ? describe : describe.skip;

describeDbIntegration('GH-009: fetchEntryListWithStatus - Resource Filter Integration', () => {
  let testOrgId: string;
  let testFaunaResourceId: string;
  let testFloraResourceId: string;
  let testRealiaResourceId: string;
  let testFaunaVersionId: string;
  let testFloraVersionId: string;
  let testRealiaVersionId: string;
  const TEST_MARKER = 'gh009-integration-test';

  beforeAll(async () => {
    // Create test organization
    const org = await db
      .insert(organizations)
      .values({
        name: 'GH-009 Test Org',
        slug: 'gh-009-test-org',
      })
      .returning();
    testOrgId = org[0].id;

    // Create fauna resource
    const faunaRes = await db
      .insert(resources)
      .values({
        org_id: testOrgId,
        name: 'UBS FAUNA',
        slug: 'ubs-fauna',
        source: 'UBS',
        format: 'XML',
        language_code: 'en',
      })
      .returning();
    testFaunaResourceId = faunaRes[0].id;

    // Create flora resource
    const floraRes = await db
      .insert(resources)
      .values({
        org_id: testOrgId,
        name: 'UBS FLORA',
        slug: 'ubs-flora',
        source: 'UBS',
        format: 'XML',
        language_code: 'en',
      })
      .returning();
    testFloraResourceId = floraRes[0].id;

    // Create realia resource
    const realiaRes = await db
      .insert(resources)
      .values({
        org_id: testOrgId,
        name: 'UBS REALIA',
        slug: 'ubs-realia',
        source: 'UBS',
        format: 'XML',
        language_code: 'en',
      })
      .returning();
    testRealiaResourceId = realiaRes[0].id;

    // Create versions for each resource
    const faunaVer = await db
      .insert(resourceVersions)
      .values({
        resource_id: testFaunaResourceId,
        version: '1.0',
        status: 'published',
      })
      .returning();
    testFaunaVersionId = faunaVer[0].id;

    const floraVer = await db
      .insert(resourceVersions)
      .values({
        resource_id: testFloraResourceId,
        version: '1.0',
        status: 'published',
      })
      .returning();
    testFloraVersionId = floraVer[0].id;

    const realiaVer = await db
      .insert(resourceVersions)
      .values({
        resource_id: testRealiaResourceId,
        version: '1.0',
        status: 'published',
      })
      .returning();
    testRealiaVersionId = realiaVer[0].id;

    // Create 3 entries for each resource type
    const baseEntry = { source_language: 'en' };

    for (let i = 1; i <= 3; i++) {
      await db.insert(resourceEntries).values({
        resource_version_id: testFaunaVersionId,
        entry_key: `${TEST_MARKER}:FAUNA:${i}`,
        source_content: { title: `Fauna Entry ${i}`, key: `${TEST_MARKER}:FAUNA:${i}` },
        ...baseEntry,
      });

      await db.insert(resourceEntries).values({
        resource_version_id: testFloraVersionId,
        entry_key: `${TEST_MARKER}:FLORA:${i}`,
        source_content: { title: `Flora Entry ${i}`, key: `${TEST_MARKER}:FLORA:${i}` },
        ...baseEntry,
      });

      await db.insert(resourceEntries).values({
        resource_version_id: testRealiaVersionId,
        entry_key: `${TEST_MARKER}:REALIA:${i}`,
        source_content: { title: `Realia Entry ${i}`, key: `${TEST_MARKER}:REALIA:${i}` },
        ...baseEntry,
      });
    }
  });

  afterAll(async () => {
    // Cleanup: delete in reverse order to respect foreign keys
    await db.delete(resourceEntries).where(eq(resourceEntries.resource_version_id, testFaunaVersionId));
    await db.delete(resourceEntries).where(eq(resourceEntries.resource_version_id, testFloraVersionId));
    await db.delete(resourceEntries).where(eq(resourceEntries.resource_version_id, testRealiaVersionId));

    await db.delete(resourceVersions).where(eq(resourceVersions.resource_id, testFaunaResourceId));
    await db.delete(resourceVersions).where(eq(resourceVersions.resource_id, testFloraResourceId));
    await db.delete(resourceVersions).where(eq(resourceVersions.resource_id, testRealiaResourceId));

    await db.delete(resources).where(eq(resources.org_id, testOrgId));
    await db.delete(organizations).where(eq(organizations.id, testOrgId));
  });

  const filterTestEntries = (entries: any[]) =>
    entries.filter((e) => e.entryKey.includes(TEST_MARKER));

  it('returns only fauna test entries when filtering by ubs-fauna', async () => {
    const result = await fetchEntryListWithStatus(null, 'ml', [...ALL_TRANSLATION_STATUSES], 50, [
      'ubs-fauna',
    ]);
    const testEntries = filterTestEntries(result.entries);
    expect(testEntries).toHaveLength(3);
    expect(testEntries.every((e) => e.resourceSlug === 'ubs-fauna')).toBe(true);
    expect(testEntries.every((e) => e.entryKey.includes('FAUNA'))).toBe(true);
  });

  it('returns only flora test entries when filtering by ubs-flora', async () => {
    const result = await fetchEntryListWithStatus(null, 'ml', [...ALL_TRANSLATION_STATUSES], 50, [
      'ubs-flora',
    ]);
    const testEntries = filterTestEntries(result.entries);
    expect(testEntries).toHaveLength(3);
    expect(testEntries.every((e) => e.resourceSlug === 'ubs-flora')).toBe(true);
    expect(testEntries.every((e) => e.entryKey.includes('FLORA'))).toBe(true);
  });

  it('returns 0 entries when filtering by unknown slug', async () => {
    const result = await fetchEntryListWithStatus(null, 'ml', [...ALL_TRANSLATION_STATUSES], 50, [
      'ubs-unknown',
    ]);
    expect(result.entries).toHaveLength(0);
  });

  it('filters correctly by fauna slug with pagination', async () => {
    const result = await fetchEntryListWithStatus('1', 'ml', [...ALL_TRANSLATION_STATUSES], 50, [
      'ubs-fauna',
    ]);
    const testEntries = filterTestEntries(result.entries);
    expect(testEntries.length).toBeGreaterThan(0);
    expect(testEntries.every((e) => e.resourceSlug === 'ubs-fauna')).toBe(true);
  });

  it('combines resource filter with status filter correctly', async () => {
    const result = await fetchEntryListWithStatus(
      null,
      'ml',
      ['draft', 'approved'],
      50,
      ['ubs-fauna']
    );
    const testEntries = filterTestEntries(result.entries);
    expect(testEntries.every((e) => e.resourceSlug === 'ubs-fauna')).toBe(true);
  });

  it('resource slug matching is case-sensitive (lowercase stored)', async () => {
    const result = await fetchEntryListWithStatus(null, 'ml', [...ALL_TRANSLATION_STATUSES], 50, [
      'ubs-flora',
    ]);
    const testEntries = filterTestEntries(result.entries);
    expect(testEntries.length).toBeGreaterThan(0);
    expect(testEntries.every((e) => e.resourceSlug === 'ubs-flora')).toBe(true);
  });
});

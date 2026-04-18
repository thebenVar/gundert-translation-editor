import { describe, it, expect } from '@jest/globals';
import {
  buildEntryListQueryOptions,
  parseSearchFromQuery,
  detectReferenceFormat,
} from '@/lib/browser/entry-list';

describe('GH-003 API search query integration (Red Phase)', () => {
  it('adds normalized query into entry-list query options', () => {
    const search = parseSearchFromQuery('  lion  ');
    const options = buildEntryListQueryOptions({
      page: '1',
      lang: 'ml',
      status: ['untranslated', 'draft', 'ready_for_review', 'approved'],
      query: search,
    });

    expect(options.query).toBe('lion');
  });

  it('flags human-readable reference queries for reference search path', () => {
    const search = parseSearchFromQuery('John 3:16');
    const options = buildEntryListQueryOptions({
      page: '1',
      lang: 'ml',
      status: ['untranslated', 'draft', 'ready_for_review', 'approved'],
      query: search,
    });

    expect(options.referenceFormat).toBe('human');
  });

  it('flags USFM reference queries for reference search path', () => {
    const search = parseSearchFromQuery('JHN 3:16');
    const options = buildEntryListQueryOptions({
      page: '1',
      lang: 'ml',
      status: ['untranslated', 'draft', 'ready_for_review', 'approved'],
      query: search,
    });

    expect(options.referenceFormat).toBe('usfm');
  });

  it('flags mnemonic reference queries for reference search path', () => {
    const search = parseSearchFromQuery('04400301600005');
    const options = buildEntryListQueryOptions({
      page: '1',
      lang: 'ml',
      status: ['untranslated', 'draft', 'ready_for_review', 'approved'],
      query: search,
    });

    expect(options.referenceFormat).toBe('mnemonic');
  });

  it('keeps non-reference query as text search path', () => {
    expect(detectReferenceFormat('animals of burden')).toBe('text');
  });
});

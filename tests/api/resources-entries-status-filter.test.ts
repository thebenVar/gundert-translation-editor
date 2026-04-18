import { describe, it, expect } from '@jest/globals';
import {
  buildEntryListQueryOptions,
  parseStatusFromQuery,
} from '@/lib/browser/entry-list';

describe('GH-002 API status filter integration (Red Phase)', () => {
  it('builds query options with status filters from URL param', () => {
    const statuses = parseStatusFromQuery('draft,approved');
    const options = buildEntryListQueryOptions({
      page: '2',
      lang: 'ml',
      status: statuses,
    });

    expect(options.page).toBe(2);
    expect(options.targetLanguage).toBe('ml');
    expect(options.status).toEqual(['draft', 'approved']);
  });

  it('applies Needs Work quick-chip in query options', () => {
    const statuses = parseStatusFromQuery('needs_work');
    const options = buildEntryListQueryOptions({
      page: '1',
      lang: 'ml',
      status: statuses,
    });

    expect(options.status).toEqual(['untranslated', 'draft']);
  });
});

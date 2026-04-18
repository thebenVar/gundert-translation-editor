import { describe, it, expect } from '@jest/globals';
import {
  normalizeStatusFilters,
  parseStatusFromQuery,
  serializeStatusToQuery,
  expandNeedsWorkChip,
  ALL_TRANSLATION_STATUSES,
} from '@/lib/browser/entry-list';

describe('GH-002 / US-002 Filter by translation status (Red Phase)', () => {
  it('exposes translation status constants for filter UI', () => {
    expect(Array.isArray(ALL_TRANSLATION_STATUSES)).toBe(true);
    expect(ALL_TRANSLATION_STATUSES).toEqual([
      'untranslated',
      'draft',
      'ready_for_review',
      'approved',
    ]);
  });

  it('defaults to all statuses when query is missing', () => {
    expect(parseStatusFromQuery(null)).toEqual([
      'untranslated',
      'draft',
      'ready_for_review',
      'approved',
    ]);
  });

  it('supports single status in query', () => {
    expect(parseStatusFromQuery('draft')).toEqual(['draft']);
  });

  it('supports multi-status in query', () => {
    expect(parseStatusFromQuery('untranslated,draft')).toEqual(['untranslated', 'draft']);
  });

  it('maps Needs Work quick chip to untranslated + draft', () => {
    expect(expandNeedsWorkChip(['needs_work'])).toEqual(['untranslated', 'draft']);
  });

  it('ignores invalid status values safely', () => {
    expect(normalizeStatusFilters(['approved', 'invalid_status'])).toEqual(['approved']);
  });

  it('serializes active statuses into stable URL query order', () => {
    expect(serializeStatusToQuery(['draft', 'untranslated'])).toBe('status=untranslated,draft');
  });

  it('returns null query when all statuses are active', () => {
    expect(serializeStatusToQuery(['untranslated', 'draft', 'ready_for_review', 'approved'])).toBeNull();
  });
});

import { describe, it, expect } from '@jest/globals';
import {
  getResourcePriority,
  normalizeEntryListRow,
  parsePagination,
} from '@/lib/browser/entry-list';

describe('GH-001 / US-001 Browse entry list', () => {
  it('uses stable resource priority order', () => {
    expect(getResourcePriority('UBS')).toBeLessThan(getResourcePriority('SIL'));
    expect(getResourcePriority('SIL')).toBeLessThan(getResourcePriority('Unknown'));
  });

  it('parses default pagination as 50 entries per page', () => {
    const parsed = parsePagination(null);
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
    expect(parsed.offset).toBe(0);
  });

  it('normalizes invalid page numbers to page 1', () => {
    const parsed = parsePagination('-2');
    expect(parsed.page).toBe(1);
    expect(parsed.offset).toBe(0);
  });

  it('maps DB row into entry card fields required by acceptance criteria', () => {
    const row = {
      id: 'entry-1',
      entry_key: 'FAUNA:1.1',
      title: 'Domestic animals',
      resource_name: 'UBS FAUNA',
      translation_status: 'draft',
      updated_at: '2026-04-18T00:00:00.000Z',
    };

    const card = normalizeEntryListRow(row);

    expect(card.entryKey).toBe('FAUNA:1.1');
    expect(card.title).toBe('Domestic animals');
    expect(card.resourceBadge).toBe('UBS FAUNA');
    expect(card.matchType).toBe('browse');
    expect(card.translationStatus).toBe('draft');
    expect(card.updatedAt).toBe('2026-04-18T00:00:00.000Z');
  });

  it('defaults unknown translation status to untranslated', () => {
    const row = {
      id: 'entry-2',
      entry_key: 'FAUNA:1.2',
      title: 'Pack animals',
      resource_name: 'UBS FAUNA',
      translation_status: 'invalid_status',
      updated_at: '2026-04-18T00:00:00.000Z',
    };

    const card = normalizeEntryListRow(row);
    expect(card.translationStatus).toBe('untranslated');
  });
});

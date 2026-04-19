import { lexiconHrefWithResource, toggleResource, toggle, ALL_TRANSLATION_STATUSES, type TranslationStatus } from '@/lib/browser/lexicon-utils';

// ─── lexiconHrefWithResource (6 tests) ─────────────────────────────────────

describe('lexiconHrefWithResource', () => {
  it('builds basic URL with page and single resource', () => {
    const url = lexiconHrefWithResource(1, ['draft'], ['ubs-fauna']);
    expect(url).toBe('/lexicon?page=1&status=draft&resource=ubs-fauna');
  });

  it('builds URL with multiple resources (comma-separated)', () => {
    const url = lexiconHrefWithResource(1, ['draft'], ['ubs-fauna', 'ubs-flora']);
    expect(url).toBe('/lexicon?page=1&status=draft&resource=ubs-fauna,ubs-flora');
  });

  it('builds URL with multiple statuses (comma-separated, normalized order)', () => {
    const url = lexiconHrefWithResource(1, ['approved', 'draft'], ['ubs-fauna']);
    // serializeStatusToQuery normalizes to canonical order
    expect(url).toBe('/lexicon?page=1&status=draft,approved&resource=ubs-fauna');
  });

  it('encodes query parameter with special characters', () => {
    const url = lexiconHrefWithResource(1, ['draft'], ['ubs-fauna'], 'hello world & foo=bar');
    expect(url).toContain('q=hello%20world%20%26%20foo%3Dbar');
  });

  it('omits resource param when array is empty', () => {
    const url = lexiconHrefWithResource(1, ['draft'], []);
    expect(url).toBe('/lexicon?page=1&status=draft');
    expect(url).not.toContain('resource=');
  });

  it('omits status param when all statuses present (normalized behavior)', () => {
    const url = lexiconHrefWithResource(1, [...ALL_TRANSLATION_STATUSES], ['ubs-fauna']);
    // serializeStatusToQuery returns null when all statuses
    expect(url).toBe('/lexicon?page=1&resource=ubs-fauna');
    expect(url).not.toContain('status=');
  });

  it('handles multiple resources with multiple statuses and query', () => {
    const url = lexiconHrefWithResource(2, ['draft', 'ready_for_review'], ['ubs-fauna', 'ubs-flora', 'ubs-realia'], 'test');
    expect(url).toContain('page=2');
    expect(url).toContain('status=draft,ready_for_review');
    expect(url).toContain('resource=ubs-fauna,ubs-flora,ubs-realia');
    expect(url).toContain('q=test');
  });

  it('omits query param when null', () => {
    const url = lexiconHrefWithResource(1, ['draft'], ['ubs-fauna'], null);
    expect(url).not.toContain('q=');
  });

  it('omits query param when undefined', () => {
    const url = lexiconHrefWithResource(1, ['draft'], ['ubs-fauna']);
    expect(url).not.toContain('q=');
  });
});

// ─── toggleResource (3 tests) ──────────────────────────────────────────────

describe('toggleResource', () => {
  it('adds resource when not present', () => {
    const result = toggleResource(['ubs-fauna'], 'ubs-flora');
    expect(result).toEqual(['ubs-fauna', 'ubs-flora']);
  });

  it('removes resource when present', () => {
    const result = toggleResource(['ubs-fauna', 'ubs-flora'], 'ubs-fauna');
    expect(result).toEqual(['ubs-flora']);
  });

  it('adds to empty array', () => {
    const result = toggleResource([], 'ubs-fauna');
    expect(result).toEqual(['ubs-fauna']);
  });

  it('preserves order when toggling (add appends)', () => {
    const result = toggleResource(['ubs-fauna'], 'ubs-flora');
    expect(result[0]).toBe('ubs-fauna');
    expect(result[1]).toBe('ubs-flora');
  });

  it('preserves order when toggling (remove keeps others intact)', () => {
    const result = toggleResource(['ubs-fauna', 'ubs-flora', 'ubs-realia'], 'ubs-flora');
    expect(result).toEqual(['ubs-fauna', 'ubs-realia']);
  });
});

// ─── toggle (3 tests) ──────────────────────────────────────────────────────

describe('toggle', () => {
  it('adds status when not present', () => {
    const result = toggle(['draft'], 'approved');
    expect(result).toContain('draft');
    expect(result).toContain('approved');
  });

  it('removes status when present (normal case)', () => {
    const result = toggle(['draft', 'approved'], 'draft');
    expect(result).toEqual(['approved']);
  });

  it('resets to ALL statuses when removing last status', () => {
    const result = toggle(['draft'], 'draft');
    expect(result).toEqual([...ALL_TRANSLATION_STATUSES]);
  });

  it('handles toggle with multiple statuses in list', () => {
    const statuses: TranslationStatus[] = ['draft', 'approved', 'ready_for_review'];
    const result = toggle(statuses, 'untranslated');
    expect(result).toContain('draft');
    expect(result).toContain('untranslated');
  });

  it('reset behavior triggered only on last status removal', () => {
    // Two statuses - remove one
    const result = toggle(['draft', 'approved'], 'draft');
    expect(result).toEqual(['approved']); // NOT all statuses
    expect(result.length).toBe(1);
  });
});

// ─── Integration test ──────────────────────────────────────────────────────

describe('lexicon URL builders - integration', () => {
  it('simulates click fauna chip: toggle resource and navigate', () => {
    // Current state: no resources, draft status
    const currentUrl = lexiconHrefWithResource(1, ['draft'], []);
    expect(currentUrl).toBe('/lexicon?page=1&status=draft');

    // User clicks fauna chip - toggle adds it
    const afterClick = toggleResource([], 'ubs-fauna');
    const newUrl = lexiconHrefWithResource(1, ['draft'], afterClick);
    expect(newUrl).toBe('/lexicon?page=1&status=draft&resource=ubs-fauna');

    // User clicks fauna chip again - toggle removes it
    const afterSecondClick = toggleResource(afterClick, 'ubs-fauna');
    const finalUrl = lexiconHrefWithResource(1, ['draft'], afterSecondClick);
    expect(finalUrl).toBe('/lexicon?page=1&status=draft');
  });

  it('simulates click status button: toggle status and navigate', () => {
    // Current state: fauna resource, draft status only
    const currentUrl = lexiconHrefWithResource(1, ['draft'], ['ubs-fauna']);
    expect(currentUrl).toContain('status=draft');

    // User clicks "approved" status - toggle adds it (now 2 statuses)
    let statuses = toggle(['draft'], 'approved');
    expect(statuses).toEqual(['draft', 'approved']);
    let url = lexiconHrefWithResource(1, statuses, ['ubs-fauna']);
    expect(url).toContain('status=draft,approved');

    // User clicks "draft" status again - toggle removes it (now 1 status left)
    statuses = toggle(statuses, 'draft');
    expect(statuses).toEqual(['approved']); // Just approved, NOT reset yet
    url = lexiconHrefWithResource(1, statuses, ['ubs-fauna']);
    expect(url).toContain('status=approved');

    // User clicks "approved" status (the only one) - toggle removes last one, resets to all
    statuses = toggle(statuses, 'approved');
    expect(statuses).toEqual([...ALL_TRANSLATION_STATUSES]); // Reset to all
    url = lexiconHrefWithResource(1, statuses, ['ubs-fauna']);
    expect(url).not.toContain('status='); // All statuses = no status param
  });
});

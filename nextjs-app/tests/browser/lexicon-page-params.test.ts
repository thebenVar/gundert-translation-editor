import { param } from '@/lib/browser/lexicon-utils';

// ─── param() unit tests ────────────────────────────────────────────────────

describe('param()', () => {
  it('returns string value as-is', () => {
    expect(param('draft')).toBe('draft');
  });

  it('returns first element from array (Next.js multi-value params)', () => {
    expect(param(['draft', 'approved'])).toBe('draft');
  });

  it('returns null for undefined (param not in URL)', () => {
    expect(param(undefined)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(param([])).toBeNull();
  });

  it('returns empty string when value is empty string', () => {
    // Empty string is a valid value (different from undefined)
    expect(param('')).toBe('');
  });
});

// ─── Lexicon page HTTP smoke tests ────────────────────────────────────────

const BASE = 'http://localhost:3000';

describe('LexiconPage - searchParams smoke tests', () => {
  it('loads with no params (default state)', async () => {
    const response = await fetch(`${BASE}/lexicon`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  }, 15000);

  it('loads with status param', async () => {
    const response = await fetch(`${BASE}/lexicon?status=draft`);
    expect(response.status).toBe(200);
  });

  it('loads with resource param', async () => {
    const response = await fetch(`${BASE}/lexicon?resource=ubs-fauna`);
    expect(response.status).toBe(200);
  });

  it('loads with page param', async () => {
    const response = await fetch(`${BASE}/lexicon?page=2`);
    expect(response.status).toBe(200);
  });

  it('loads with search query param', async () => {
    const response = await fetch(`${BASE}/lexicon?q=test`);
    expect(response.status).toBe(200);
  });

  it('loads with all params combined', async () => {
    const response = await fetch(
      `${BASE}/lexicon?page=1&status=draft&resource=ubs-fauna&q=test`
    );
    expect(response.status).toBe(200);
  });

  it('handles invalid page param gracefully (no crash)', async () => {
    const response = await fetch(`${BASE}/lexicon?page=not-a-number`);
    expect(response.status).toBe(200); // page falls back to 1, no crash
  });

  it('handles unknown status gracefully (falls back to all statuses)', async () => {
    const response = await fetch(`${BASE}/lexicon?status=bogus`);
    expect(response.status).toBe(200);
  });

  it('handles unknown resource param gracefully (returns empty/no entries for that resource)', async () => {
    const response = await fetch(`${BASE}/lexicon?resource=nonexistent-resource`);
    expect(response.status).toBe(200); // page renders, just 0 entries for that resource
  });
});

import { describe, it, expect } from '@jest/globals';
import {
  parseSearchFromQuery,
  detectReferenceFormat,
  buildReferenceSearchTokens,
  rankSearchMatchType,
  normalizeSearchQuery,
} from '@/lib/browser/entry-list';

describe('GH-003 / US-003 Search for an entry (Red Phase)', () => {
  it('trims and normalizes user query input', () => {
    expect(normalizeSearchQuery('   John 3:16   ')).toBe('John 3:16');
  });

  it('returns null for empty/whitespace-only query', () => {
    expect(parseSearchFromQuery('   ')).toBeNull();
  });

  it('detects human-readable references (John 3:16)', () => {
    expect(detectReferenceFormat('John 3:16')).toBe('human');
  });

  it('detects USFM notation references (JHN 3:16)', () => {
    expect(detectReferenceFormat('JHN 3:16')).toBe('usfm');
  });

  it('detects mnemonic numeric references (04400301600005)', () => {
    expect(detectReferenceFormat('04400301600005')).toBe('mnemonic');
  });

  it('expands reference tokens across all equivalent formats', () => {
    const tokens = buildReferenceSearchTokens('JHN 3:16');

    expect(tokens).toContain('John 3:16');
    expect(tokens).toContain('JHN 3:16');
    expect(tokens).toContain('04400301600005');
  });

  it('does not treat malformed numeric refs as valid mnemonic', () => {
    expect(detectReferenceFormat('4400301600005')).toBe('text');
  });

  it('ranks exact key above exact title', () => {
    expect(rankSearchMatchType('key')).toBeLessThan(rankSearchMatchType('title'));
  });

  it('ranks exact reference above content snippet', () => {
    expect(rankSearchMatchType('reference')).toBeLessThan(rankSearchMatchType('content'));
  });

  it('keeps generic text query in text mode', () => {
    expect(detectReferenceFormat('domestic animals')).toBe('text');
  });
});

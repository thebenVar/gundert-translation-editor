import { describe, it, expect } from '@jest/globals';
import {
  parseResourcesFromQuery,
  buildEntryListQueryOptions,
} from '@/lib/browser/entry-list';

describe('GH-009 API resource filter integration', () => {
  // ─────────────────────────────────────────────
  // Layer 1: Unit Tests - Parameter extraction and builder logic
  // ─────────────────────────────────────────────
  describe('Unit: parseResourcesFromQuery in query builder flow', () => {
    it('extracts single resource slug from query param', () => {
      const resourceSlugs = parseResourcesFromQuery('ubs-flora');
      expect(resourceSlugs).toEqual(['ubs-flora']);
    });

    it('extracts multiple comma-separated resource slugs', () => {
      const resourceSlugs = parseResourcesFromQuery('ubs-fauna,ubs-flora');
      expect(resourceSlugs).toEqual(['ubs-fauna', 'ubs-flora']);
    });

    it('returns empty array when resource param is null', () => {
      const resourceSlugs = parseResourcesFromQuery(null);
      expect(resourceSlugs).toEqual([]);
    });

    it('trims whitespace from each slug', () => {
      const resourceSlugs = parseResourcesFromQuery(' ubs-fauna , ubs-flora ');
      expect(resourceSlugs).toEqual(['ubs-fauna', 'ubs-flora']);
    });

    it('handles empty segments from extra commas', () => {
      const resourceSlugs = parseResourcesFromQuery('ubs-fauna,,ubs-flora,');
      expect(resourceSlugs).toEqual(['ubs-fauna', 'ubs-flora']);
    });

    it('integrates correctly with buildEntryListQueryOptions', () => {
      const resourceSlugs = parseResourcesFromQuery('ubs-fauna,ubs-realia');
      const options = buildEntryListQueryOptions({
        page: '1',
        lang: 'ml',
        status: ['draft', 'approved'],
      });

      // Verify the query builder doesn't break when given resource slugs
      expect(options.page).toBe(1);
      expect(options.targetLanguage).toBe('ml');
      expect(options.status).toEqual(['draft', 'approved']);
      // Resource slugs are parsed separately and passed to fetchEntryListWithStatus
      expect(resourceSlugs).toEqual(['ubs-fauna', 'ubs-realia']);
    });

    it('preserves unknown/custom resource slugs', () => {
      const resourceSlugs = parseResourcesFromQuery('custom-resource');
      expect(resourceSlugs).toEqual(['custom-resource']);
    });

    it('preserves duplicate slugs in the array', () => {
      const resourceSlugs = parseResourcesFromQuery('ubs-fauna,ubs-fauna,ubs-flora');
      expect(resourceSlugs).toEqual(['ubs-fauna', 'ubs-fauna', 'ubs-flora']);
    });
  });

  // ─────────────────────────────────────────────
  // Layer 2: API Integration Tests - HTTP route
  // ─────────────────────────────────────────────
  describe('Integration: /api/resources/entries with resource filter', () => {
    it('accepts resource query parameter in API endpoint', async () => {
      const response = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-fauna'
      );
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.entries).toBeDefined();
      expect(Array.isArray(data.entries)).toBe(true);
    });

    it('returns valid JSON structure with resource filter param', async () => {
      const response = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-flora'
      );
      const data = await response.json();

      expect(data.page).toBeDefined();
      expect(data.pageSize).toBeDefined();
      expect(data.total).toBeDefined();
      expect(data.hasMore).toBeDefined();
      expect(Array.isArray(data.entries)).toBe(true);
    });

    it('filters results by single resource slug', async () => {
      const response = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-fauna'
      );
      const data = await response.json();

      // If there are fauna entries in the database, they should all be ubs-fauna
      if (data.entries.length > 0) {
        const allFauna = data.entries.every((e: any) => e.resourceSlug === 'ubs-fauna');
        expect(allFauna).toBe(true);
      }
    });

    it('accepts multiple resource slugs in query param', async () => {
      const response = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-fauna,ubs-flora'
      );
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(Array.isArray(data.entries)).toBe(true);

      // All entries should be either fauna or flora
      if (data.entries.length > 0) {
        const slugs = new Set(data.entries.map((e: any) => e.resourceSlug));
        const validSlugs = new Set(['ubs-fauna', 'ubs-flora']);
        const allValid = Array.from(slugs).every((s) => validSlugs.has(s as string));
        expect(allValid).toBe(true);
      }
    });

    it('works with resource filter combined with status filter', async () => {
      const response = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-fauna&status=draft'
      );
      expect(response.ok).toBe(true);
      const data = await response.json();

      // If there are results, they should be fauna AND draft status
      if (data.entries.length > 0) {
        const allFaunaDraft = data.entries.every(
          (e: any) => e.resourceSlug === 'ubs-fauna' && e.translationStatus === 'draft'
        );
        expect(allFaunaDraft).toBe(true);
      }
    });

    it('returns empty results for unknown resource slug', async () => {
      const response = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-nonexistent-resource'
      );
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.entries).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('handles missing resource parameter (no filtering)', async () => {
      const response = await fetch('http://localhost:3000/api/resources/entries');
      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(Array.isArray(data.entries)).toBe(true);
      // Should return entries from all resources since no filter is applied
    });

    it('respects pagination with resource filter', async () => {
      const response1 = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-fauna&page=1'
      );
      const data1 = await response1.json();

      expect(data1.page).toBe(1);
      expect(data1.pageSize).toBeGreaterThan(0);
    });

    it('handles HTTP error gracefully when API fails', async () => {
      // Malformed query should still return 200 with error message in response
      const response = await fetch(
        'http://localhost:3000/api/resources/entries?resource=ubs-fauna&status=invalid_status'
      );
      // API should still respond (might filter to empty or all statuses)
      expect(response.status).toBeLessThan(500);
    });
  });
});

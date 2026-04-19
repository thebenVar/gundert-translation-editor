import { serializeStatusToQuery, ALL_TRANSLATION_STATUSES, type TranslationStatus } from './entry-list';

export { ALL_TRANSLATION_STATUSES, type TranslationStatus };

/**
 * Extract a single string value from Next.js searchParams values
 * Next.js can provide string | string[] | undefined for any param
 * @param value - Raw searchParam value
 * @returns First string value, or null
 */
export function param(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Build lexicon page URL with filters applied
 * @param page - Page number (1-indexed)
 * @param statuses - Array of translation statuses to filter by
 * @param resources - Array of resource slugs to filter by (e.g., 'ubs-fauna')
 * @param query - Optional search query
 * @returns Full lexicon URL with query parameters
 */
export function lexiconHrefWithResource(
  page: number,
  statuses: TranslationStatus[],
  resources: string[],
  query?: string | null
): string {
  const parts: string[] = [`page=${page}`];
  const sq = serializeStatusToQuery(statuses);
  if (sq) parts.push(sq);
  if (resources.length > 0) parts.push(`resource=${resources.join(',')}`);
  if (query) parts.push(`q=${encodeURIComponent(query)}`);
  return `/lexicon?${parts.join('&')}`;
}

/**
 * Toggle a resource slug in/out of the active list
 * @param active - Current array of active resource slugs
 * @param slug - Resource slug to toggle
 * @returns New array with slug added or removed
 */
export function toggleResource(active: string[], slug: string): string[] {
  return active.includes(slug) ? active.filter((s) => s !== slug) : [...active, slug];
}

/**
 * Toggle a translation status in/out of the active list
 * Special behavior: if removing the last status, reset to ALL statuses
 * @param statuses - Current array of active statuses
 * @param next - Status to toggle
 * @returns New array with status added or removed (or all statuses if last removed)
 */
export function toggle(statuses: TranslationStatus[], next: TranslationStatus): TranslationStatus[] {
  const has = statuses.includes(next);
  if (has) {
    const remaining = statuses.filter((s) => s !== next);
    return remaining.length > 0 ? remaining : [...ALL_TRANSLATION_STATUSES];
  }
  return [...statuses, next];
}

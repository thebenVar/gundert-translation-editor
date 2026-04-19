'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { EntryListItem, TranslationStatus } from '@/lib/browser/entry-list';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  initialEntries: EntryListItem[];
  initialHasMore: boolean;
  initialPage: number;
  total: number;
  activeStatuses: TranslationStatus[];
  query: string | null;
  activeResources: string[];
};

const STATUS_LABELS: Record<TranslationStatus, string> = {
  untranslated: 'Untranslated',
  draft: 'Draft',
  ready_for_review: 'For Review',
  approved: 'Approved',
};

const STATUS_CHIP: Record<TranslationStatus, string> = {
  approved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  ready_for_review: 'bg-sky-100 text-sky-800 ring-sky-200',
  draft: 'bg-amber-100 text-amber-800 ring-amber-200',
  untranslated: 'bg-slate-100 text-slate-600 ring-slate-200',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LexiconInfiniteList({
  initialEntries,
  initialHasMore,
  initialPage,
  total,
  activeStatuses,
  query,
  activeResources,
}: Props) {
  const [entries, setEntries] = useState<EntryListItem[]>(initialEntries);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Track whether we're mid-load to avoid duplicate fetches
  const loadingRef = useRef(false);

  useEffect(() => {
    // Sync local list state when server-provided props change (filter/query navigation)
    setEntries(initialEntries);
    setPage(initialPage);
    setHasMore(initialHasMore);
    setError(null);
    loadingRef.current = false;
  }, [initialEntries, initialHasMore, initialPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({ page: String(nextPage) });
      if (activeStatuses.length > 0) {
        params.set('status', activeStatuses.join(','));
      }
      if (query) {
        params.set('q', query);
      }
      if (activeResources.length > 0) {
        params.set('resource', activeResources.join(','));
      }

      const res = await fetch(`/api/resources/entries?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setEntries((prev) => [...prev, ...(data.entries ?? [])]);
      setPage(data.page);
      setHasMore(data.hasMore ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more entries');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, hasMore, activeStatuses, query, activeResources]);

  // IntersectionObserver on the sentinel div
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (entries.length === 0 && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">
          {total === 0
            ? 'No entries found. Run the import first.'
            : 'No entries match the current filter.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/lexicon/${entry.resourceSlug}/${entry.resourceVersion}/${entry.entryKey}`}
            className="group flex items-start justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">
                  {entry.entryKey}
                </code>
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                  {entry.resourceBadge}
                </span>
              </div>
              <p className="truncate text-sm font-medium text-slate-900 group-hover:text-blue-700">
                {entry.title}
              </p>
            </div>

            <div className="ml-4 flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_CHIP[entry.translationStatus]}`}
              >
                {STATUS_LABELS[entry.translationStatus]}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(entry.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Sentinel + loading/error state */}
      <div ref={sentinelRef} className="mt-4 flex justify-center py-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg
              className="h-4 w-4 animate-spin text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            Loading more…
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <span>{error}</span>
            <button
              onClick={loadMore}
              className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}
        {!hasMore && !loading && entries.length > 0 && (
          <p className="text-xs text-slate-400">
            All {total.toLocaleString()} entries loaded
          </p>
        )}
      </div>
    </>
  );
}

import Link from 'next/link';
import {
  ALL_TRANSLATION_STATUSES,
  fetchEntryListWithStatus,
  parseStatusFromQuery,
  serializeStatusToQuery,
  type TranslationStatus,
} from '@/lib/browser/entry-list';

type BrowserPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const STATUS_LABELS: Record<TranslationStatus, string> = {
  untranslated: 'Untranslated',
  draft: 'Draft',
  ready_for_review: 'Ready for Review',
  approved: 'Approved',
};

function statusBgClass(status: TranslationStatus): string {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-900';
  if (status === 'ready_for_review') return 'bg-sky-100 text-sky-900';
  if (status === 'draft') return 'bg-amber-100 text-amber-900';
  return 'bg-slate-200 text-slate-900';
}

function normalizeSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildBrowserHref(page: number, statuses: TranslationStatus[]): string {
  const queryParts = [`page=${page}`];
  const statusQuery = serializeStatusToQuery(statuses);
  if (statusQuery) queryParts.push(statusQuery);
  return `/browser?${queryParts.join('&')}`;
}

function toggleStatus(statuses: TranslationStatus[], nextStatus: TranslationStatus): TranslationStatus[] {
  const has = statuses.includes(nextStatus);
  if (has) {
    const remaining = statuses.filter((status) => status !== nextStatus);
    return remaining.length > 0 ? remaining : [...ALL_TRANSLATION_STATUSES];
  }

  return [...statuses, nextStatus];
}

function getNeedsWorkStatuses(): TranslationStatus[] {
  return ['untranslated', 'draft'];
}

function hasNeedsWork(statuses: TranslationStatus[]): boolean {
  const target = getNeedsWorkStatuses();
  return target.every((status) => statuses.includes(status));
}

export default async function BrowserPage({ searchParams }: BrowserPageProps) {
  const pageParam = normalizeSearchParam(searchParams?.page);
  const statusParam = normalizeSearchParam(searchParams?.status);
  const activeStatuses = parseStatusFromQuery(statusParam);

  const result = await fetchEntryListWithStatus(pageParam, 'ml', activeStatuses, 50).catch(() => ({
    entries: [],
    page: 1,
    pageSize: 50,
    total: 0,
    hasMore: false,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Resource Browser</h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse imported entries across all resources ({result.total} total)
        </p>
      </header>

      <section className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="translation-status-filter-mobile">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Status filters</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildBrowserHref(1, getNeedsWorkStatuses())}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              hasNeedsWork(activeStatuses)
                ? 'border-amber-300 bg-amber-100 text-amber-900'
                : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            Needs Work
          </Link>
          {ALL_TRANSLATION_STATUSES.map((status) => {
            const active = activeStatuses.includes(status);
            return (
              <Link
                key={`mobile-${status}`}
                href={buildBrowserHref(1, toggleStatus(activeStatuses, status))}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                {STATUS_LABELS[status]}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-label="entry-list">
        {result.entries.map((entry) => (
          <article
            key={entry.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                {entry.entryKey}
              </span>
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                {entry.resourceBadge}
              </span>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                {entry.matchType}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBgClass(entry.translationStatus)}`}>
                {STATUS_LABELS[entry.translationStatus]}
              </span>
            </div>

            <h2 className="text-base font-medium text-slate-900">{entry.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Updated {new Date(entry.updatedAt).toLocaleDateString()}
            </p>
          </article>
        ))}

        {result.entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
            No entries found. Run import first or check database connectivity.
          </div>
        ) : null}
      </section>

      <footer className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Page {result.page} · Showing up to {result.pageSize} entries
        </p>
        {result.hasMore ? (
          <Link
            href={buildBrowserHref(result.page + 1, activeStatuses)}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Load more
          </Link>
        ) : (
          <span className="text-xs text-slate-400">End of results</span>
        )}
      </footer>
    </main>
  );
}

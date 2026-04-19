import Link from 'next/link';
import {
  ALL_TRANSLATION_STATUSES,
  fetchEntryListWithStatus,
  parseStatusFromQuery,
  serializeStatusToQuery,
  type TranslationStatus,
} from '@/lib/browser/entry-list';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function param(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function lexiconHref(page: number, statuses: TranslationStatus[], query?: string | null): string {
  const parts: string[] = [`page=${page}`];
  const sq = serializeStatusToQuery(statuses);
  if (sq) parts.push(sq);
  if (query) parts.push(`q=${encodeURIComponent(query)}`);
  return `/lexicon?${parts.join('&')}`;
}

function toggle(statuses: TranslationStatus[], next: TranslationStatus): TranslationStatus[] {
  const has = statuses.includes(next);
  if (has) {
    const remaining = statuses.filter((s) => s !== next);
    return remaining.length > 0 ? remaining : [...ALL_TRANSLATION_STATUSES];
  }
  return [...statuses, next];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LexiconPage({ searchParams }: PageProps) {
  const pageParam = param(searchParams?.page);
  const statusParam = param(searchParams?.status);
  const queryParam = param(searchParams?.q);
  const activeStatuses = parseStatusFromQuery(statusParam);

  const result = await fetchEntryListWithStatus(pageParam, 'ml', activeStatuses, 50).catch(() => ({
    entries: [],
    page: 1,
    pageSize: 50,
    total: 0,
    hasMore: false,
  }));

  const isFiltered = activeStatuses.length < ALL_TRANSLATION_STATUSES.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ── */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-600 transition text-sm">
              ← Home
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Lexicon</h1>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {result.total.toLocaleString()} entries
            </span>
          </div>

          {/* Search box — wired in US-007 */}
          <form method="GET" action="/lexicon" className="hidden sm:flex flex-1 max-w-sm">
            <div className="relative w-full">
              <input
                type="search"
                name="q"
                defaultValue={queryParam ?? ''}
                placeholder="Search entries, titles, references…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* ── Status filter chips ── */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">Filter:</span>

          {/* All / reset chip */}
          <Link
            href="/lexicon"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              !isFiltered
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            All
          </Link>

          {/* Needs Work shortcut */}
          <Link
            href={lexiconHref(1, ['untranslated', 'draft'])}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeStatuses.length === 2 &&
              activeStatuses.includes('untranslated') &&
              activeStatuses.includes('draft')
                ? 'border-amber-500 bg-amber-100 text-amber-900'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            Needs Work
          </Link>

          <span className="text-slate-200">|</span>

          {ALL_TRANSLATION_STATUSES.map((status) => {
            const active = activeStatuses.includes(status);
            return (
              <Link
                key={status}
                href={lexiconHref(1, toggle(activeStatuses, status))}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ring-1 ${
                  active
                    ? `${STATUS_CHIP[status]} ring-current`
                    : 'border-slate-300 bg-white text-slate-600 ring-transparent hover:border-slate-400'
                }`}
              >
                {STATUS_LABELS[status]}
              </Link>
            );
          })}
        </div>

        {/* ── Entry list ── */}
        {result.entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">
              {result.total === 0
                ? 'No entries found. Run the import first.'
                : 'No entries match the current filter.'}
            </p>
            {isFiltered && (
              <Link href="/lexicon" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {result.entries.map((entry) => (
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_CHIP[entry.translationStatus]}`}>
                    {STATUS_LABELS[entry.translationStatus]}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {result.page} · {result.entries.length} of {result.total.toLocaleString()} entries
          </p>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={lexiconHref(result.page - 1, activeStatuses, queryParam)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Previous
              </Link>
            )}
            {result.hasMore && (
              <Link
                href={lexiconHref(result.page + 1, activeStatuses, queryParam)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

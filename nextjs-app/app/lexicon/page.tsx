import Link from 'next/link';
import {
  ALL_TRANSLATION_STATUSES,
  fetchEntryListWithStatus,
  parseStatusFromQuery,
  parseResourcesFromQuery,
  serializeStatusToQuery,
  type TranslationStatus,
} from '@/lib/browser/entry-list';
import { lexiconHrefWithResource, toggleResource, toggle, param } from '@/lib/browser/lexicon-utils';
import LexiconInfiniteList from './LexiconInfiniteList';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// ─── Resource definitions ─────────────────────────────────────────────────────

const ALL_RESOURCES = [
  { slug: 'ubs-fauna', label: 'Fauna' },
  { slug: 'ubs-flora', label: 'Flora' },
  { slug: 'ubs-realia', label: 'Realia' },
] as const;

type ResourceSlug = (typeof ALL_RESOURCES)[number]['slug'];

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

function lexiconHref(page: number, statuses: TranslationStatus[], query?: string | null): string {
  const parts: string[] = [`page=${page}`];
  const sq = serializeStatusToQuery(statuses);
  if (sq) parts.push(sq);
  if (query) parts.push(`q=${encodeURIComponent(query)}`);
  return `/lexicon?${parts.join('&')}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LexiconPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const pageParam = param(resolvedSearchParams.page);
  const statusParam = param(resolvedSearchParams.status);
  const queryParam = param(resolvedSearchParams.q);
  const resourceParam = param(resolvedSearchParams.resource);
  const activeStatuses = parseStatusFromQuery(statusParam);
  const activeResources = parseResourcesFromQuery(resourceParam);

  const result = await fetchEntryListWithStatus(pageParam, 'ml', activeStatuses, 50, activeResources).catch(() => ({
    entries: [],
    page: 1,
    pageSize: 50,
    total: 0,
    hasMore: false,
  }));

  const isFiltered = activeStatuses.length < ALL_TRANSLATION_STATUSES.length;
  void isFiltered; // used only in filter chips section

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
          <span className="text-xs font-medium text-slate-500 mr-1">Status:</span>

          {/* All / reset chip */}
          <Link
            href="/lexicon"
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeStatuses.length === ALL_TRANSLATION_STATUSES.length && activeResources.length === 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            All
          </Link>

          {/* Needs Work shortcut */}
          <Link
            href={lexiconHrefWithResource(1, ['untranslated', 'draft'], activeResources, queryParam)}
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
                href={lexiconHrefWithResource(1, toggle(activeStatuses, status), activeResources, queryParam)}
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

        {/* ── Resource filter chips ── */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">Source:</span>
          <Link
            href={lexiconHrefWithResource(1, activeStatuses, [], queryParam)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeResources.length === 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            All
          </Link>
          {ALL_RESOURCES.map(({ slug, label }) => {
            const active = activeResources.includes(slug);
            return (
              <Link
                key={slug}
                href={lexiconHrefWithResource(1, activeStatuses, toggleResource(activeResources, slug), queryParam)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* ── Entry list (infinite scroll) ── */}
        <LexiconInfiniteList
          initialEntries={result.entries}
          initialHasMore={result.hasMore}
          initialPage={result.page}
          total={result.total}
          activeStatuses={activeStatuses}
          query={queryParam}
          activeResources={activeResources}
        />
      </div>
    </div>
  );
}

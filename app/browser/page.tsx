import Link from 'next/link';
import { fetchEntryList } from '@/lib/browser/entry-list';

type BrowserPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function BrowserPage({ searchParams }: BrowserPageProps) {
  const pageParam = searchParams?.page;
  const page = Array.isArray(pageParam) ? pageParam[0] : pageParam ?? '1';

  const result = await fetchEntryList(page, 'ml', 50).catch(() => ({
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
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                {entry.translationStatus}
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
            href={`/browser?page=${result.page + 1}`}
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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  fetchEntryBySlugVersionKey,
  type TranslationStatus,
} from '@/lib/browser/entry-list';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  params: { resource: string; version: string; key: string };
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EntryDetailPage({ params }: PageProps) {
  const { resource, version, key } = params;

  const entry = await fetchEntryBySlugVersionKey(resource, version, key).catch(() => null);

  if (!entry) notFound();

  const sc = entry.sourceContent;
  const sections = Array.isArray(sc?.sections) ? sc.sections : [];
  const bibleRefs = Array.isArray(sc?.bibleReferences) ? sc.bibleReferences : [];
  const indexItems = Array.isArray(sc?.index) ? sc.index : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ── */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link href="/lexicon" className="text-sm text-slate-400 hover:text-slate-600 transition">
            ← Lexicon
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
              {entry.entryKey}
            </code>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {entry.resourceName}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              v{entry.resourceVersion}
            </span>
          </div>
          <div className="ml-auto">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_CHIP[entry.translationStatus]}`}>
              {STATUS_LABELS[entry.translationStatus]}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* ── Title + meta ── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{sc?.title ?? entry.entryKey}</h1>
          {sc?.intro && (
            <p className="mt-2 text-sm text-slate-600 italic">{sc.intro}</p>
          )}
        </div>

        {/* ── Sections ── */}
        {sections.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Content
            </h2>
            <div className="space-y-5">
              {sections.map((section: any, i: number) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  {section.heading && (
                    <h3 className="mb-1 text-base font-semibold text-slate-900">
                      {section.heading}
                    </h3>
                  )}
                  {section.subheading && (
                    <p className="mb-2 text-sm font-medium text-slate-600">{section.subheading}</p>
                  )}
                  {Array.isArray(section.paragraphs) && section.paragraphs.length > 0 && (
                    <div className="space-y-2">
                      {section.paragraphs.map((para: string, j: number) => (
                        <p key={j} className="text-sm leading-relaxed text-slate-700">
                          {para}
                        </p>
                      ))}
                    </div>
                  )}
                  {(section.type || section.content) && (
                    <div className="mt-3 flex gap-2">
                      {section.type && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          {section.type}
                        </span>
                      )}
                      {section.content && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          {section.content}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Bible references ── */}
        {bibleRefs.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Bible References ({bibleRefs.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {bibleRefs.map((ref: string, i: number) => (
                <span
                  key={i}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-mono text-slate-600"
                >
                  {ref}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Index ── */}
        {indexItems.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Index
            </h2>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
              {indexItems.map((item: any, i: number) => (
                <li key={i} className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  {item.target && (
                    <code className="text-xs font-mono text-slate-400">{item.target}</code>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Metadata footer ── */}
        <footer className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 space-y-1">
          <div className="flex gap-6">
            <span>Source language: <strong className="text-slate-700">{entry.sourceLanguage}</strong></span>
            <span>Updated: <strong className="text-slate-700">{new Date(entry.updatedAt).toLocaleDateString()}</strong></span>
            {sc?.metadata?.checksum && (
              <span>Checksum: <code className="font-mono text-slate-400">{sc.metadata.checksum.slice(0, 12)}…</code></span>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

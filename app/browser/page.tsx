import { redirect } from 'next/navigation';

// /browser has been renamed to /lexicon
export default function BrowserPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  if (searchParams?.page) qs.set('page', String(searchParams.page));
  if (searchParams?.status) qs.set('status', String(searchParams.status));
  if (searchParams?.q) qs.set('q', String(searchParams.q));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  redirect(`/lexicon${suffix}`);
}
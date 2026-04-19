import { NextResponse } from 'next/server';
import {
  buildEntryListQueryOptions,
  fetchEntryListWithStatus,
  parseStatusFromQuery,
  parseResourcesFromQuery,
} from '@/lib/browser/entry-list';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const options = buildEntryListQueryOptions({
    page: searchParams.get('page'),
    lang: searchParams.get('lang'),
    status: parseStatusFromQuery(searchParams.get('status')),
    pageSize: 50,
  });
  const resourceSlugs = parseResourcesFromQuery(searchParams.get('resource'));

  try {
    const result = await fetchEntryListWithStatus(
      options.pageParam,
      options.targetLanguage,
      options.status,
      options.pageSize,
      resourceSlugs
    );

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        entries: [],
        page: 1,
        pageSize: 50,
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Failed to load entries',
      },
      { status: 500 }
    );
  }
}

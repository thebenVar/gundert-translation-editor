import { NextResponse } from 'next/server';
import { fetchEntryList } from '@/lib/browser/entry-list';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page');
  const lang = searchParams.get('lang') ?? 'ml';

  try {
    const result = await fetchEntryList(page, lang, 50);

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

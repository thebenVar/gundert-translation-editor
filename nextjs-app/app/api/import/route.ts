import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { importUBSResource, type ResourceName } from '@/lib/importer/ubs-xml-importer';

const VALID_RESOURCES: ResourceName[] = ['FAUNA', 'FLORA', 'REALIA'];

export async function POST(request: NextRequest) {
  // Require authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { resource?: unknown; version?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { resource, version } = body;

  if (!resource || !VALID_RESOURCES.includes(resource as ResourceName)) {
    return NextResponse.json(
      { error: `Invalid resource. Must be one of: ${VALID_RESOURCES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const result = await importUBSResource({
      resource: resource as ResourceName,
      version: typeof version === 'string' ? version : '1.0',
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[IMPORT] Error:', error);
    return NextResponse.json(
      {
        error: 'Import failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/** Trigger all three resources in sequence — convenience endpoint for initial setup */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = [];
  const errors = [];

  for (const resource of VALID_RESOURCES) {
    try {
      const result = await importUBSResource({ resource });
      results.push(result);
      console.log(
        `[IMPORT] ${resource}: inserted=${result.inserted}, updated=${result.updated}, total=${result.total}`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push({ resource, error: msg });
      console.error(`[IMPORT] ${resource} failed:`, msg);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    results,
    errors,
  });
}

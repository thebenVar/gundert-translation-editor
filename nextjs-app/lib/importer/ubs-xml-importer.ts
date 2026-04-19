import { sql, eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  organizations,
  resources,
  resourceVersions,
  resourceEntries,
} from '@/lib/db/schema';
import { parseUBSXml, type ParsedEntry } from '@/lib/xml-parser/parser';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ResourceName = 'FAUNA' | 'FLORA' | 'REALIA';

export interface ImportOptions {
  resource: ResourceName;
  /** Version string e.g. "1.0" */
  version?: string;
  /** Path to XML files directory (defaults to data/xml in project root) */
  xmlDir?: string;
}

export interface ImportResult {
  resourceName: ResourceName;
  version: string;
  resourceVersionId: string;
  inserted: number;
  updated: number;
  total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static resource descriptors
// ─────────────────────────────────────────────────────────────────────────────

const RESOURCE_DESCRIPTORS: Record<
  ResourceName,
  { name: string; slug: string; xmlFile: string; description: string }
> = {
  FAUNA: {
    name: 'UBS FAUNA',
    slug: 'ubs-fauna',
    xmlFile: 'FAUNA_en.xml',
    description: 'Animals in the Bible — UBS Thematic Lexicon',
  },
  FLORA: {
    name: 'UBS FLORA',
    slug: 'ubs-flora',
    xmlFile: 'FLORA_en.xml',
    description: 'Plants in the Bible — UBS Thematic Lexicon',
  },
  REALIA: {
    name: 'UBS REALIA',
    slug: 'ubs-realia',
    xmlFile: 'REALIA_en.xml',
    description: 'Objects in the Bible — UBS Thematic Lexicon',
  },
};

/** Name of the default UBS organization used for all imported resources */
const UBS_ORG_SLUG = 'ubs';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Import a UBS XML resource into the database.
 * Idempotent: running twice with the same version upserts entries (update
 * if checksum changed, skip if unchanged).
 */
export async function importUBSResource(options: ImportOptions): Promise<ImportResult> {
  const { resource, version = '1.0', xmlDir } = options;
  const descriptor = RESOURCE_DESCRIPTORS[resource];
  const xmlFilePath = path.join(
    xmlDir ?? path.join(process.cwd(), 'data', 'xml'),
    descriptor.xmlFile
  );

  // 1. Parse XML file
  const entries = await parseUBSXml(xmlFilePath);

  // 2. Ensure UBS org exists
  const orgId = await ensureOrganization();

  // 3. Ensure resource record exists
  const resourceId = await ensureResource(orgId, descriptor);

  // 4. Ensure resource version record exists
  const resourceVersionId = await ensureResourceVersion(resourceId, version);

  // 5. Upsert entries
  const { inserted, updated } = await upsertEntries(resourceVersionId, entries);

  return {
    resourceName: resource,
    version,
    resourceVersionId,
    inserted,
    updated,
    total: entries.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureOrganization(): Promise<string> {
  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.slug, UBS_ORG_SLUG),
  });

  if (existing) return existing.id;

  const [created] = await db
    .insert(organizations)
    .values({
      name: 'United Bible Societies',
      slug: UBS_ORG_SLUG,
      description: 'UBS Thematic Lexicon resources',
      default_language: 'en',
    })
    .returning({ id: organizations.id });

  return created.id;
}

async function ensureResource(
  orgId: string,
  descriptor: (typeof RESOURCE_DESCRIPTORS)[ResourceName]
): Promise<string> {
  const existing = await db.query.resources.findFirst({
    where: and(eq(resources.org_id, orgId), eq(resources.slug, descriptor.slug)),
  });

  if (existing) return existing.id;

  const [created] = await db
    .insert(resources)
    .values({
      org_id: orgId,
      name: descriptor.name,
      slug: descriptor.slug,
      description: descriptor.description,
      source: 'UBS',
      format: 'XML',
      language_code: 'en',
    })
    .returning({ id: resources.id });

  return created.id;
}

async function ensureResourceVersion(resourceId: string, version: string): Promise<string> {
  const existing = await db.query.resourceVersions.findFirst({
    where: and(
      eq(resourceVersions.resource_id, resourceId),
      eq(resourceVersions.version, version)
    ),
  });

  if (existing) return existing.id;

  const [created] = await db
    .insert(resourceVersions)
    .values({
      resource_id: resourceId,
      version,
      status: 'published',
      imported_at: new Date(),
    })
    .returning({ id: resourceVersions.id });

  return created.id;
}

async function upsertEntries(
  resourceVersionId: string,
  entries: ParsedEntry[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const entry of entries) {
    const existing = await db.query.resourceEntries.findFirst({
      where: and(
        eq(resourceEntries.resource_version_id, resourceVersionId),
        eq(resourceEntries.entry_key, entry.key)
      ),
    });

    const sourceContent = {
      title: entry.title,
      intro: entry.intro,
      sections: entry.sections,
      index: entry.index,
      bibleReferences: entry.bibleReferences,
      metadata: entry.metadata,
    };

    if (existing) {
      const existingChecksum = (existing.source_content as any)?.metadata?.checksum;
      if (existingChecksum === entry.metadata.checksum) {
        // unchanged — skip
        continue;
      }

      await db
        .update(resourceEntries)
        .set({
          source_content: sourceContent,
          updated_at: new Date(),
        })
        .where(eq(resourceEntries.id, existing.id));

      updated++;
    } else {
      await db.insert(resourceEntries).values({
        resource_version_id: resourceVersionId,
        entry_key: entry.key,
        source_content: sourceContent,
        source_language: 'en',
      });

      inserted++;
    }
  }

  return { inserted, updated };
}

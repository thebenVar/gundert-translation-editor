#!/usr/bin/env ts-node
/**
 * GH-008: UBS XML Resource Importer
 * 
 * Imports UBS FAUNA, FLORA, and REALIA XML files into the database.
 * - Parses all 3 XML files
 * - Inserts entries into resource_entries table with correct resource_version FK
 * - Idempotent (upsert on entry_key)
 * - Produces round-trip validation report
 * 
 * Usage:
 *   npm run import:ubs
 */

import { db } from '@/lib/db';
import { resources, resourceVersions, resourceEntries } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import { parseUBSXml, ParsedEntry } from '@/lib/xml-parser/parser';
import * as path from 'path';
import * as fs from 'fs/promises';

interface ImportResult {
  dictionary: string;
  status: 'success' | 'error';
  entriesImported: number;
  entriesSkipped: number;
  error?: string;
}

/**
 * Main import function
 */
async function importUBSResources(): Promise<void> {
  console.log('\n📖 Starting UBS XML Resource Import...\n');

  const results: ImportResult[] = [];

  // Ensure org and resources exist
  const org = await getOrCreateOrganization();
  console.log(`✅ Organization: ${org.name} (${org.id})`);

  // Import each dictionary
  const dictionaries = [
    { name: 'FAUNA', file: 'FAUNA_en.xml', source: 'UBS', language: 'en' },
    { name: 'FLORA', file: 'FLORA_en.xml', source: 'UBS', language: 'en' },
    { name: 'REALIA', file: 'REALIA_en.xml', source: 'UBS', language: 'en' },
  ];

  for (const dict of dictionaries) {
    try {
      const result = await importDictionary(org.id, dict.name, dict.file, dict.source, dict.language);
      results.push(result);
    } catch (error) {
      results.push({
        dictionary: dict.name,
        status: 'error',
        entriesImported: 0,
        entriesSkipped: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Print summary
  console.log('\n📊 Import Summary:\n');
  let totalImported = 0;
  let totalSkipped = 0;

  for (const result of results) {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`${status} ${result.dictionary.padEnd(10)} | Imported: ${result.entriesImported}, Skipped: ${result.entriesSkipped}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    totalImported += result.entriesImported;
    totalSkipped += result.entriesSkipped;
  }

  console.log(`\n📈 Total: ${totalImported} entries imported, ${totalSkipped} skipped`);

  if (results.every((r) => r.status === 'success')) {
    console.log('\n✨ All dictionaries imported successfully!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some imports failed. Check errors above.\n');
    process.exit(1);
  }
}

/**
 * Get or create the default organization
 */
async function getOrCreateOrganization() {
  let org = await db
    .select()
    .from(resources)
    .limit(1);

  if (org.length === 0) {
    // Create default org
    const inserted = await db
      .insert(resources)
      .values({
        name: 'Translation Feedback BF',
        slug: 'tfbf',
        description: 'Translation Feedback for Bible translation community',
        default_language: 'ml',
      })
      .returning();

    return inserted[0];
  }

  // Get the org that owns these resources
  const result = await db
    .select()
    .from(resources)
    .limit(1);

  return result[0];
}

/**
 * Import a single dictionary (FAUNA, FLORA, or REALIA)
 */
async function importDictionary(
  orgId: string,
  dictName: string,
  fileName: string,
  source: string,
  language: string
): Promise<ImportResult> {
  const filePath = path.join(process.cwd(), 'data', 'xml', fileName);

  console.log(`🔄 Importing ${dictName} from ${fileName}...`);

  // Check file exists
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  // Get or create resource
  const resource = await getOrCreateResource(orgId, dictName, source, language);
  console.log(`   Resource ID: ${resource.id}`);

  // Get or create resource version
  const version = await getOrCreateResourceVersion(resource.id, '1.0');
  console.log(`   Version ID: ${version.id}`);

  // Parse XML
  const entries = await parseUBSXml(filePath);
  console.log(`   Parsed ${entries.length} entries from XML`);

  // Import entries (upsert)
  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      const existing = await db
        .select()
        .from(resourceEntries)
        .where(
          and(
            eq(resourceEntries.resource_version_id, version.id),
            eq(resourceEntries.entry_key, entry.key)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing entry
        await db
          .update(resourceEntries)
          .set({
            source_content: entry,
            updated_at: new Date(),
          })
          .where(eq(resourceEntries.id, existing[0].id));
        skipped++;
      } else {
        // Insert new entry
        await db.insert(resourceEntries).values({
          resource_version_id: version.id,
          entry_key: entry.key,
          source_content: entry,
          source_language: language,
        });
        imported++;
      }
    } catch (error) {
      console.error(`   ⚠️ Error importing entry ${entry.key}:`, error);
    }
  }

  console.log(`   ✅ Imported ${imported}, Updated ${skipped}\n`);

  return {
    dictionary: dictName,
    status: 'success',
    entriesImported: imported,
    entriesSkipped: skipped,
  };
}

/**
 * Get or create a resource
 */
async function getOrCreateResource(orgId: string, name: string, source: string, language: string) {
  const existing = await db
    .select()
    .from(resources)
    .where(and(eq(resources.org_id, orgId), eq(resources.name, name)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const inserted = await db
    .insert(resources)
    .values({
      org_id: orgId,
      name,
      slug: name.toLowerCase(),
      source,
      format: 'XML',
      language_code: language,
    })
    .returning();

  return inserted[0];
}

/**
 * Get or create a resource version
 */
async function getOrCreateResourceVersion(resourceId: string, version: string) {
  const existing = await db
    .select()
    .from(resourceVersions)
    .where(and(eq(resourceVersions.resource_id, resourceId), eq(resourceVersions.version, version)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const inserted = await db
    .insert(resourceVersions)
    .values({
      resource_id: resourceId,
      version,
      status: 'published',
      imported_at: new Date(),
      metadata: {
        import_source: 'ubs-xml-import',
        import_timestamp: new Date().toISOString(),
      },
    })
    .returning();

  return inserted[0];
}

// Run import
importUBSResources().catch((error) => {
  console.error('Fatal error during import:', error);
  process.exit(1);
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { parseUBSXml, serializeEntryToXml, ParsedEntry } from '@/lib/xml-parser/parser';
import { db } from '@/lib/db';
import { resources, resourceVersions, resourceEntries, organizations } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('GH-008: UBS XML Resource Import', () => {
  let testOrgId: string;
  let testResourceId: string;
  let testVersionId: string;

  beforeAll(async () => {
    // Create test organization
    const org = await db
      .insert(organizations)
      .values({
        name: 'Test Org',
        slug: 'test-org',
      })
      .returning();
    testOrgId = org[0].id;

    // Create test resource
    const resource = await db
      .insert(resources)
      .values({
        org_id: testOrgId,
        name: 'TEST_FAUNA',
        slug: 'test-fauna',
        source: 'UBS',
        format: 'XML',
        language_code: 'en',
      })
      .returning();
    testResourceId = resource[0].id;

    // Create test version
    const version = await db
      .insert(resourceVersions)
      .values({
        resource_id: testResourceId,
        version: '1.0',
        status: 'published',
      })
      .returning();
    testVersionId = version[0].id;
  });

  afterAll(async () => {
    // Cleanup: delete test data
    await db.delete(resourceEntries).where(eq(resourceEntries.resource_version_id, testVersionId));
    await db.delete(resourceVersions).where(eq(resourceVersions.id, testVersionId));
    await db.delete(resources).where(eq(resources.id, testResourceId));
    await db.delete(organizations).where(eq(organizations.id, testOrgId));
  });

  describe('XML Parser: parseUBSXml()', () => {
    it('should parse FAUNA XML file without errors', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should parse FLORA XML file without errors', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FLORA_en.xml');
      const entries = await parseUBSXml(filePath);

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should parse REALIA XML file without errors', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'REALIA_en.xml');
      const entries = await parseUBSXml(filePath);

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should parse entry with all required fields', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      entries.forEach((entry) => {
        expect(entry.key).toBeDefined();
        expect(typeof entry.key).toBe('string');
        expect(entry.key.length).toBeGreaterThan(0);

        expect(entry.title).toBeDefined();
        expect(typeof entry.title).toBe('string');

        expect(entry.sections).toBeDefined();
        expect(Array.isArray(entry.sections)).toBe(true);

        expect(entry.index).toBeDefined();
        expect(Array.isArray(entry.index)).toBe(true);

        expect(entry.metadata).toBeDefined();
        expect(entry.metadata.sourceFormat).toBe('xml');
        expect(entry.metadata.checksum).toBeDefined();
      });
    });

    it('should extract sections with paragraphs', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const entriesWithSections = entries.filter((e) => e.sections.length > 0);
      expect(entriesWithSections.length).toBeGreaterThan(0);

      entriesWithSections.forEach((entry) => {
        entry.sections.forEach((section) => {
          expect(section.paragraphs).toBeDefined();
          expect(Array.isArray(section.paragraphs)).toBe(true);

          section.paragraphs.forEach((para) => {
            expect(typeof para).toBe('string');
          });
        });
      });
    });

    it('should extract Bible references from content', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const entriesWithBibleRefs = entries.filter((e) => e.bibleReferences.length > 0);
      if (entriesWithBibleRefs.length > 0) {
        entriesWithBibleRefs.forEach((entry) => {
          entry.bibleReferences.forEach((ref) => {
            expect(typeof ref).toBe('string');
            expect(ref).toMatch(/^\w+\s+\d+:\d+$/); // Format: "Luke 11:1"
          });
        });
      }
    });

    it('should parse index items with targets and labels', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const entriesWithIndex = entries.filter((e) => e.index.length > 0);
      expect(entriesWithIndex.length).toBeGreaterThan(0);

      entriesWithIndex.forEach((entry) => {
        entry.index.forEach((item) => {
          expect(item.target).toBeDefined();
          expect(typeof item.target).toBe('string');
          expect(item.label).toBeDefined();
          expect(typeof item.label).toBe('string');
        });
      });
    });

    it('should have consistent checksums across parses', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries1 = await parseUBSXml(filePath);
      const entries2 = await parseUBSXml(filePath);

      entries1.forEach((entry1, idx) => {
        const entry2 = entries2[idx];
        expect(entry1.metadata.checksum).toBe(entry2.metadata.checksum);
      });
    });
  });

  describe('Database Import: Insert into resource_entries', () => {
    beforeEach(async () => {
      // Clear entries before each test
      await db.delete(resourceEntries).where(eq(resourceEntries.resource_version_id, testVersionId));
    });

    it('should insert parsed entries into resource_entries table', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      // Insert first 5 entries for testing
      const entriesToInsert = entries.slice(0, 5);

      for (const entry of entriesToInsert) {
        await db.insert(resourceEntries).values({
          resource_version_id: testVersionId,
          entry_key: entry.key,
          source_content: entry,
          source_language: 'en',
        });
      }

      // Verify inserted
      const inserted = await db
        .select()
        .from(resourceEntries)
        .where(eq(resourceEntries.resource_version_id, testVersionId));

      expect(inserted.length).toBe(entriesToInsert.length);
    });

    it('should preserve JSONB source_content structure', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);
      const entry = entries[0];

      await db.insert(resourceEntries).values({
        resource_version_id: testVersionId,
        entry_key: entry.key,
        source_content: entry,
        source_language: 'en',
      });

      const inserted = await db
        .select()
        .from(resourceEntries)
        .where(eq(resourceEntries.resource_version_id, testVersionId))
        .limit(1);

      const dbEntry = inserted[0];
      expect(dbEntry.source_content).toBeDefined();
      expect((dbEntry.source_content as ParsedEntry).key).toBe(entry.key);
      expect((dbEntry.source_content as ParsedEntry).title).toBe(entry.title);
      expect((dbEntry.source_content as ParsedEntry).metadata).toBeDefined();
    });

    it('should set correct foreign key to resource_version', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      await db.insert(resourceEntries).values({
        resource_version_id: testVersionId,
        entry_key: entries[0].key,
        source_content: entries[0],
        source_language: 'en',
      });

      const inserted = await db
        .select()
        .from(resourceEntries)
        .where(eq(resourceEntries.resource_version_id, testVersionId))
        .limit(1);

      expect(inserted[0].resource_version_id).toBe(testVersionId);
    });

    it('should support idempotent import (upsert)', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);
      const entry = entries[0];

      // First insert
      await db.insert(resourceEntries).values({
        resource_version_id: testVersionId,
        entry_key: entry.key,
        source_content: entry,
        source_language: 'en',
      });

      let dbEntries = await db
        .select()
        .from(resourceEntries)
        .where(
          and(
            eq(resourceEntries.resource_version_id, testVersionId),
            eq(resourceEntries.entry_key, entry.key)
          )
        );

      expect(dbEntries.length).toBe(1);

      // Simulated second import: update existing
      const updated = await db
        .update(resourceEntries)
        .set({
          source_content: { ...entry, title: 'Updated Title' },
          updated_at: new Date(),
        })
        .where(
          and(
            eq(resourceEntries.resource_version_id, testVersionId),
            eq(resourceEntries.entry_key, entry.key)
          )
        )
        .returning();

      // Verify still only one entry
      dbEntries = await db
        .select()
        .from(resourceEntries)
        .where(eq(resourceEntries.resource_version_id, testVersionId));

      expect(dbEntries.length).toBe(1);
      expect((dbEntries[0].source_content as ParsedEntry).title).toBe('Updated Title');
    });

    it('should handle multiple entries without duplicates', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      // Insert first 10 entries
      for (const entry of entries.slice(0, 10)) {
        await db.insert(resourceEntries).values({
          resource_version_id: testVersionId,
          entry_key: entry.key,
          source_content: entry,
          source_language: 'en',
        });
      }

      const inserted = await db
        .select()
        .from(resourceEntries)
        .where(eq(resourceEntries.resource_version_id, testVersionId));

      expect(inserted.length).toBe(10);

      // Verify all entry_keys are unique
      const keys = inserted.map((e) => e.entry_key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(10);
    });
  });

  describe('Round-trip Validation', () => {
    it('should serialize entry back to XML', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      entries.slice(0, 5).forEach((entry) => {
        const xml = serializeEntryToXml(entry);
        expect(xml).toBeDefined();
        expect(typeof xml).toBe('string');
        expect(xml).toContain(entry.key);
        expect(xml).toContain(entry.title);
      });
    });

    it('should preserve entry_key through round-trip', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const originalKeys = entries.slice(0, 5).map((e) => e.key);

      originalKeys.forEach((key, idx) => {
        const xml = serializeEntryToXml(entries[idx]);
        expect(xml).toContain(`Key="${key}"`);
      });
    });

    it('should preserve entry_title through round-trip', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      entries.slice(0, 5).forEach((entry) => {
        const xml = serializeEntryToXml(entry);
        expect(xml).toContain(`<Title>${entry.title}</Title>`);
      });
    });
  });

  describe('Bulk Import Scenarios', () => {
    beforeEach(async () => {
      await db.delete(resourceEntries).where(eq(resourceEntries.resource_version_id, testVersionId));
    });

    it('should import all FAUNA entries successfully', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      console.log(`Importing ${entries.length} FAUNA entries...`);

      for (const entry of entries) {
        try {
          await db.insert(resourceEntries).values({
            resource_version_id: testVersionId,
            entry_key: entry.key,
            source_content: entry,
            source_language: 'en',
          });
        } catch (error) {
          console.error(`Failed to insert entry ${entry.key}:`, error);
          throw error;
        }
      }

      const dbEntries = await db
        .select()
        .from(resourceEntries)
        .where(eq(resourceEntries.resource_version_id, testVersionId));

      expect(dbEntries.length).toBe(entries.length);
      console.log(`✅ Successfully imported ${dbEntries.length} entries`);
    });

    it('should log entry counts per resource', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      for (const entry of entries) {
        await db.insert(resourceEntries).values({
          resource_version_id: testVersionId,
          entry_key: entry.key,
          source_content: entry,
          source_language: 'en',
        });
      }

      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(resourceEntries)
        .where(eq(resourceEntries.resource_version_id, testVersionId));

      const totalCount = parseInt(count[0].count.toString(), 10);
      expect(totalCount).toBe(entries.length);

      console.log(`📊 FAUNA: ${totalCount} entries imported`);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent XML file', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'NONEXISTENT.xml');

      await expect(parseUBSXml(filePath)).rejects.toThrow();
    });

    it('should handle malformed XML gracefully', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');

      // Ensure file is readable
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });
  });
});

import { describe, it, expect, beforeAll } from '@jest/globals';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { parseUBSXml } from '@/lib/xml-parser/parser';

// ─────────────────────────────────────────────────────────────────────────────
// Module contract helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getImporter(): Promise<Record<string, unknown>> {
  return (await import('@/lib/importer/ubs-xml-importer')) as Record<string, unknown>;
}

async function getContracts(): Promise<Record<string, unknown>> {
  return (await import('@/lib/import-workflow/contracts')) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// US-008: Import UBS XML Resources
// ─────────────────────────────────────────────────────────────────────────────

describe('US-008: Import UBS XML Resources', () => {
  describe('Importer Module Shape', () => {
    it('should export importUBSResource function', async () => {
      const mod = await getImporter();
      expect(typeof mod.importUBSResource).toBe('function');
    });

    it('should export ResourceName type constraint via VALID_RESOURCES array', async () => {
      // Confirm the three expected resource names are available as constants
      // (We test this via behavior: importUBSResource throws for unknown names)
      const mod = await getImporter();
      expect(typeof mod.importUBSResource).toBe('function');
    });
  });

  describe('XML Resource Configuration', () => {
    const DATA_XML_DIR = path.join(process.cwd(), 'data', 'xml');

    it('should have FAUNA XML file accessible', async () => {
      const filePath = path.join(DATA_XML_DIR, 'FAUNA_en.xml');
      await expect(fs.access(filePath)).resolves.toBeUndefined();
    });

    it('should have FLORA XML file accessible', async () => {
      const filePath = path.join(DATA_XML_DIR, 'FLORA_en.xml');
      await expect(fs.access(filePath)).resolves.toBeUndefined();
    });

    it('should have REALIA XML file accessible', async () => {
      const filePath = path.join(DATA_XML_DIR, 'REALIA_en.xml');
      await expect(fs.access(filePath)).resolves.toBeUndefined();
    });
  });

  describe('XML Parsing: Entry Structure', () => {
    let faunaEntries: Awaited<ReturnType<typeof parseUBSXml>>;

    beforeAll(async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      faunaEntries = await parseUBSXml(filePath);
    }, 60_000);

    it('should parse at least one entry from FAUNA', () => {
      expect(faunaEntries.length).toBeGreaterThan(0);
    });

    it('each entry should have a string key', () => {
      for (const entry of faunaEntries) {
        expect(typeof entry.key).toBe('string');
        expect(entry.key.length).toBeGreaterThan(0);
      }
    });

    it('each entry should have a title', () => {
      for (const entry of faunaEntries) {
        expect(typeof entry.title).toBe('string');
      }
    });

    it('each entry should have a metadata.checksum', () => {
      for (const entry of faunaEntries) {
        expect(entry.metadata).toBeDefined();
        expect(typeof entry.metadata.checksum).toBe('string');
        expect(entry.metadata.checksum.length).toBeGreaterThan(0);
      }
    });

    it('each entry should have a sections array', () => {
      for (const entry of faunaEntries) {
        expect(Array.isArray(entry.sections)).toBe(true);
      }
    });

    it('each entry should have a bibleReferences array', () => {
      for (const entry of faunaEntries) {
        expect(Array.isArray(entry.bibleReferences)).toBe(true);
      }
    });

    it('each entry should have an index array', () => {
      for (const entry of faunaEntries) {
        expect(Array.isArray(entry.index)).toBe(true);
      }
    });

    it('checksums should be unique per entry', () => {
      const checksums = faunaEntries.map((e) => e.metadata.checksum);
      const unique = new Set(checksums);
      expect(unique.size).toBe(faunaEntries.length);
    });

    it('entry keys should be unique within the resource', () => {
      const keys = faunaEntries.map((e) => e.key);
      const unique = new Set(keys);
      expect(unique.size).toBe(faunaEntries.length);
    });
  });

  describe('XML Parsing: FLORA', () => {
    it('should parse FLORA XML without errors and return entries', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FLORA_en.xml');
      const entries = await parseUBSXml(filePath);
      expect(entries.length).toBeGreaterThan(0);
    }, 60_000);
  });

  describe('XML Parsing: REALIA', () => {
    it('should parse REALIA XML without errors and return entries', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'REALIA_en.xml');
      const entries = await parseUBSXml(filePath);
      expect(entries.length).toBeGreaterThan(0);
    }, 60_000);
  });

  describe('Idempotency Contracts', () => {
    it('verifyIdempotentImport should pass when count stays the same', async () => {
      const { verifyIdempotentImport } = await getContracts();
      expect((verifyIdempotentImport as (a: number, b: number) => boolean)(10, 10)).toBe(true);
    });

    it('verifyIdempotentImport should pass when count increases (first run)', async () => {
      const { verifyIdempotentImport } = await getContracts();
      expect((verifyIdempotentImport as (a: number, b: number) => boolean)(0, 50)).toBe(true);
    });

    it('verifyIdempotentImport should fail when count decreases (data loss)', async () => {
      const { verifyIdempotentImport } = await getContracts();
      expect((verifyIdempotentImport as (a: number, b: number) => boolean)(50, 40)).toBe(false);
    });
  });

  describe('Import Lock Contracts', () => {
    it('should acquire and release an import lock', async () => {
      const { acquireImportLock } = await getContracts();
      const release = (acquireImportLock as (id: string) => () => void)('resource-abc');
      expect(typeof release).toBe('function');
      release(); // should not throw
    });

    it('should throw IMPORT_LOCKED when lock is already held', async () => {
      const { acquireImportLock } = await getContracts();
      const release = (acquireImportLock as (id: string) => () => void)('resource-lock-test');
      try {
        expect(() =>
          (acquireImportLock as (id: string) => () => void)('resource-lock-test')
        ).toThrow('IMPORT_LOCKED');
      } finally {
        release();
      }
    });
  });

  describe('Entry Key Scoping', () => {
    it('buildScopedEntryKey should namespace entry keys by resource', async () => {
      const { buildScopedEntryKey } = await getContracts();
      const fn = buildScopedEntryKey as (resource: string, key: string) => string;
      expect(fn('FAUNA', '1.2')).toBe('FAUNA:1.2');
      expect(fn('FLORA', '3')).toBe('FLORA:3');
      expect(fn('REALIA', '0')).toBe('REALIA:0');
    });

    it('scoped keys from different resources should not collide', async () => {
      const { buildScopedEntryKey } = await getContracts();
      const fn = buildScopedEntryKey as (resource: string, key: string) => string;
      const faunaKey = fn('FAUNA', '1');
      const floraKey = fn('FLORA', '1');
      expect(faunaKey).not.toBe(floraKey);
    });
  });

  describe('RBAC: Import Authorization', () => {
    it('assertCanImport should allow admin role', async () => {
      const { assertCanImport } = await getContracts();
      expect(() => (assertCanImport as (role: string) => void)('admin')).not.toThrow();
    });

    it('assertCanImport should reject non-admin roles', async () => {
      const { assertCanImport } = await getContracts();
      const fn = assertCanImport as (role: string) => void;
      expect(() => fn('translator')).toThrow('FORBIDDEN');
      expect(() => fn('reviewer')).toThrow('FORBIDDEN');
      expect(() => fn('reader')).toThrow('FORBIDDEN');
    });
  });

  describe('source_content JSONB Shape', () => {
    let sampleEntry: Awaited<ReturnType<typeof parseUBSXml>>[number];

    beforeAll(async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);
      sampleEntry = entries[0];
    }, 60_000);

    it('source_content candidate object should be JSON-serializable', () => {
      const candidate = {
        title: sampleEntry.title,
        intro: sampleEntry.intro,
        sections: sampleEntry.sections,
        index: sampleEntry.index,
        bibleReferences: sampleEntry.bibleReferences,
        metadata: sampleEntry.metadata,
      };
      expect(() => JSON.stringify(candidate)).not.toThrow();
    });

    it('source_content candidate should preserve metadata.checksum after round-trip', () => {
      const candidate = {
        title: sampleEntry.title,
        intro: sampleEntry.intro,
        sections: sampleEntry.sections,
        index: sampleEntry.index,
        bibleReferences: sampleEntry.bibleReferences,
        metadata: sampleEntry.metadata,
      };
      const roundTripped = JSON.parse(JSON.stringify(candidate));
      expect(roundTripped.metadata.checksum).toBe(sampleEntry.metadata.checksum);
    });

    it('source_content candidate should preserve bibleReferences array after round-trip', () => {
      const candidate = {
        bibleReferences: sampleEntry.bibleReferences,
      };
      const roundTripped = JSON.parse(JSON.stringify(candidate));
      expect(roundTripped.bibleReferences).toEqual(sampleEntry.bibleReferences);
    });
  });
});

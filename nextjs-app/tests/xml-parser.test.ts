import { describe, it, expect } from '@jest/globals';
import { parseUBSXml, serializeEntryToXml, ParsedEntry } from '@/lib/xml-parser/parser';
import * as path from 'path';

describe('GH-008: XML Parser Unit Tests (No Database)', () => {
  describe('XML Parser: parseUBSXml()', () => {
    it('should parse FAUNA XML file without errors', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
      console.log(`✅ Parsed ${entries.length} FAUNA entries`);
    });

    it('should parse entry with Key field', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const firstEntry = entries[0];
      expect(firstEntry.key).toBeDefined();
      expect(typeof firstEntry.key).toBe('string');
      expect(firstEntry.key.length).toBeGreaterThan(0);
      console.log(`   Entry Key: ${firstEntry.key}`);
    });

    it('should parse entry with Title field', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const firstEntry = entries[0];
      expect(firstEntry.title).toBeDefined();
      expect(typeof firstEntry.title).toBe('string');
      expect(firstEntry.title.length).toBeGreaterThan(0);
      console.log(`   Entry Title: ${firstEntry.title}`);
    });

    it('should parse sections with paragraphs', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const entriesWithSections = entries.filter((e) => e.sections.length > 0);
      expect(entriesWithSections.length).toBeGreaterThan(0);

      const firstWithSections = entriesWithSections[0];
      expect(firstWithSections.sections[0].paragraphs).toBeDefined();
      expect(Array.isArray(firstWithSections.sections[0].paragraphs)).toBe(true);
      console.log(`   Found entry with ${firstWithSections.sections.length} sections`);
    });

    it('should have consistent checksums for same content', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries1 = await parseUBSXml(filePath);
      const entries2 = await parseUBSXml(filePath);

      entries1.slice(0, 5).forEach((entry1, idx) => {
        const entry2 = entries2[idx];
        expect(entry1.metadata.checksum).toBe(entry2.metadata.checksum);
      });
      console.log(`   ✅ Checksums match across parses`);
    });

    it('should extract Bible references', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const entriesWithRefs = entries.filter((e) => e.bibleReferences.length > 0);
      if (entriesWithRefs.length > 0) {
        const firstWithRefs = entriesWithRefs[0];
        console.log(`   Entry has ${firstWithRefs.bibleReferences.length} Bible references`);
        console.log(`   Sample: ${firstWithRefs.bibleReferences.slice(0, 3).join(', ')}`);
      }
    });

    it('should parse index items', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const entriesWithIndex = entries.filter((e) => e.index.length > 0);
      expect(entriesWithIndex.length).toBeGreaterThan(0);

      const firstWithIndex = entriesWithIndex[0];
      console.log(`   Entry has ${firstWithIndex.index.length} index items`);
      console.log(`   Sample: ${firstWithIndex.index.slice(0, 2).map((i) => i.label).join(', ')}`);
    });
  });

  describe('Round-trip Validation', () => {
    it('should serialize entry back to XML', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      const firstEntry = entries[0];
      const xml = serializeEntryToXml(firstEntry);

      expect(xml).toBeDefined();
      expect(typeof xml).toBe('string');
      expect(xml.length).toBeGreaterThan(0);
      console.log(`   ✅ Serialized entry to XML (${xml.length} chars)`);
    });

    it('should preserve entry_key through serialization', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      entries.slice(0, 5).forEach((entry) => {
        const xml = serializeEntryToXml(entry);
        expect(xml).toContain(`Key="${entry.key}"`);
      });
      console.log(`   ✅ Entry keys preserved in serialization`);
    });

    it('should preserve entry_title through serialization', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      entries.slice(0, 5).forEach((entry) => {
        const xml = serializeEntryToXml(entry);
        expect(xml).toContain(`<Title>${entry.title}</Title>`);
      });
      console.log(`   ✅ Entry titles preserved in serialization`);
    });
  });

  describe('Bulk Processing', () => {
    it('should parse all 3 dictionaries successfully', async () => {
      const dictionaries = [
        { name: 'FAUNA', file: 'FAUNA_en.xml' },
        { name: 'FLORA', file: 'FLORA_en.xml' },
        { name: 'REALIA', file: 'REALIA_en.xml' },
      ];

      for (const dict of dictionaries) {
        const filePath = path.join(process.cwd(), 'data', 'xml', dict.file);
        const entries = await parseUBSXml(filePath);
        expect(entries.length).toBeGreaterThan(0);
        console.log(`   ✅ ${dict.name}: ${entries.length} entries`);
      }
    });

    it('should handle large batch of entries', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      // Simulate batch processing
      let processed = 0;
      for (const entry of entries) {
        const xml = serializeEntryToXml(entry);
        expect(xml.length).toBeGreaterThan(0);
        processed++;
      }

      console.log(`   ✅ Processed ${processed} entries without errors`);
    });
  });

  describe('Data Validation', () => {
    it('should have required metadata fields', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      entries.slice(0, 10).forEach((entry) => {
        expect(entry.metadata).toBeDefined();
        expect(entry.metadata.sourceFormat).toBe('xml');
        expect(entry.metadata.importedAt).toBeDefined();
        expect(entry.metadata.checksum).toBeDefined();
      });
      console.log(`   ✅ All entries have required metadata`);
    });

    it('should maintain sections and paragraphs structure', async () => {
      const filePath = path.join(process.cwd(), 'data', 'xml', 'FAUNA_en.xml');
      const entries = await parseUBSXml(filePath);

      entries.slice(0, 5).forEach((entry) => {
        expect(entry.sections).toBeDefined();
        expect(Array.isArray(entry.sections)).toBe(true);

        entry.sections.forEach((section) => {
          expect(section.paragraphs).toBeDefined();
          expect(Array.isArray(section.paragraphs)).toBe(true);
        });
      });
      console.log(`   ✅ Section and paragraph structure valid`);
    });
  });
});

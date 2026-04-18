import { describe, it, expect } from '@jest/globals';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parseUBSXml } from '@/lib/xml-parser/parser';

async function getWorkflowContracts(): Promise<Record<string, unknown>> {
  return (await import('@/lib/import-workflow/contracts')) as Record<string, unknown>;
}

async function writeTempXml(content: string, fileName = 'fixture.xml'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-risk-'));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

const MINIMAL_VALID_XML = `<?xml version="1.0"?>
<Thematic_Lexicon>
  <ThemLex_Entry Key="1">
    <Title>Alpha</Title>
    <Sections>
      <Section Type="entry" Content="other">
        <Paragraphs>
          <Paragraph>Hello</Paragraph>
        </Paragraphs>
      </Section>
    </Sections>
    <Index>
      <IndexItem><l target="FAUNA:1">One</l></IndexItem>
    </Index>
  </ThemLex_Entry>
</Thematic_Lexicon>`;

describe('Import Workflow Risk Matrix (Red Phase)', () => {
  it('IMP-001: should surface structured error code for missing source files', async () => {
    await expect(parseUBSXml('Z:/non-existent/missing-fauna.xml')).rejects.toHaveProperty('code', 'IMPORT_SOURCE_NOT_FOUND');
  });

  it('IMP-002: should reject empty source files with IMPORT_EMPTY_FILE', async () => {
    const filePath = await writeTempXml('', 'empty.xml');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'IMPORT_EMPTY_FILE');
  });

  it('IMP-003: should reject malformed XML with IMPORT_XML_NOT_WELL_FORMED', async () => {
    const filePath = await writeTempXml('<Thematic_Lexicon><ThemLex_Entry></Thematic_Lexicon>', 'malformed.xml');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'IMPORT_XML_NOT_WELL_FORMED');
  });

  it('IMP-004: should fail schema-invalid XML with IMPORT_XML_SCHEMA_INVALID', async () => {
    const filePath = await writeTempXml('<?xml version="1.0"?><Thematic_Lexicon><ThemLex_Entry/></Thematic_Lexicon>', 'schema-invalid.xml');
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).validateAgainstXsd).toBe('function');
    await expect((parserModule as any).validateAgainstXsd(filePath)).rejects.toHaveProperty('code', 'IMPORT_XML_SCHEMA_INVALID');
  });

  it('IMP-005: should expose idempotency verifier for repeated imports', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.verifyIdempotentImport).toBe('function');
  });

  it('IMP-006: should reject broken index targets as IMPORT_REFERENCE_INVALID', async () => {
    const xml = `<?xml version="1.0"?>
<Thematic_Lexicon>
  <ThemLex_Entry Key="1"><Title>A</Title><Index><IndexItem><l target="FAUNA:999">Missing</l></IndexItem></Index></ThemLex_Entry>
</Thematic_Lexicon>`;
    const filePath = await writeTempXml(xml, 'bad-index.xml');
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).validateIndexTargets).toBe('function');
    await expect((parserModule as any).validateIndexTargets(filePath)).rejects.toHaveProperty('code', 'IMPORT_REFERENCE_INVALID');
  });

  it('IMP-007: should provide transaction mode controls for atomic imports', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.importDictionaryTransactional).toBe('function');
  });

  it('IMP-008: should provide canonical round-trip diff helper', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).canonicalXmlDiff).toBe('function');
  });

  it('IMP-009: should reject duplicate keys in same file', async () => {
    const xml = `<?xml version="1.0"?>
<Thematic_Lexicon>
  <ThemLex_Entry Key="1"><Title>A</Title></ThemLex_Entry>
  <ThemLex_Entry Key="1"><Title>B</Title></ThemLex_Entry>
</Thematic_Lexicon>`;
    const filePath = await writeTempXml(xml, 'duplicate-key.xml');
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).validateDuplicateKeys).toBe('function');
    await expect((parserModule as any).validateDuplicateKeys(filePath)).rejects.toHaveProperty('code', 'IMPORT_DUPLICATE_KEY');
  });

  it('IMP-010: should reject invalid UTF-8 payloads with IMPORT_ENCODING_INVALID', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-risk-utf8-'));
    const filePath = path.join(dir, 'invalid-utf8.xml');
    await fs.writeFile(filePath, Buffer.from([0xff, 0xfe, 0xfd, 0x00]));
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'IMPORT_ENCODING_INVALID');
  });

  it('IMP-011: should reject wrong namespace with IMPORT_NAMESPACE_INVALID', async () => {
    const xml = `<?xml version="1.0"?>
<Thematic_Lexicon xmlns="urn:wrong:namespace">
  <ThemLex_Entry Key="1"><Title>A</Title></ThemLex_Entry>
</Thematic_Lexicon>`;
    const filePath = await writeTempXml(xml, 'wrong-namespace.xml');
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).validateNamespace).toBe('function');
    await expect((parserModule as any).validateNamespace(filePath)).rejects.toHaveProperty('code', 'IMPORT_NAMESPACE_INVALID');
  });

  it('IMP-012: should enforce parse timeout on oversized files', async () => {
    const giantPayload = `<?xml version="1.0"?><Thematic_Lexicon><ThemLex_Entry Key="1"><Title>${'A'.repeat(12_000_000)}</Title></ThemLex_Entry></Thematic_Lexicon>`;
    const filePath = await writeTempXml(giantPayload, 'fauna-huge.xml');
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).parseUBSXmlWithLimits).toBe('function');
    await expect((parserModule as any).parseUBSXmlWithLimits(filePath, { timeoutMs: 100 })).rejects.toHaveProperty('code', 'IMPORT_TIMEOUT');
  });

  it('IMP-013: should expose inserted/updated/skipped counters API', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.calculateImportCounters).toBe('function');
  });

  it('IMP-014: should protect cross-dictionary key collisions', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.buildScopedEntryKey).toBe('function');
  });

  it('IMP-015: should normalize Unicode keys before duplicate checks', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).normalizeEntryKey).toBe('function');
  });

  it('IMP-016: should support unknown optional elements without crashing', async () => {
    const xml = `<?xml version="1.0"?>
<Thematic_Lexicon>
  <ThemLex_Entry Key="1">
    <Title>A</Title>
    <FutureOptional><Nested><v>1</v></Nested></FutureOptional>
  </ThemLex_Entry>
</Thematic_Lexicon>`;
    const filePath = await writeTempXml(xml, 'forward-compatible.xml');
    const result = await parseUBSXml(filePath);
    expect(result.length).toBeGreaterThan(0);
    expect((result[0] as any).unknownElements).toBeDefined();
  });

  it('IMP-017: should emit stable diagnostic codes with entry key and stage', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).formatImportError).toBe('function');
  });

  it('IMP-018: should expose observability metrics for successful import path', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.emitImportMetrics).toBe('function');
  });

  it('sanity: minimal valid XML still parses today', async () => {
    const filePath = await writeTempXml(MINIMAL_VALID_XML, 'valid.xml');
    const parsed = await parseUBSXml(filePath);
    expect(parsed.length).toBe(1);
    expect(parsed[0].key).toBe('1');
  });
});

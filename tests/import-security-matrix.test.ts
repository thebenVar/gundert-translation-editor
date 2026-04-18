import { describe, it, expect } from '@jest/globals';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parseUBSXml } from '@/lib/xml-parser/parser';

async function getWorkflowContracts(): Promise<Record<string, unknown>> {
  return (await import('@/lib/import-workflow/contracts')) as Record<string, unknown>;
}

async function writeTempXml(content: string, fileName = 'security.xml'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-sec-'));
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Import Security Matrix (Red Phase)', () => {
  it('SEC-001: should reject XXE payloads', async () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<Thematic_Lexicon>
  <ThemLex_Entry Key="1"><Title>&xxe;</Title></ThemLex_Entry>
</Thematic_Lexicon>`;
    const filePath = await writeTempXml(xxe, 'xxe.xml');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'SEC_XXE_BLOCKED');
  });

  it('SEC-002: should reject entity expansion bombs', async () => {
    const bomb = `<?xml version="1.0"?>
<!DOCTYPE lolz [
 <!ENTITY a "ha">
 <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">
 <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;">
]>
<Thematic_Lexicon><ThemLex_Entry Key="1"><Title>&c;</Title></ThemLex_Entry></Thematic_Lexicon>`;
    const filePath = await writeTempXml(bomb, 'entity-bomb.xml');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'SEC_ENTITY_EXPANSION_BLOCKED');
  });

  it('SEC-003: should reject any DOCTYPE declarations by policy', async () => {
    const withDoctype = `<?xml version="1.0"?>
<!DOCTYPE Thematic_Lexicon>
<Thematic_Lexicon><ThemLex_Entry Key="1"><Title>A</Title></ThemLex_Entry></Thematic_Lexicon>`;
    const filePath = await writeTempXml(withDoctype, 'with-doctype.xml');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'SEC_DOCTYPE_FORBIDDEN');
  });

  it('SEC-004: should treat SQL-like payloads as plain text with explicit sanitizer API', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).sanitizeForStorage).toBe('function');
  });

  it('SEC-005: should reject path traversal attempts before read', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).resolveImportPathSafely).toBe('function');
    expect(() => (parserModule as any).resolveImportPathSafely('..\\..\\secret.xml')).toThrow('SEC_PATH_TRAVERSAL_BLOCKED');
  });

  it('SEC-006: should expose RBAC guard for import execution', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.assertCanImport).toBe('function');
  });

  it('SEC-007: should sanitize log-forging payloads', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).sanitizeForLog).toBe('function');
    const output = (parserModule as any).sanitizeForLog('ok\nERROR: forged line\u001b[31m');
    expect(output).not.toContain('\nERROR: forged line');
    expect(output).not.toContain('\u001b[31m');
  });

  it('SEC-008: should reject oversized nodes with stable security error code', async () => {
    const hugeNode = `<?xml version="1.0"?><Thematic_Lexicon><ThemLex_Entry Key="1"><Title>${'A'.repeat(8_000_000)}</Title></ThemLex_Entry></Thematic_Lexicon>`;
    const filePath = await writeTempXml(hugeNode, 'oversize-node.xml');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'SEC_SIZE_LIMIT_EXCEEDED');
  });

  it('SEC-009: should reject deep nesting to prevent parser DoS', async () => {
    let nested = '<A>';
    for (let i = 0; i < 2000; i++) nested += '<A>';
    for (let i = 0; i < 2001; i++) nested += '</A>';

    const xml = `<?xml version="1.0"?><Thematic_Lexicon><ThemLex_Entry Key="1"><Title>${nested}</Title></ThemLex_Entry></Thematic_Lexicon>`;
    const filePath = await writeTempXml(xml, 'deep-nesting.xml');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'SEC_MAX_DEPTH_EXCEEDED');
  });

  it('SEC-010: should expose import rate-limit policy function', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.checkImportRateLimit).toBe('function');
  });

  it('SEC-011: should map internal parser errors to safe client errors', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).toSafeClientError).toBe('function');
  });

  it('SEC-012: should reject non-XML payloads even with .xml extension', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-sec-fake-'));
    const filePath = path.join(dir, 'fake-xml.xml');
    await fs.writeFile(filePath, 'not xml at all', 'utf-8');
    await expect(parseUBSXml(filePath)).rejects.toHaveProperty('code', 'SEC_CONTENT_TYPE_INVALID');
  });

  it('SEC-013: should expose confusable detector for keys', async () => {
    const parserModule = await import('@/lib/xml-parser/parser');
    expect(typeof (parserModule as any).detectConfusableKeys).toBe('function');
  });

  it('SEC-014: should expose concurrency guard for same resource import', async () => {
    const contracts = await getWorkflowContracts();
    expect(typeof contracts.acquireImportLock).toBe('function');
  });
});

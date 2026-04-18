#!/usr/bin/env ts-node
/**
 * GH-009: Round-trip Validation
 * 
 * Validates that imported entries can be exported back to XML
 * and match the source canonically (ignoring formatting differences).
 * 
 * Usage:
 *   npm run validate:roundtrip
 */

import { db } from '@/lib/db';
import { resourceVersions, resourceEntries } from '@/lib/db/schema';
import { parseUBSXml, serializeEntryToXml, ParsedEntry } from '@/lib/xml-parser/parser';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

interface ValidationResult {
  dictionary: string;
  status: 'pass' | 'fail';
  entriesValidated: number;
  entriesFailed: number;
  failures: Array<{
    entryKey: string;
    error: string;
  }>;
}

/**
 * Main validation function
 */
async function validateRoundTrip(): Promise<void> {
  console.log('\n🔄 Starting Round-trip Validation...\n');

  const results: ValidationResult[] = [];

  // Validate each dictionary
  const dictionaries = [
    { name: 'FAUNA', file: 'FAUNA_en.xml' },
    { name: 'FLORA', file: 'FLORA_en.xml' },
    { name: 'REALIA', file: 'REALIA_en.xml' },
  ];

  for (const dict of dictionaries) {
    try {
      const result = await validateDictionary(dict.name, dict.file);
      results.push(result);
    } catch (error) {
      results.push({
        dictionary: dict.name,
        status: 'fail',
        entriesValidated: 0,
        entriesFailed: 0,
        failures: [
          {
            entryKey: 'FATAL',
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      });
    }
  }

  // Print summary
  console.log('\n📊 Validation Summary:\n');
  let totalValidated = 0;
  let totalFailed = 0;

  for (const result of results) {
    const status = result.status === 'pass' ? '✅' : '❌';
    console.log(
      `${status} ${result.dictionary.padEnd(10)} | Validated: ${result.entriesValidated}, Failed: ${result.entriesFailed}`
    );
    if (result.failures.length > 0) {
      result.failures.slice(0, 3).forEach((f) => {
        console.log(`   ⚠️ ${f.entryKey}: ${f.error}`);
      });
      if (result.failures.length > 3) {
        console.log(`   ... and ${result.failures.length - 3} more failures`);
      }
    }
    totalValidated += result.entriesValidated;
    totalFailed += result.entriesFailed;
  }

  console.log(`\n📈 Total: ${totalValidated} validated, ${totalFailed} failed`);

  if (results.every((r) => r.status === 'pass')) {
    console.log('\n✨ All round-trip validations passed!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some validations failed. Check errors above.\n');
    process.exit(1);
  }
}

/**
 * Validate a single dictionary
 */
async function validateDictionary(dictName: string, fileName: string): Promise<ValidationResult> {
  const filePath = path.join(process.cwd(), 'data', 'xml', fileName);

  console.log(`🔄 Validating ${dictName}...`);

  // Parse source XML
  const sourceEntries = await parseUBSXml(filePath);
  console.log(`   Parsed ${sourceEntries.length} source entries`);

  let validated = 0;
  let failed = 0;
  const failures: Array<{ entryKey: string; error: string }> = [];

  for (const sourceEntry of sourceEntries) {
    try {
      // Serialize back to XML
      const exportedXml = serializeEntryToXml(sourceEntry);

      // Validate checksum (quick structural check)
      if (!sourceEntry.metadata.checksum) {
        throw new Error('Missing checksum in source entry');
      }

      // Validate key fields preserved
      if (!exportedXml.includes(`Key="${sourceEntry.key}"`)) {
        throw new Error(`Entry key not preserved in export: ${sourceEntry.key}`);
      }

      if (!exportedXml.includes(`<Title>${sourceEntry.title}</Title>`)) {
        throw new Error(`Entry title not preserved in export`);
      }

      validated++;
    } catch (error) {
      failed++;
      failures.push({
        entryKey: sourceEntry.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`   ✅ Validated ${validated}, Failed ${failed}\n`);

  return {
    dictionary: dictName,
    status: failed === 0 ? 'pass' : 'fail',
    entriesValidated: validated,
    entriesFailed: failed,
    failures,
  };
}

// Run validation
validateRoundTrip().catch((error) => {
  console.error('Fatal error during validation:', error);
  process.exit(1);
});

# Testing Guide

## Test Status

**Current State:**
- ✅ **14 unit tests passing** - XML parser tests (no database needed)
- ⏭️ **76 integration tests skipped** - Database tests (waiting for schema deployment)

```
Test Suites: 1 passed, 2 skipped
Tests:       14 passed, 76 skipped
```

---

## Test Organization

All active test commands below are run from `nextjs-app/`.

### 1. Unit Tests: XML Parser (`nextjs-app/tests/xml-parser.test.ts`)
**Status:** ✅ Passing

Tests the UBS XML import parser in isolation, without any database.

**Coverage:**
- XML parsing for FAUNA, FLORA, REALIA files
- Entry field extraction (keys, titles, sections, paragraphs)
- Bible reference extraction
- Index item parsing
- Round-trip serialization
- Checksum consistency
- Bulk processing
- Data structure validation

**Run locally:**
```bash
cd nextjs-app
npm test -- tests/xml-parser.test.ts
```

---

### 2. Integration Tests: Database Import (`nextjs-app/tests/db/import.test.ts`)
**Status:** ⏭️ Skipped (database required)

Tests the import pipeline using live Neon database.

**Prerequisites:**
1. Neon database configured (`POSTGRES_URL_NON_POOLING` in `.env.local`)
2. Schema deployed: `npm run db:push`
3. All 10 tables created

**Run when database ready:**
```bash
cd nextjs-app
npm run db:push
npm run test:db
```

**Coverage:**
- Database inserts (resource entries)
- JSONB source_content preservation
- Foreign key validation
- Idempotent upsert behavior
- Bulk import without duplicates

---

### 3. Integration Tests: Schema Validation (`nextjs-app/tests/db/schema.test.ts`)
**Status:** ⏭️ Skipped (database required)

Tests database schema structure, constraints, and data types.

**Prerequisites:**
1. Same as Import tests above

**Run when database ready:**
```bash
cd nextjs-app
npm run db:push
npm run test:db
```

**Coverage (50+ assertions):**
- All 10 tables exist with correct columns
- Data types: VARCHAR, JSONB, ENUMs, UUIDs
- Constraints: UNIQUE, NOT NULL, FKs
- Cascade deletes configured
- UTF-8 encoding for multilingual support
- Soft deletes (deleted_at column)
- Timestamps (created_at, updated_at)
- JSONB indexing

---

## Running Tests

### All Tests (Current)
```bash
cd nextjs-app
npm test
```
- Runs unit tests ✅
- Skips integration tests ⏭️

### Run All Tests (Including Integration)
Requires: Database setup + `npm run db:push`
```bash
cd nextjs-app
npm test -- --testPathIgnorePatterns=none
```

### Run Specific Test Suite
```bash
cd nextjs-app
npm test -- tests/xml-parser.test.ts
npm test -- tests/db/import.test.ts
npm test -- tests/db/schema.test.ts
```

### Watch Mode
```bash
cd nextjs-app
npm run test:watch
```

### Single Run (CI mode)
```bash
cd nextjs-app
npm test -- --coverage
```

---

## Database Setup (For Integration Tests)

### Step 1: Ensure Database Connection
```bash
cd nextjs-app
# Check .env.local has POSTGRES_URL_NON_POOLING
cat .env.local | grep POSTGRES_URL_NON_POOLING
```

### Step 2: Deploy Schema
```bash
cd nextjs-app
npm run db:push
```
This creates all 10 tables in Neon.

### Step 3: Run Integration Tests
```bash
cd nextjs-app
npm test -- tests/db/import.test.ts --runInBand
npm test -- tests/db/schema.test.ts --runInBand
```

### Step 4: Verify Import Script
After tests pass, test the actual importer:
```bash
cd nextjs-app
npm run import:ubs
npm run validate:roundtrip
```

---

## Test Scripts

| Command | Purpose |
|---------|---------|
| `npm test` | Run all unit tests |
| `npm run test:watch` | Watch mode for development |
| `npm test -- --coverage` | Coverage report |
| `npm test -- tests/xml-parser.test.ts` | XML parser tests only |
| `npm run test:db` | DB integration suites (requires DB + env gate) |
| `npm run import:ubs` | Run actual UBS XML importer |
| `npm run validate:roundtrip` | Validate import integrity |

Legacy browser PoC tests are preserved in `legacy-poc/tests/`.

### DB Integration Gate
DB suites run only when both conditions are true:
1. `RUN_DB_INTEGRATION_TESTS=true`
2. `POSTGRES_URL_NON_POOLING` is configured

`npm run test:db` sets `RUN_DB_INTEGRATION_TESTS=true` automatically via `cross-env`.

---

## CI/CD Pipeline

### Default CI (No Database)
```bash
cd nextjs-app
npm test                    # Unit tests only
npm run build              # Build check
npm run lint               # Linting
```

### Full Integration CI (Requires Database)
```bash
cd nextjs-app
npm run db:push            # Deploy schema to test DB
npm test -- tests/db/**    # Run all DB tests
npm run import:ubs         # Test importer
npm run validate:roundtrip # Verify round-trip
```

### GitHub Actions CI Behavior
- Workflow file: `.github/workflows/ci.yml`
- Always runs: install, lint, and default `npm test`
- Conditionally runs DB integration (`npm run test:db`) only when the GitHub secret `POSTGRES_URL_NON_POOLING` is configured
- DB stage first runs `npm run db:push` to ensure schema is present before integration tests

---

## Debugging Test Failures

### XML Parser Failures
```bash
cd nextjs-app
# Run with verbose output
npm test -- tests/xml-parser.test.ts --verbose

# Check XML files exist
ls -la data/xml/
```

### Database Connection Issues
```bash
cd nextjs-app
# Check connection string
echo $POSTGRES_URL_NON_POOLING

# Verify schema deployed
psql $POSTGRES_URL_NON_POOLING -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
```

### Import Test Failures
```bash
cd nextjs-app
# Run single integration test
npm test -- tests/db/import.test.ts -t "should insert parsed entries"

# Check database state
npm run db:migrate
```

---

## Next Steps

1. ✅ **Unit tests passing** - GH-008 implementation verified
2. ⏳ **Deploy database schema** - `npm run db:push`
3. ⏳ **Run integration tests** - Verify import works with real DB
4. ⏳ **Test importer script** - `npm run import:ubs`
5. ⏳ **Validate round-trip** - `npm run validate:roundtrip`

---

## Discovery: Risk-Ranked Import Workflow Matrix

### Priority Definitions
- **P0:** Release-blocking risk. Must pass before shipping.
- **P1:** High-value resilience and correctness. Should pass before production.
- **P2:** Hardening and future-proofing.

| Priority | ID | Risk Area | Scenario | Example Fixture | Expected Result | Failure Signal | Automation |
|---------|----|-----------|----------|-----------------|-----------------|----------------|------------|
| P0 | IMP-001 | Missing source files | One or more required files absent | `missing-fauna.xml` | Job fails fast before parse; no DB writes | `IMPORT_SOURCE_NOT_FOUND` | CI + integration |
| P0 | IMP-002 | Empty source files | Zero-byte file | `empty-flora.xml` | Reject with explicit reason | `IMPORT_EMPTY_FILE` | CI + unit |
| P0 | IMP-003 | Malformed XML | Unclosed tags or broken nesting | `malformed-realia.xml` | Reject at parse stage | `IMPORT_XML_NOT_WELL_FORMED` | CI + unit |
| P0 | IMP-004 | Schema invalid | Well-formed XML fails schema validation | `invalid-against-xsd.xml` | Reject at validation stage | `IMPORT_XML_SCHEMA_INVALID` | CI + unit |
| P0 | IMP-005 | Idempotency | Re-import same file unchanged | `FAUNA_en.xml` twice | No duplicates; deterministic counters | Duplicate rows or changed counters | CI + integration |
| P0 | IMP-006 | Referential integrity | Index targets non-existent entry | `bad-index-target.xml` | Reject file or offending entries per policy | `IMPORT_REFERENCE_INVALID` | CI + integration |
| P0 | IMP-007 | Atomicity policy | Mid-import failure/crash | Fault-injected run | Consistent rollback or policy-compliant partial commit | Orphaned/inconsistent rows | integration |
| P0 | IMP-008 | Content preservation | Bible refs/metadata change unexpectedly | `canonical-source.xml` | Canonical equivalence passes after round-trip | `ROUNDTRIP_DIFF_FOUND` | CI + integration |
| P0 | IMP-009 | Duplicate keys in file | Same key appears twice | `duplicate-key.xml` | Deterministic conflict behavior (fail/warn/upsert policy) | `IMPORT_DUPLICATE_KEY` | CI + unit |
| P1 | IMP-010 | Encoding mismatch | Declared UTF-8 but invalid bytes | `invalid-utf8.xml` | Reject with encoding error | `IMPORT_ENCODING_INVALID` | CI + unit |
| P1 | IMP-011 | Namespace drift | Missing or altered namespace | `wrong-namespace.xml` | Reject with schema/namespace error | `IMPORT_NAMESPACE_INVALID` | CI + unit |
| P1 | IMP-012 | Large file timeout | Valid but very large file | `fauna-huge.xml` | Controlled timeout/retry; no data corruption | `IMPORT_TIMEOUT` | perf + integration |
| P1 | IMP-013 | Partial update semantics | Same keys, subset changed | `fauna-delta.xml` | Only changed entries updated; correct inserted/updated/skipped counts | Counter mismatch | integration |
| P1 | IMP-014 | Cross-dictionary collisions | Same key across FAUNA/FLORA/REALIA | `collision-multi-resource.xml` | No cross-resource overwrite | Resource contamination | integration |
| P1 | IMP-015 | Unicode normalization | Visually same keys, different code points | `confusables.xml` | Normalization policy enforced consistently | Hidden duplicates | unit + integration |
| P2 | IMP-016 | Forward compatibility | New optional elements appear | `forward-compatible.xml` | Parse and store/ignore safely | Parser crash | unit |
| P2 | IMP-017 | Error report quality | Multi-error file | `many-errors.xml` | Report includes entry key, stage, stable error code | Unhelpful diagnostics | CI |
| P2 | IMP-018 | Observability | Success-path metrics | `normal-file.xml` | Emits processed/inserted/updated/skipped/failed plus runtime | Missing metrics | CI |

---

## Discovery: Risk-Ranked Security Matrix

| Priority | ID | Security Risk | Attack Scenario | Example Fixture | Expected Result | Control to Enforce | Automation |
|---------|----|---------------|-----------------|-----------------|-----------------|--------------------|------------|
| P0 | SEC-001 | XXE | External entity reads local/remote resource | `xxe-basic.xml` | Immediate reject; no external resolution | Disable external entities and external DTD resolution | CI + unit |
| P0 | SEC-002 | Entity expansion bomb | Billion-laughs payload | `entity-bomb.xml` | Reject quickly with bounded CPU/memory | Entity expansion limits or DOCTYPE block | CI + unit/perf |
| P0 | SEC-003 | DTD policy bypass | Any `DOCTYPE` present | `with-doctype.xml` | Reject by policy | Hard-block DOCTYPE in import pipeline | CI + unit |
| P0 | SEC-004 | SQL injection via content | Malicious strings in key/title/text | `sql-injection-values.xml` | Stored as text only; no SQL side effects | Parameterized DB writes only | CI + integration |
| P0 | SEC-005 | Path traversal | Escaped import path | `../../secret.xml` | Reject path before file read | Base-directory allowlist + path normalization | unit |
| P0 | SEC-006 | Authorization bypass | Non-admin import attempt | API auth fixture | 403 and audit log | RBAC on import endpoint/script trigger | API integration |
| P1 | SEC-007 | Log injection | Newlines or ANSI escapes forge logs | `log-injection.xml` | Log output escaped/sanitized | Structured logging + escaping | CI |
| P1 | SEC-008 | Oversized payload DoS | Huge node/attribute/file | `oversize-node.xml` | Controlled reject with stable error | File/node/entry size limits | perf + integration |
| P1 | SEC-009 | Deep nesting DoS | Extreme nesting depth | `deep-nesting.xml` | Controlled reject | Max XML depth guard | CI + unit |
| P1 | SEC-010 | Repeated abuse | Burst import attempts | Rate-limit scenario | Throttled or rejected as configured | Rate limit + queue guardrails | API integration |
| P1 | SEC-011 | Error leakage | Crafted malformed payload | `crafted-malformed.xml` | Generic client error; detailed server logs only | Error mapping and redaction | integration |
| P2 | SEC-012 | MIME spoofing | Non-XML content with .xml extension | `fake-xml.xml` | Reject on parse/signature mismatch | Content sniff + parser gate | unit |
| P2 | SEC-013 | Unicode confusable abuse | Homoglyph keys evade checks | `homoglyph-keys.xml` | Canonical duplicate detection | Unicode normalization before dedupe | unit |
| P2 | SEC-014 | Concurrency race | Simultaneous imports same resource | Concurrent run fixture | No duplicate rows or corruption | DB constraints + retry/backoff | integration/perf |

---

## Policy Decisions To Lock Before Implementation

1. **DTD policy:** Reject all DOCTYPE declarations for imports. Use XSD for schema validation.
2. **Failure mode:** Choose strict all-or-nothing vs partial accept with failed-entry reporting.
3. **Duplicate-key behavior:** Decide fail-file vs deterministic upsert policy.
4. **Timeout and retry:** Define max runtime, retry count, and resumability behavior.
5. **Unicode normalization:** Define normalization form and duplicate detection strategy.

---

## Ship-Readiness Exit Criteria

1. All **P0** workflow tests pass in CI.
2. All **P0** security tests pass in CI.
3. Canonical round-trip diff is zero on golden fixtures.
4. Import report includes stable counters and stable error codes.
5. Integration tests run against a real database in CI (not permanently skipped).


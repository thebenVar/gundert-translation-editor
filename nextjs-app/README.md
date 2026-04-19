# Gundert Translation Editor — Next.js App

This is the active MVP application for the Gundert Translation Editor. It contains the current Next.js 16 app, the Phase 1 UBS importer work, the database schema, and the browser or lexicon experience under test.

## Scope

Current repo surface in `nextjs-app/`:

- Next.js 16 App Router application
- React 19 + TypeScript
- Neon Postgres via Drizzle ORM
- Auth.js v5 credentials flow
- UBS XML parser and importer pipeline
- Browser or lexicon route for imported entries
- Translator page scaffold
- Jest-based unit, contract, smoke, and DB integration tests

## Key Routes

- `/` — home page
- `/lexicon` — current browser implementation for imported resources
- `/browser` — compatibility route that redirects to `/lexicon`
- `/translator` — translator workbench page scaffold
- `/api/resources/entries` — paginated entry list API
- `/api/import` — import endpoint
- `/api/translate` — translation endpoint

## Data Sources

Phase 1 currently centers on the three UBS XML dictionaries stored under `data/xml/`:

- `FAUNA_en.xml`
- `FLORA_en.xml`
- `REALIA_en.xml`

The parser and importer tests use these files directly.

## Commands

Run all commands from `nextjs-app/`.

```bash
npm install
npm run dev
npm run lint
npm test
npm run test:db
npm run db:push
npm run import:ubs
npm run validate:roundtrip
```

## Testing Snapshot

Last verified on 2026-04-19:

- `npm test` -> 13 passing suites, 2 skipped suites
- 254 passing tests, 82 skipped tests
- DB suites are gated behind `RUN_DB_INTEGRATION_TESTS=true` and `POSTGRES_URL_NON_POOLING`

Current test coverage includes:

- XML parser and importer contracts
- Import risk and security matrices
- Browser query, status, resource-filter, and URL helpers
- `/lexicon` route smoke tests
- `/api/resources/entries` query handling
- DB schema and import integration tests

## Notes

- Some smoke tests hit `http://localhost:3000` directly, so keep the dev server running when working on route-level behavior.
- `/browser` is kept as a redirect for compatibility, but active work is happening on `/lexicon`.
- Read the root `AGENTS.md` and `nextjs-app/AGENTS.md` before making changes in this app.

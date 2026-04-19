# Gundert Translation Resource Editor

A modern, multi-org translation platform for translating diverse Bible-related resources from multiple sources. Supports resources from UBS, unfoldingWord, SIL, Tyndale, Strong's Lexicon, and other biblical scholarship sources.

Core product promise:
Any supported source resource can move through AI-assisted drafting, collaborative translation, built-in project management, and AI-assisted validation to produce a round-trippable export in the same structure and format, with full version traceability and optional community feedback loops.

Phase 1 north-star metric:
Median time to validated export (from resource import to approved, round-trippable export for one resource version).

**Key Features:**
- Multi-source resource support (UBS dictionaries, lexicons, theology resources, translations, commentaries, etc.)
- Multi-format import (XML, JSON, Markdown, SFM, and more)
- AI-assisted drafting and AI-assisted validation
- Collaboration workflows (translator, reviewer, admin)
- Built-in project management (status, assignment, progress tracking)
- Community feedback on translated entries
- Source-preserving translation pipeline (protected zones, structured editing)
- Deterministic and LLM-based validation
- Round-trip validation (import -> DB -> export) with format and structure preservation
- Multi-language, multi-org support with role-based access control
- Progressive Next.js 16 architecture with Postgres backend

## Repository Structure

- index.html
  - Root app selector page for end users
  - Routes to MVP path and legacy PoC path
- nextjs-app/
  - Active Next.js application (source, API routes, tests, DB schema)
  - app/, lib/, tests/, data/, drizzle/, public/
- legacy-poc/
  - Preserved pre-Next.js proof-of-concept application
  - pages/, assets/, tests/, v01/, index.html
- scripts/
  - Data processing and generation scripts
- docs/
  - Project documentation and trackers

## Legacy Entry Points (PoC)

The original static HTML PoC is preserved under `legacy-poc/`.

The active product surface is in Next.js 16 with React components:
- `/` - Home page (authentication gateway)
- `/browser` - Resource browser (mobile-first, modern UI)
- `/translator` - Translation workbench (AI-assisted drafting and validation)

**Legacy files (preserved for reference):**
- `legacy-poc/pages/browser.html`, `legacy-poc/pages/translator.html` - Original PoC UI
- `legacy-poc/assets/js/browser.js`, `legacy-poc/assets/js/translator.js` - Legacy JavaScript logic

## Data Format Support

The editor accepts translation resources in multiple formats:
- **XML** - UBS dictionaries (ThematicLexicon format), OSIS Bibles
- **JSON** - Structured lexicons, metadata bundles
- **Markdown** - Commentary entries, theology resources
- **SFM** (Standard Format Marker) - USFM/USX Bible text and lexicons
- **CSV/TSV** - Glossaries, term lists

## Working With Data Scripts

Run data processing scripts from the repository root:

- `node scripts/analyze_dictionaries.js` - Parse XML dictionaries into JSON format
- `node scripts/analyze_sfm.js` - Parse SFM/USFM files

Outputs are written to `nextjs-app/data/` directory.

## Development

```bash
# Enter active app workspace
cd nextjs-app

# Start dev server
npm run dev

# Run database migrations
npm run db:migrate

# Generate database schema migrations
npm run db:generate
```

Dev server runs on `http://localhost:3000`

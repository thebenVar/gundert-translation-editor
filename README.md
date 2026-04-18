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

- pages/
  - Main application pages and dictionary views
- assets/
  - Shared frontend assets
  - css/
  - js/
- data/
  - Runtime data and source corpora
  - entries.js, entries.json, stats.json
  - images/, xml/, sfm/
- scripts/
  - Data processing and generation scripts
- tests/
  - Browser test runner and test scripts
  - css/, js/
- docs/
  - Project documentation and trackers
- v01/
  - Legacy snapshot content

## Legacy Entry Points (PoC)

The original static HTML pages have been migrated to a Next.js 16 app with React components:
- `/` - Home page (authentication gateway)
- `/browser` - Resource browser (mobile-first, modern UI)
- `/translator` - Translation workbench (AI-assisted drafting and validation)

**Legacy files (preserved for reference):**
- `pages/browser.html`, `pages/translator.html` - Original PoC UI
- `assets/js/browser.js`, `assets/js/translator.js` - Legacy JavaScript logic

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

Outputs are written to `data/` directory.

## Development

```bash
# Start dev server
npm run dev

# Run database migrations
npm run db:migrate

# Generate database schema migrations
npm run db:generate
```

Dev server runs on `http://localhost:3000`

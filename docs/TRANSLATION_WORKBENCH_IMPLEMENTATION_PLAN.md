# Translation Workbench Implementation Plan

This plan defines how to build a **generic translation resource editor** that supports diverse translation resources (UBS dictionaries, lexicons, Bibles, commentaries from UBS, unfoldingWord, SIL, Tyndale, Strong's Lexicon, etc.) while preserving source integrity and protecting non-translatable content.

## 1) Objectives

- Core promise: deliver round-trippable, format-preserving exports through AI-assisted drafting, collaborative workflows, built-in project management, AI-assisted validation, and optional community feedback.
- Phase 1 north-star metric: median time to validated export (resource import -> approved round-trippable export).
- Support translation of resources from **multiple sources** in **multiple formats** (XML, JSON, Markdown, SFM, CSV)
- Keep source files immutable and maintain audit trail of translations
- Produce target-language resource files alongside source (preserving directory structure and format)
- Translate by whole entry/section for context-aware MT, protecting non-translatable zones (references, metadata, structure)
- Validate with deterministic checks, LLM QA checks, and format-specific schema validation
- Provide translator-first UI with side-by-side source and target views
- Support multi-org translation workflows with role-based access (Admin, Translator, Reviewer)
- Support project management capabilities (assignment, status, milestones, throughput visibility)
- Support community feedback intake for translated entries (advisory only, no process authority)
- Surface community reception metrics to translators and reviewers as quality signal and motivation

### 1.1 Metric Definition (Phase 1)

- **North-star:** Median time to validated export.
- **Start event:** Resource version import completed.
- **End event:** Export generated in source format and passes round-trip validation checks with status `approved`.
- **Scope:** Measured per resource version; report median across completed runs.

### 1.2 Phase 1 Wedge (Accepted)

- Wedge: one complete UBS workflow, implemented against all three current UBS dictionary resources.
- Initial resource set:
  - FAUNA
  - FLORA
  - REALIA
- Rationale: once the shared XML importer, schema mapping, validation, and export pipeline are implemented, marginal effort to include the second and third dictionary is low.
- Main incremental risk is data-shape edge cases, not workflow complexity.
- Execution rule: treat any per-dictionary mapping exception as a parser/normalizer fix, not a one-off manual workaround.

### 1.3 AI Trust Boundary (Accepted)

- AI may draft translations and suggest validation findings.
- Only a human with Translator or Reviewer role can move an entry to `ready_for_review` or `approved` status.
- AI output is always surfaced as a suggestion, never auto-promoted to approved.
- Audit trail must log which entries were AI-drafted vs human-authored.

### 1.4 Custom Prompt Library (Accepted)

- Each user can create and save multiple named prompt profiles.
- Prompts cover different behaviors and tasks (drafting style, register, literal vs idiomatic, domain focus, etc.).
- Prompts are stored per user and optionally shared at org level.
- Users select the active prompt profile before running AI drafting.
- Built-in system prompts provided as a starting point; users may extend or override.
- User-saved prompts persist across sessions and devices (stored in database).
- Prompt schema:
  - `name` — display name (required)
  - `description` — short description (optional)
  - `system_prompt` — full prompt text (required)
  - `task_type` — one of: `draft`, `validate`, `suggest`, `review`
  - `is_shared` — boolean; if true, visible to all org members
  - `created_by` — user FK
  - `org_id` — org FK (null = personal only)

### 1.5 Community Feedback Model (Accepted)

- Community feedback is **advisory only** — it has zero authority over entry status or workflow steps.
- Primary goals:
  1. Signal to translators/reviewers how the community is receiving translated entries.
  2. Create healthy competition — visible quality scores motivate translators to get entries right the first time.
- Feedback types:
  - **Upvote / downvote** — quick quantitative reaction
  - **Comment** — qualitative text suggestion
  - **Flag** — report a specific issue with a severity tag (e.g., `inaccurate`, `unclear`, `offensive`)
- Feedback is aggregated and shown on the entry card visible to translators and reviewers.
- No feedback action can change entry status or trigger a mandatory re-review.
- Community members = authenticated users with a Reader role (not Translator/Reviewer/Admin).
- Future consideration: per-org leaderboard for translator quality scores based on community reception.

### 1.6 Build Order (Accepted)

Phase 1 implementation sequence:

1. **Database schema** — expand Drizzle schema: resources, resource_versions, resource_entries, entry_translations, entry_custom_fields, prompt_profiles, community_feedback
2. **UBS XML importer** — import FAUNA, FLORA, REALIA with round-trip validation
3. **Browser UI** — mobile-first, all agreed search/filter/status/scope/state decisions
4. **Translator workbench** — side-by-side editing, AI draft, custom prompt profiles
5. **Validation pipeline** — deterministic + LLM checks, AI-suggested findings
6. **Export engine** — source-only and extended modes, format-preserving
7. **Community feedback UI** — reader role, upvote/downvote/flag/comment on entries

### 1.7 Development Workflow (Accepted)

Every feature follows this sequence without exception:

```
PRD → User Stories → GitHub Issues → Failing Tests (TDD) → Implementation → Passing Tests → E2E Tests → Release
```

- **PRD**: feature requirement written before any code
- **User stories**: acceptance criteria defined per story, linked to GitHub issue
- **GitHub Issues**: one issue per story; labels for phase, type, status
- **Failing Tests**: tests written first and committed before implementation begins
- **Implementation**: code written to make failing tests pass
- **Passing Tests**: all unit and integration tests green before merge
- **E2E Tests**: end-to-end browser tests verify full user flow
- **Release**: tagged release with CHANGELOG entry

No feature proceeds to implementation without a passing-test gate.
No release proceeds without E2E tests passing.

## 2) Current State (PoC Snapshot)

- Browser runtime reads generated `data/entries.js` in `pages/browser.html` (legacy static HTML)
- Original PoC supports three UBS dictionary samples: FAUNA, FLORA, REALIA (all XML)
- Existing XML-to-JS script in `scripts/analyze_dictionaries.js`
- No `.xsd` files currently exist in repository
- **Now migrating to:** Next.js 16 + React + Postgres backend for multi-org, multi-resource, multi-format support

## 3) Target Architecture

### 3.1 Multi-Source, Multi-Format Data Flow

**Supported Sources & Formats:**
- UBS Resources (XML/JSON/Markdown)
- unfoldingWord Resources (JSON/Markdown)
- SIL Resources (SFM/XML)
- Tyndale Resources (JSON)
- Strong's Lexicon (JSON/XML)
- Custom resources (user-uploaded)

**Data Flow:**
1. **Source resources** (read-only, immutable):
   - Stored in versioned resource library
   - Multiple formats: XML, JSON, Markdown, SFM, CSV
   - Each resource has metadata (source, language, version, format)

2. **Translation workbench pipeline**:
   - Parse entry/section (format-specific parser)
   - Freeze protected nodes/tokens (references, markup, structural metadata)
   - Optional MT draft (whole-entry or section-based)
   - Translator edits in UI
   - Validation pipeline (deterministic + LLM checks)

3. **Target resource output**:
   - Same format as source (XML→XML, JSON→JSON, Markdown→Markdown)
   - Alongside source in versioned resource library
   - Audit trail and translator attribution
   - Status tracking (draft, submitted, approved, published)

### 3.2 Resource Versioning & Export

**Version Management:**
- Multiple versions of the same resource can coexist (e.g., UBS Lexicon v1.0 and v2.0)
- Each resource version is immutable once imported
- Translations are tied to a specific resource version
- New versions can be imported as updates without affecting existing translations

**Export Format Preservation:**
- Export maintains original format: XML→XML, JSON→JSON, Markdown→Markdown, SFM→SFM
- Directory structure and file organization mirror source
- Encoding and special characters preserved

**Export Modes:**
1. **Source-only mode**: Translated content only, no custom fields
   - Output matches source structure exactly
   - Suitable for direct publication/distribution
2. **Extended mode**: Translated content + custom user-added fields
   - Additional fields stored separately or in supplementary section
   - Includes translator metadata (attribution, timestamp, notes)

**Custom Fields:**
- Users can add metadata not in source (translator notes, context, internal links, etc.)
- Stored separately in database (`entry_custom_fields` table)
- Does not modify source content
- Can be excluded from export if desired

### 3.3 Bible Reference Handling (Storage vs. Display)

**Storage Layer:**
- Store Bible references in **original format from source** (e.g., UBS mnemonics)
- Preserve exactly as provided (do not normalize or convert)
- Example: Store `G2424-I-21` (mnemonic) as-is

**Display Layer:**
- Convert mnemonic → USFM-compatible, human-readable format
- Example: Display `G2424-I-21` as `John 3:16` in UI
- Conversion happens at read-time for display only

**Conversion Module:**
- Build reference converter (`lib/bible-reference-converter.ts`)
- Mappings for UBS mnemonics, other reference systems
- Extensible for future reference formats

### 3.4 Database Schema (Multi-Org, Multi-Resource, Versioning)

**Core Tables:**
- `organizations` - Multi-org support (translation teams, institutions)
- `users` - Team members with roles
- `org_members` - User-org relationships with role assignments (Admin, Translator, Reviewer)
- `resources` - Resource metadata (title, source provider, format, source language)
- `resource_versions` - Version tracking (version number, release date, import timestamp, file hash)
- `resource_entries` - Entries/sections within a resource (key, source content, structure, format metadata)
- `entry_translations` - Translations (language, translator, status, timestamp)
- `entry_custom_fields` - User-added fields (separate from source, optional on export)
- `drafts` - In-progress translations
- `draft_events` - Audit trail
- `org_api_keys` - API credentials for import/export

**Design Principle:** Source data and custom user data are **strictly separated**, enabling clean export with/without custom fields.

### 3.5 Component Breakdown

- **Resource Ingestion Pipeline**: Parse source files (XML/JSON/Markdown/SFM), extract entries, import into database with version tracking
- **Format Registry**: Pluggable parsers/serializers for each supported format
- **Reference Converter**: Mnemonic/other format ↔ USFM conversion
- **Export Engine**: Format-aware serialization with two modes (source-only, extended)
- **Draft Editor**: In-memory working state for translations
- **Validation Pipeline**: Deterministic + LLM checks
- **Translation Workbench UI**: React component for side-by-side editing with custom field support
- **Resource Browser UI**: Mobile-first resource discovery and entry viewing

**Browser retrieval pattern (Phase 1 decision):**
- Hybrid: server-rendered initial load + client-side paginated fetch + short-lived cache.
- URL query params are the source of truth for search/filter/pagination state.
- Cache scope includes resource list, current result pages, and selected entry details.
- Cache invalidates on resource version change, target language change, or filter scope reset.

**Browser mobile UX decision:**
- Master-detail pattern on mobile (list first, full-screen detail on select, explicit Back action).
- Split-view on tablet/desktop when viewport width permits.

**Browser list-state persistence decision (accepted):**
- Preserve list query, scope, filters, language, sort, selected item, and scroll position when moving between list and detail.
- Persist state for the active session and clear only on explicit user reset.

**Browser search decision:**
- Unified search (single input, no search-mode toggle).
- Query pipeline searches entry key, title, indexed content snippets, and Bible references.
- Reference matching supports both human-readable input and source mnemonic forms.
- Result metadata includes matched field type for ranking and user clarity.
- Query pipeline supports translation-status filtering for the selected target language.

**Browser ranking policy (accepted):**
- 1) exact entry key
- 2) exact title
- 3) title prefix
- 4) exact Bible reference
- 5) content snippet
- deterministic tie-breakers: resource priority, then alphabetical title

**Browser scope-selector decision (accepted):**
- Two-layer model:
  - Layer 1: visible scope chips (`All`, `Selected Resources`, `Current Resource`)
  - Layer 2: on-demand resource picker drawer for multi-selecting resource versions
- Default search scope is `Selected Resources` when selections exist; otherwise `Current Resource`.

**Browser empty-state decision (accepted):**
- On zero results, show explicit reason based on active query/scope/filters.
- Primary action: `clear_filters`.
- Secondary action: `switch_scope`.
- Provide direct `open_resource_picker` action for fast scope widening.

**Browser translation-status filter decision (accepted):**
- Add status filter in browser UI and API query model.
- Phase 1 statuses: `untranslated`, `draft`, `ready_for_review`, `approved`.
- Status is evaluated per selected target language.
- Status filter and language are both part of URL state and cache key derivation.
- Default first-load behavior: `all_statuses`.
- Add quick preset `needs_work` = (`untranslated` OR `draft`).

**Browser target-language default decision (accepted):**
- Resolution order: user preference -> organization default -> project fallback (`ml` in current UBS phase).
- Selected target language drives status calculations, query filters, and cache key derivation.
- Persist user language changes to profile preferences.

**Cache freshness defaults (accepted):**
- Entry list pages TTL: 60 seconds
- Entry detail payload TTL: 5 minutes
- Immediate invalidation on resource version change
- Immediate invalidation on target language change
- Immediate invalidation on major filter scope reset

### 3.6 Round-Trip Validation (Import -> DB -> Export)

Round-trip validation is mandatory for every import/export implementation and every new resource version.

**Validation Goal:**
- For `source-only` export mode, output must be structurally equivalent to the original source format.
- For `extended` export mode, output must preserve source structure while adding custom fields only in allowed extension points.

**Phase 1 strictness decision:**
- Canonical structural equivalence (not byte-for-byte equality).
- After canonicalization, structure/protected fields/references/entry keys-order must match exactly.
- Whitespace-only and attribute-order-only differences are allowed.

**Phase 1 Scope (UBS XML resources):**
- Inputs: `FAUNA_en.xml`, `FLORA_en.xml`, `REALIA_en.xml`
- Process:
1. Import original XML into `resources`/`resource_versions`/`resource_entries`
2. Export immediately with no translation changes (`source-only`)
3. Compare original vs exported using canonical XML normalization
4. Validate protected nodes and reference values are unchanged
5. Validate mnemonic Bible references are stored raw and display-converted only

**Pass/Fail Gates:**
- Blocking fail if any protected node changes
- Blocking fail if entry keys/order or reference fingerprints differ
- Blocking fail if serializer cannot reconstruct required nodes
- Warning (non-blocking) for whitespace-only diffs after canonicalization

**Artifacts per run:**
- `roundtrip-report.json` with checks, counts, and failures
- `roundtrip-diff.txt` with normalized structural diff summary
- Per-entry failure list for targeted debugging

### 3.7 Draft JSON Contract (Editor State)

Source and final deliverables remain XML. The translator UI uses a structured JSON draft model as an intermediate editing state.

#### XML -> JSON -> XML pipeline

1. Parse source XML entry into source-anchored JSON blocks.
2. Apply MT draft and human edits on JSON blocks.
3. Run deterministic, policy, and quality validation on JSON.
4. Serialize validated JSON back into target XML.

#### Top-level shape (v1)

```json
{
  "schemaVersion": "1.0",
  "entryKey": "A123",
  "source": {
    "dictionary": "FAUNA",
    "sourceLang": "en",
    "targetLang": "fr",
    "sourceHash": "sha256:..."
  },
  "metadata": {
    "updatedAt": "2026-04-17T12:00:00.000Z",
    "updatedBy": "translator-id",
    "status": "draft"
  },
  "blocks": [],
  "operations": []
}
```

#### Block shape

```json
{
  "id": "blk-0001",
  "class": "source-mapped",
  "type": "paragraph",
  "sourceAnchor": {
    "sectionId": "discussion",
    "sourcePath": "ThemLex_Entry[Key='A123']/Section[Content='discussion']/Para[2]"
  },
  "content": {
    "text": "..."
  },
  "flags": {
    "locked": false,
    "protected": false
  },
  "order": 12
}
```

For target-only blocks:

- `class` must be `target-only`
- `type` must be one of `target-title-override`, `target-subheading`, `target-paragraph`, `translator-note`
- `sourceAnchor` may be null
- `metadata.rationale` is optional in pilot and may become required later

#### Operation log shape

```json
{
  "opId": "op-0008",
  "kind": "split-paragraph",
  "timestamp": "2026-04-17T12:01:00.000Z",
  "blockId": "blk-0001",
  "details": {
    "from": 1,
    "to": 2
  }
}
```

Supported operation kinds in v1:

- `edit-content`
- `insert-target-only`
- `delete-target-only`
- `move-block`
- `split-paragraph`
- `merge-paragraphs`

#### Round-trip requirements

- Every required source-mapped block must be representable in JSON and reconstructable to XML.
- JSON must preserve source anchors for source-mapped blocks after move/split/merge operations.
- Target-only blocks must serialize into allowed target XML extension points only.
- If round-trip confidence is below policy threshold, export must fail as blocking.

## 4) Translatable vs Protected Rules

## 4.1 Always Protected (must not change)

- `ThemLex_Entry@Key`
- `Section@Content`
- `IndexItem` targets and cross-entry pointer attributes
- `Reference` values (including 14-digit references)
- `LanguageSet` scaffolding and language metadata
- `Lemma`, `Transliteration` values (default protected policy)
- `BibleImage` metadata fields (`Collection`, `Path`, `FileName`, etc.)
- Structural order of required nodes

## 4.2 Translatable (default)

- `Title` text
- `Heading` text
- Paragraph text in semantic prose sections such as:
  - discussion
  - description
  - translation
  - special significance or symbolism
  - other
  - description and usage
  - usage

## 4.3 Conditional

- Index label text may be translated in a later phase if pointer consistency checks remain green.
- If enabled, enforce target integrity checks after each translated index label.

## 5) Validation Strategy

## 5.1 Deterministic Validator (blocking)

- XML well-formedness
- Required nodes present
- Protected node fingerprint unchanged
- Reference cardinality and values unchanged
- Key and target attribute equality
- Entry ordering/key map unchanged

## 5.2 Round-Trip Deterministic Checks (blocking)

- Import/export idempotence in `source-only` mode for unchanged entries
- Canonical XML structure equivalence (namespace-aware)
- Protected node checksum equality
- Reference checksum equality (including mnemonic representations)
- Required attribute presence and value equality
- Entry count and key-set equality per resource version

## 5.3 Display Conversion Checks (non-mutating)

- UBS mnemonic references must remain unchanged in storage and export
- UI conversion to USFM/human-readable form must be reversible or traceable via mapping
- No write-back of display-converted references into source data tables

## 5.2 LLM Validator (blocking or warning by policy)

- Detect accidental translation or mutation of protected items
- Detect dropped/merged paragraph content
- Detect suspicious theological/technical term drift
- Return structured report:
  - `errors[]`
  - `warnings[]`
  - `suggested_fixes[]`

## 5.3 XSD Validator (blocking)

- Validate output against newly added schema files.
- Run on each saved entry and in batch CI mode.

## 6) Machine Translation Mode

- Whole-entry translation by default for context retention.
- Prompt profiles stored in config and editable by translators.
- Required prompt constraints:
  - Preserve protected placeholders exactly.
  - Do not alter references, keys, or original-language terms.
  - Maintain paragraph boundaries.

## 7) Translator UI Requirements

- New page: `pages/translator.html`
- Split panes:
  - Left: source entry (read-only)
  - Right: target entry (editable)
- Actions:
  - Translate Entry
  - Re-run with Prompt
  - Save Draft
  - Validate
  - Mark Ready
- Validation drawer with blocking errors first
- Section-to-section jump links between source and target

## 7.1 Adaptation Editing Model

The workbench must support adaptation without losing source traceability. The target side should therefore use a hybrid model rather than a free-form document model.

### Canonical editing principle

- Source-derived content remains the canonical backbone of the target entry.
- Target-added content is allowed, but must be explicitly marked as target-original.
- Free-form editing must not become the system of record for exported XML.

### Target block classes

1. Source-mapped blocks
   - Derived directly from source `Title`, `Heading`, and prose paragraph units.
   - Each block carries a stable source anchor.
   - These blocks are the main units for translation, QA, and export.

2. Target-only blocks
   - Added by the translator for adaptation purposes.
   - Allowed initial types:
     - target title override
     - target subheading
     - target explanatory paragraph
     - translator note
   - Each target-only block must carry:
     - block type
     - insertion position
     - author or provenance metadata if available
     - optional rationale

3. Presentation ordering metadata
   - If target reading flow differs from source order, store that as ordering metadata.
   - Do not lose the original source anchor when blocks are moved.

### Allowed edit operations

#### Allowed on source-mapped blocks

- edit translated title text
- edit translated heading text
- edit translated paragraph text
- split one source paragraph into multiple target paragraphs if each target paragraph keeps the same source anchor group
- merge consecutive source paragraphs only if the relationship is explicitly recorded in metadata
- reorder source-mapped blocks only if original anchor order remains recoverable

#### Allowed on target-only blocks

- insert new target-only subheading
- insert new target-only explanatory paragraph
- insert translator note
- edit target-only block text
- move target-only block within the same entry
- delete target-only block

#### Not allowed initially

- deleting required source-mapped blocks
- converting source-mapped blocks into unanchored free text
- editing protected references, keys, cross-entry pointers, or metadata scaffolding
- arbitrary WYSIWYG formatting that cannot round-trip into the target XML contract

### Proposed interaction rules

- The UI should visually distinguish source-mapped and target-only blocks.
- Insert controls should appear between target blocks, not inside protected metadata regions.
- Target-only blocks should be collapsible or filterable so reviewers can isolate adaptation additions quickly.
- A reader preview may hide structural labels, but the editing model underneath remains structured.

## 7.2 Validation Policy For Adaptation

Use a three-tier validation model so adaptation flexibility does not weaken structural guarantees.

### Tier 1: Hard-blocking integrity checks

- every required source-mapped block is present
- protected references and identifiers are unchanged where policy requires
- exported target XML remains schema-valid
- source-anchor graph is consistent after splits, merges, or moves

### Tier 2: Structural adaptation checks

- target-only blocks use an allowed block type
- insertions occur only in allowed positions
- merge and split operations are represented with explicit metadata
- ordering changes remain explainable from stored anchor metadata

Default policy: warning during pilot, blocking after pilot hardening if false positives are acceptably low.

### Tier 3: Editorial quality checks

- suspicious omissions
- excessive expansion relative to source
- terminology drift against glossary locks
- target-only additions without rationale where rationale is required by project policy

Default policy: warning.

## 7.3 Free Editing Environment Evaluation

A Google Docs-style or Markdown-style free editor may be useful as a convenience layer, but should not be the canonical editing model.

### Benefits

- more natural translator writing flow
- easier target-side restructuring during adaptation
- lower friction for adding connective or explanatory material

### Risks

- weak source-to-target traceability
- difficult deterministic validation
- harder re-import after source revisions
- increased risk of silent structure drift
- export ambiguity if free text must later be reconstructed into XML structure

### Recommendation

- Do not adopt free editing as the authoritative storage model.
- If introduced later, treat it as a derived editing or preview mode backed by the structured block model.
- Any free-edit save path must either:
  - round-trip cleanly into structured blocks with high confidence, or
  - be stored as a separate adaptation artifact pending review.

## 8) Proposed File-by-File Work Plan

### 8.1 New Files

- `scripts/translation/translate_entries.js`
- `scripts/translation/freeze_rules.js`
- `scripts/translation/validate_deterministic.js`
- `scripts/translation/validate_llm.js`
- `scripts/translation/validate_xsd.js`
- `scripts/translation/prompt_profiles.json`
- `schemas/thematic_lexicon.xsd`
- `pages/translator.html`
- `assets/js/translator.js`
- `assets/css/translator.css`

### 8.2 Existing Files to Update

- `scripts/analyze_dictionaries.js`
  - align output contract with browser runtime (`ALL_DICTIONARY_ENTRIES`)
  - support optional language-specific source selection
- `pages/browser.html`
  - add entry-point button/link to Translation Workbench
- `README.md`
  - add translation workflow commands and validation steps

## 9) Commands (proposed)

- `node scripts/translation/translate_entries.js --src data/xml/FAUNA_en.xml --lang fr --mode draft`
- `node scripts/translation/validate_deterministic.js --src data/xml/FAUNA_en.xml --tgt data/xml/FAUNA_fr.xml`
- `node scripts/translation/validate_xsd.js --file data/xml/FAUNA_fr.xml --schema schemas/thematic_lexicon.xsd`
- `node scripts/analyze_dictionaries.js --lang fr`

## 10) Rollout Plan

1. Foundation: deterministic validator + freeze rules + output contract alignment.
2. MT draft mode: prompt profiles + whole-entry translation.
3. Translator UI: side-by-side editor + validation panel.
4. XSD + CI checks: fail fast on structural regressions.
5. Pilot with one dictionary (FAUNA), then FLORA, then REALIA.

## 11) Acceptance Criteria

- Source XML files remain unchanged after full run.
- Target XML passes deterministic validator and XSD validator.
- Protected token integrity = 100%.
- No broken references in rendered browser output.
- Translator can complete entry flow in UI without manual file editing.

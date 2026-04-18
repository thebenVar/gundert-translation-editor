# Translation Workbench Implementation Plan

This plan defines how to add translation support while keeping source XML files intact and preserving protected content (references, original-language forms, keys, and structural metadata).

## 1) Objectives

- Keep source files immutable in `data/xml/*_en.xml`.
- Produce target-language XML files as siblings (example: `FAUNA_fr.xml`).
- Translate by whole entry for context-aware MT, but protect non-translatable zones.
- Validate with deterministic checks, LLM QA checks, and XSD validation.
- Provide translator-first UI with side-by-side source and target views.

## 2) Current State Constraints (from repository)

- Browser runtime reads generated `data/entries.js` in `pages/browser.html`.
- Viewer expects `ALL_DICTIONARY_ENTRIES` in `assets/js/browser.js`.
- Existing XML-to-JS script exists in `scripts/analyze_dictionaries.js`.
- No `.xsd` files currently exist in repository.

## 3) Target Architecture

### 3.1 Data Flow

1. Source XML (read-only):
   - `data/xml/FAUNA_en.xml`
   - `data/xml/FLORA_en.xml`
   - `data/xml/REALIA_en.xml`
2. Translation workbench pipeline:
   - Parse entry
   - Freeze protected nodes/tokens
   - Optional MT draft (whole-entry)
   - Translator edits
   - Validation pipeline
3. Target XML output:
   - `data/xml/FAUNA_<lang>.xml`
   - `data/xml/FLORA_<lang>.xml`
   - `data/xml/REALIA_<lang>.xml`
4. Build step generates language-specific entries bundle(s) for browser.

### 3.2 Components

- Translation CLI: extract, draft-translate, validate, and write output.
- Prompt profile manager for MT system prompts.
- Deterministic validator (hard-blocking failures).
- LLM validator (quality and token-preservation checks).
- XSD schema + validator.
- Translator UI page (`pages/translator.html`).

### 3.3 Draft JSON Contract (Editor State)

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

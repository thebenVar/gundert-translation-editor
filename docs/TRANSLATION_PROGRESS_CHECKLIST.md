# Translation Workbench Progress Checklist

Use this tracker to execute and monitor the POC's translation feature delivery.

Single point of truth:
- This document is the authoritative status log for translation work.
- Implementation decisions and phase readiness should be reflected here first.

## Current Snapshot (2026-04-15)

- Overall status: Amber
- Completed foundation:
  - Contract compatibility export added in `scripts/analyze_dictionaries.js` (`ALL_DICTIONARY_ENTRIES` alias).
  - Deterministic validator implemented and verified against FAUNA source/target.
  - Translation scaffold CLI implemented with draft mode and dry-run mode.
  - Prompt profile configuration added.
  - MT adapter interface added with providers: `passthrough`, `mock`, `openai-compatible`.
  - LLM QA validator scaffold added with heuristic checks and optional model-backed review.
  - XSD schema baseline and validator script added; FAUNA source/target validation passing.
  - End-to-end pipeline command added (`run_pipeline.js`) for draft + deterministic + LLM QA + XSD sequence.
  - Translator UI scaffold added with source/target split editing and local draft persistence.
  - Source-target section jump links added in translator workspace.
  - Glossary lock configuration and terminology-drift QA checks added.
- New direction under review:
  - Adaptation-friendly hybrid editing model preferred over fully free-form editing.
  - Canonical target output should remain source-anchored, with explicit support for target-only blocks.
  - JSON draft contract approved as editor-state intermediate model (XML remains source and output format).
- Current blocker(s):
  - Real hosted MT provider credentials/config not yet confirmed for production usage.
  - Glossary lock list needs language-team review and expansion.
- Immediate next phase target:
  - Lock adaptation editing rules before Phase 7 pilot hardening.

## Phase 0: Scope and Baseline
Status: Not started

- [ ] Confirm target languages for first release
- [ ] Confirm translation policy for `Lemma` and `Transliteration` (default: protected)
- [ ] Confirm whether Index labels are in-scope for Phase 1
- [ ] Confirm MT provider(s) and API constraints
- [ ] Confirm glossary requirements per language
- [ ] Confirm adaptation policy for target-only blocks and paragraph restructuring

Definition of done:
- [ ] Scope decisions documented and approved

## Phase 1: Data Contract and Core Pipeline
Status: Completed

- [x] Align generated data contract with browser (`ALL_DICTIONARY_ENTRIES`)
- [x] Add language-aware build option to dictionary analysis pipeline
- [x] Implement entry extraction by `ThemLex_Entry`
- [x] Implement freeze/protect token pass
- [x] Implement target XML writer (new file output only)
- [x] Finalize and implement v1 JSON draft contract with source anchors and operation log

Definition of done:
- [x] Can generate target XML without changing source XML
- [x] XML -> JSON -> XML round-trip succeeds for pilot entries with zero protected drift

## Phase 2: Deterministic Validation
Status: In progress

- [x] XML well-formedness validator
- [x] Protected-node fingerprint validator
- [x] Reference-count and reference-value validator
- [x] Key/target attribute invariance validator
- [x] Entry ordering/key consistency validator

Definition of done:
- [x] Validator blocks any protected-content drift

## Phase 3: MT Draft Translation
Status: In progress

- [x] Add MT adapter interface
- [x] Add prompt profile config (editable)
- [x] Add whole-entry draft translation mode
- [x] Add retry/fallback strategy for long entries
- [x] Add dry-run mode for no-write testing

Definition of done:
- [x] Draft translation can run entry-by-entry with protected placeholders intact

## Phase 4: LLM QA Validation
Status: Completed

- [x] Add LLM QA prompt and structured output parser
- [x] Validate token preservation and paragraph completeness
- [x] Add terminology drift warnings
- [x] Add blocking-vs-warning policy switches
- [x] Add policy-aware checks for target-only blocks, paragraph splits, and merges

Definition of done:
- [x] LLM validation report produced per entry and batch

## Phase 5: XSD Validation
Status: In progress

- [x] Create initial schema (`schemas/thematic_lexicon.xsd`)
- [x] Validate source XML against schema
- [x] Validate target XML against schema
- [x] Add CI or batch validation command

Definition of done:
- [x] Target XML fails fast on schema violations

## Phase 6: Translator UI Workbench
Status: In progress

- [x] Create `pages/translator.html`
- [x] Build source/target split view
- [x] Add actions: Translate, Save Draft, Validate, Mark Ready
- [x] Add prompt profile selector/editor
- [x] Add validation panel with blocking errors first
- [x] Add source-target section jump links
- [x] Add explicit target-only block insertion controls
- [x] Distinguish source-mapped versus target-only blocks in the UI
- [x] Add adaptation-aware reader preview mode

Definition of done:
- [ ] Translator can complete full flow from UI without editing raw XML files
- [ ] Translator can add approved target-only content without breaking canonical validation

## Phase 7: Pilot and Hardening
Status: Not started

- [ ] Pilot on FAUNA only
- [ ] Resolve validator false positives
- [ ] Measure MT output quality and post-edit effort
- [ ] Tune prompts and glossary rules
- [ ] Re-run with FLORA then REALIA
- [ ] Measure adaptation usage patterns: additions, splits, merges, and validation friction

Definition of done:
- [ ] Three dictionaries pass validation and render correctly

## Phase 8: Documentation and Handoff
Status: Not started

- [ ] Update README with translation commands
- [ ] Add troubleshooting section for validator errors
- [ ] Add translator quick-start guide
- [ ] Add release notes for translation feature

Definition of done:
- [ ] Team can run and maintain translation workflow independently

---

## New Suggestions (Prioritized)

1. Implement Phase 4 next with a strict JSON report contract:
  - `errors[]`, `warnings[]`, `suggested_fixes[]`, `entryKey`.
  - Fail pipeline on `errors.length > 0`.
2. Add a minimal-but-enforceable XSD in Phase 5 first, then tighten iteratively:
  - Start with entry/key/section/reference constraints.
  - Expand to optional metadata strictness after pilot.
3. Add glossary lock support in Phase 4/Phase 7:
  - Do-not-translate term list by target language.
  - Warn on terminology drift.
4. Add batch orchestration command after Phase 5:
  - Draft -> deterministic validate -> LLM validate -> XSD validate.
5. Pilot quality metrics in Phase 7:
  - Post-edit distance per entry.
  - Validation failure categories by frequency.

## Verification Commands (Current)

- `node scripts/translation/translate_entries.js --src data/xml/FAUNA_en.xml --lang fr --mode draft --provider mock --dry-run`
- `node scripts/translation/translate_entries.js --src data/xml/FAUNA_en.xml --lang fr --mode draft --provider passthrough --out data/xml/FAUNA_fr.xml`
- `node scripts/translation/validate_deterministic.js --src data/xml/FAUNA_en.xml --tgt data/xml/FAUNA_fr.xml`
- `node scripts/translation/validate_llm.js --src data/xml/FAUNA_en.xml --tgt data/xml/FAUNA_fr.xml`
- `node scripts/translation/validate_xsd.js --file data/xml/FAUNA_en.xml --schema schemas/thematic_lexicon.xsd`
- `node scripts/translation/validate_xsd.js --file data/xml/FAUNA_fr.xml --schema schemas/thematic_lexicon.xsd`
- `node scripts/translation/run_pipeline.js --src data/xml/FAUNA_en.xml --lang fr --provider passthrough --schema schemas/thematic_lexicon.xsd`
- `node scripts/analyze_dictionaries.js --lang fr`
- `node scripts/translation/translate_entries.js --src data/xml/FAUNA_en.xml --lang fr --mode roundtrip --emit-draft-json --out data/xml/FAUNA_fr_roundtrip.xml --draft-json-out data/xml/FAUNA_fr_roundtrip.draft.json`

---

## Weekly Status Snapshot

Week of: __________

- Overall status: [ ] Green [ ] Amber [ ] Red
- Completed this week:
  - [ ]
  - [ ]
- In progress:
  - [ ]
  - [ ]
- Blockers:
  - [ ]
  - [ ]
- Next week focus:
  - [ ]
  - [ ]

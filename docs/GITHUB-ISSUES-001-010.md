# GitHub Issues — PRD-001 Resource Browser MVP

**Base Labels:** `phase-1`, `browser`, `tdd`

**Linked PRD:** [PRD-001-resource-browser.md](PRD-001-resource-browser.md)

## Current Snapshot

- Verified against live GitHub issues on 2026-04-19: open issues `#2` through `#13` map to GH-011, GH-008, GH-009, GH-012, GH-001, GH-003, GH-002, GH-004, GH-006, GH-005, GH-007, and GH-010.
- Current committed test coverage exists for GH-001, GH-002, GH-003, GH-008, and GH-011, plus shared coverage for GH-004, GH-009, and GH-012.
- Dedicated test files do not yet exist for GH-005, GH-006, GH-007, or GH-010.
- The current browser route implementation lives at `/lexicon`; `/browser` exists as a redirect route.

---

## GH-001 — Browse entry list

**Title:** US-001 — Browse entry list  
**Labels:** `phase-1`, `browser`, `feature`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-001](PRD-001-resource-browser.md#us-001--browse-entry-list)

### Description

Users need to see a paginated list of all entries across imported resources to understand the scope of work.

### Acceptance Criteria

- [ ] Entry list loads on first visit within 2 seconds on a 4G connection
- [ ] Each entry card shows: entry key, title, resource badge, match type badge, translation status, last updated date
- [ ] List is paginated (50 entries per page) with infinite scroll or "load more"
- [ ] Default sort: resource priority, then stable alphabetical title

### Related Tasks

- Depends on: GH-008 (Import UBS XML resources)
- Blocks: GH-004 (Scope search)
- Tests: See `tests/browser/us-001.test.ts`

---

## GH-002 — Filter by translation status

**Title:** US-002 — Filter by translation status  
**Labels:** `phase-1`, `browser`, `feature`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-002](PRD-001-resource-browser.md#us-002--filter-by-translation-status)

### Description

Translators need to filter entries by status to focus on entries that need their attention.

### Acceptance Criteria

- [ ] Status filter is visible on both mobile (drawer) and desktop (sidebar)
- [ ] Default state: all statuses shown
- [ ] `Needs Work` quick chip = untranslated + draft combined
- [ ] Status filter state is reflected in URL query params (e.g., `?status=untranslated,draft`)
- [ ] Filter applies within the current search scope and selected target language

### Related Tasks

- Depends on: GH-001 (Browse entry list)
- Blocks: GH-007 (Preserve browser state)
- Tests: See `tests/browser/us-002.test.ts`

---

## GH-003 — Search for an entry

**Title:** US-003 — Search for an entry  
**Labels:** `phase-1`, `browser`, `feature`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-003](PRD-001-resource-browser.md#us-003--search-for-an-entry)

### Description

Translators need fast, unified search to jump directly to entries without mode toggles.

### Acceptance Criteria

- [ ] Single unified search box — no mode toggle
- [ ] Search covers: entry key, title, indexed source content snippets, Bible references
- [ ] Bible references matched in human-readable (`John 3:16`), USFM notation (`JHN 3:16`), and mnemonic numeric (`04400301600005`) forms
- [ ] Results debounced (300ms) — no search triggered on every keystroke
- [ ] Results ranked: exact key → exact title → prefix title → exact ref → content snippet → resource priority → alpha title
- [ ] Each result card shows the match field type (key / title / content / reference) as a badge
- [ ] Empty state shows: "No entries match your search. Clear filters (primary) · Switch scope (secondary)"

### Notes

- **Future expansion (Phase 2+)**: Bible references in vernacular languages (e.g., local language scripture reference format). For Phase 1, only store and match human-readable, USFM notation, and mnemonic numeric forms.

### Related Tasks

- Depends on: GH-001 (Browse entry list)
- Blocks: GH-007 (Preserve browser state)
- Tests: See `tests/browser/us-003.test.ts`

---

## GH-004 — Scope search to specific resources

**Title:** US-004 — Scope search to specific resources  
**Labels:** `phase-1`, `browser`, `feature`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-004](PRD-001-resource-browser.md#us-004--scope-search-to-specific-resources)

### Description

Translators need to narrow search results to specific resources to avoid clutter.

### Acceptance Criteria

- [ ] Scope chips always visible: `All` · `Selected Resources` · `Current Resource`
- [ ] Selecting `Selected Resources` opens a resource picker drawer
- [ ] Drawer allows multi-select of resource versions (e.g., `UBS FAUNA v1.0`, `UBS FLORA v1.0`)
- [ ] Active scope is reflected in URL query params (e.g., `?scope=selected&resources=fauna-v1,flora-v1`)
- [ ] Search runs only against selected resources when `Selected Resources` is active

### Related Tasks

- Depends on: GH-001 (Browse entry list), GH-003 (Search for an entry)
- Blocks: GH-007 (Preserve browser state)
- Tests: Current coverage lives in `tests/api/resources-entries-resource-filter.test.ts`, `tests/browser/entry-list.test.ts`, and `tests/browser/lexicon-utils.test.ts`

---

## GH-005 — View entry detail

**Title:** US-005 — View entry detail  
**Labels:** `phase-1`, `browser`, `feature`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-005](PRD-001-resource-browser.md#us-005--view-entry-detail)

### Description

Users need to see full source content and existing translations for each entry to assess work progress.

### Acceptance Criteria

- [ ] On mobile: entry detail opens full-screen with a Back button to return to the list
- [ ] On tablet/desktop: entry detail opens in a side panel (master-detail layout)
- [ ] Detail view shows:
  - [ ] Entry key and title
  - [ ] Resource name and version
  - [ ] Source language text (read-only, full content)
  - [ ] All available translations (by language code, with translator name and date)
  - [ ] Translation status per language
  - [ ] Bible references (human-readable form)
  - [ ] Last updated date
- [ ] If user is authenticated as Translator/Reviewer/Admin: "Open in Workbench" button visible
- [ ] If user is a public Reader (not signed in): button not shown
- [ ] Reader feedback actions (upvote/downvote/comment/flag) visible and accessible on all breakpoints (mobile, tablet, desktop)
- [ ] On mobile: feedback actions displayed below entry detail content or in an expandable feedback panel

### Related Tasks

- Depends on: GH-001 (Browse entry list)
- Blocks: GH-010 (Public reader ratings and feedback)
- Tests: No dedicated test file committed yet

---

## GH-006 — Select target language

**Title:** US-006 — Select target language  
**Labels:** `phase-1`, `browser`, `feature`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-006](PRD-001-resource-browser.md#us-006--select-target-language)

### Description

Translators need to set a target language once and have it persist to see relevant translation status across sessions.

### Acceptance Criteria

- [ ] Target language resolved in order: user preference → org default → project fallback (`ml`)
- [ ] Language selector visible in browser header
- [ ] Selection persisted to user preference in database
- [ ] Cache keys include target language (status counts re-fetched on language change)

### Related Tasks

- Depends on: Auth working, database schema
- Blocks: GH-002 (Filter by translation status)
- Tests: No dedicated test file committed yet

---

## GH-007 — Preserve browser state

**Title:** US-007 — Preserve browser state  
**Labels:** `phase-1`, `browser`, `feature`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-007](PRD-001-resource-browser.md#us-007--preserve-browser-state)

### Description

Users need browser navigation to preserve filters, scroll position, and selection so they don't lose their place.

### Acceptance Criteria

- [ ] Browser back navigation restores: search query, scope, status filter, selected language, sort order, scroll position, selected entry
- [ ] State reflected in URL so it can be bookmarked and shared
- [ ] No full page reload on back navigation (client-side routing)

### Related Tasks

- Depends on: GH-001–006 (all prior browser features)
- Blocks: None (integration task)
- Tests: No dedicated test file committed yet

---

## GH-008 — Import UBS XML resources

**Title:** US-008 — Import UBS XML resources  
**Labels:** `phase-1`, `importer`, `db-schema`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-008](PRD-001-resource-browser.md#us-008--import-ubs-xml-resources)

### Description

Admins need to import UBS FAUNA, FLORA, and REALIA XML files so entries are available for browsing and translation.

### Acceptance Criteria

- [ ] Import script processes all three XML files without errors
- [ ] All entries inserted into `resource_entries` table with correct resource version FK
- [ ] Protected content (Bible references, structural metadata) preserved as-is
- [ ] Import produces a round-trip validation report: import → export → XML diff
- [ ] Validation passes canonical structural equivalence for all entries
- [ ] Script is idempotent (re-running does not create duplicate entries; uses upsert)
- [ ] Entry count per resource logged to console on completion

### Related Tasks

- Depends on: GH-012 (Database schema)
- Blocks: GH-001 (Browse entry list), GH-009 (Round-trip validation)
- Tests: See `tests/importer/us-008.test.ts`

---

## GH-009 — Data integrity: round-trip validation

**Title:** US-009 — Data integrity: round-trip validation  
**Labels:** `phase-1`, `importer`, `quality`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-009](PRD-001-resource-browser.md#us-009--data-integrity-round-trip-validation)

### Description

Admins need proof that imported data has not been corrupted or lost during import/export cycles.

### Acceptance Criteria

- [ ] Round-trip validation script: parse source XML → serialize back to XML → diff against original
- [ ] Diff is canonical structural (attribute order-independent, whitespace-normalized)
- [ ] All three dictionaries (FAUNA, FLORA, REALIA) must pass with zero structural differences
- [ ] Any failure produces a human-readable diff report pointing to the specific entry and field
- [ ] Script exits with non-zero code on failure (blocks CI)

### Related Tasks

- Depends on: GH-008 (Import UBS XML resources)
- Blocks: GH-001 (Browse entry list) — release gate
- Tests: Current coverage lives in `tests/xml-parser.test.ts` and `tests/import-workflow-risk-matrix.test.ts`; no dedicated `us-009` file is committed yet

---

## GH-010 — Public reader ratings and feedback

**Title:** US-010 — Public reader ratings and feedback  
**Labels:** `phase-1`, `browser`, `feature`, `anti-spam`, `tdd`  
**Milestone:** Phase 1  
**Linked User Story:** [PRD-001 US-010](PRD-001-resource-browser.md#us-010--public-reader-ratings-and-feedback)

### Description

Public Readers need to submit entry ratings and feedback without creating an account to contribute quality signals.

### Acceptance Criteria

- [ ] Entry detail view includes reader feedback actions: upvote, downvote, comment, and flag
- [ ] Reader may submit feedback without authentication
- [ ] Reader name is optional; if omitted, submission is stored as `Anonymous`
- [ ] CAPTCHA challenge is required for every unauthenticated feedback submission
- [ ] Server validates CAPTCHA token before persisting feedback
- [ ] On CAPTCHA failure, feedback is rejected with a clear retry message
- [ ] Basic rate limiting is enforced per IP and per entry to reduce spam
- [ ] Reader feedback is advisory only and cannot change translation status

### Related Tasks

- Depends on: GH-005 (View entry detail), GH-012 (Database schema)
- Blocks: None (advisory feature)
- Tests: No dedicated test file committed yet

---

## GH-011 — Database schema

**Title:** FR-01 — Database schema (Tables + Migrations)  
**Labels:** `phase-1`, `db-schema`, `infrastructure`, `tdd`  
**Milestone:** Phase 1  
**Linked Requirement:** [PRD-001 FR-01](PRD-001-resource-browser.md#fr-01--database-schema)

### Description

Implement complete database schema for resources, entries, translations, feedback, and user management.

### Acceptance Criteria

- [ ] All tables created via Drizzle migrations: `resources`, `resource_versions`, `resource_entries`, `entry_translations`, `entry_custom_fields`, `users`, `organizations`, `org_memberships`, `community_feedback`, `prompt_profiles`
- [ ] All primary keys: UUID v7
- [ ] Enums correctly defined: `translation_status` (untranslated | draft | ready_for_review | approved), `entry_role` (translator | reviewer | admin | reader)
- [ ] Soft delete (`deleted_at timestamptz`) added to all tables
- [ ] `resource_entries.source_content` stored as JSONB
- [ ] Foreign key constraints properly defined
- [ ] Unique constraints in place (e.g., entry_key + resource_version)
- [ ] Migrations committed to repository and runnable

### Implementation Notes

See Mermaid ERD diagram in PRD-001 FR-01.

### Related Tasks

- Blocks: GH-008 (Import), GH-001 (Browse), GH-006 (Language prefs), GH-010 (Feedback)
- Tests: See `tests/db/schema.test.ts`

---

## GH-012 — Browser page route and theme support

**Title:** FR-03 + Theme Support — Browser page route & dark/light themes  
**Labels:** `phase-1`, `browser`, `ui`, `tdd`  
**Milestone:** Phase 1  
**Linked Requirements:** [PRD-001 FR-03](PRD-001-resource-browser.md#fr-03--resource-browser-page), [PRD-001 NFR](PRD-001-resource-browser.md#7-non-functional-requirements)

### Description

Set up `/browser` route with public access, SSR initial render, and dark/light theme support.

### Acceptance Criteria

- [ ] Route `/browser` exists and publicly accessible
- [ ] Server-side initial render (SSR) loads first 50 entries
- [ ] Dark theme (default, dark slate)
- [ ] Light theme (light slate) with toggle in header
- [ ] Theme preference persisted to session/localStorage
- [ ] Cache policy: entry list 60s, entry detail 5min; invalidate on version/lang/filter change
- [ ] Page renders on mobile (375px) with no layout overflow
- [ ] Lighthouse performance score ≥ 85 on mobile

### Related Tasks

- Depends on: GH-011 (Database schema), GH-008 (Import)
- Blocks: GH-001–007 (all browser features)
- Tests: Current route smoke coverage lives in `tests/browser/lexicon-page-params.test.ts`; no dedicated `fr-03` file is committed yet

---

## Implementation Sequence

The issues should be tackled in this order:

1. **GH-011** — Database schema (foundation)
2. **GH-008** — Import UBS XML resources
3. **GH-009** — Round-trip validation
4. **GH-012** — Browser page route & themes
5. **GH-001** — Browse entry list
6. **GH-003** — Search for an entry
7. **GH-002** — Filter by translation status
8. **GH-004** — Scope search to specific resources
9. **GH-006** — Select target language
10. **GH-005** — View entry detail
11. **GH-007** — Preserve browser state
12. **GH-010** — Public reader ratings and feedback

---

## Testing Strategy

For each issue, tests must follow TDD:

1. **Write failing tests first** (unit + integration)
2. **Implement code to make tests pass**
3. **Ensure all tests pass before marking issue complete**
4. **Add E2E tests** (Playwright) for browser flows

**Test directories:**
- `tests/db/` — database and schema tests
- `tests/importer/` — XML importer tests
- `tests/browser/` — browser UI, URL, and route smoke tests
- `tests/api/` — resource entry API query handling
- `tests/import-workflow-risk-matrix.test.ts` and `tests/import-security-matrix.test.ts` — importer hardening matrices
- `tests/e2e/` — planned end-to-end Playwright coverage (not committed yet)

---

## Labels Reference

- `phase-1` — Phase 1 milestone work
- `browser` — browser UI feature
- `importer` — data import/export
- `db-schema` — database schema changes
- `feature` — new user-facing feature
- `quality` — data validation / QA
- `anti-spam` — anti-spam / rate-limiting
- `tdd` — test-driven development required
- `infrastructure` — foundational/architectural work

---

## Linked Documents

- [PRD-001-resource-browser.md](PRD-001-resource-browser.md) — full product requirements
- [TRANSLATION_WORKBENCH_IMPLEMENTATION_PLAN.md](TRANSLATION_WORKBENCH_IMPLEMENTATION_PLAN.md) — phase decisions
- [BROWSER_UI_DESIGN.md](BROWSER_UI_DESIGN.md) — UI design decisions

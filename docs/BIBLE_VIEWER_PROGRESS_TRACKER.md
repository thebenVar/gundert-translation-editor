# Bible Reference Viewer Progress Tracker

Use this as your implementation checklist.

## Phase 0: Foundations and Guardrails
Status: Completed

- [x] Confirm integration mode
  - Primary: BibleBrains/Bible.is API
  - Fallback: Open reference on live.bible.is URL
- [x] Define local storage keys
  - selectedBibleIds
  - viewerDisplayMode (stacked)
  - contextExpansionState
- [x] Add feature flags
  - enableBibleViewer
  - enableBibleCatalogFetch
  - enableBibleTextFetch

Definition of done:
- [x] App runs with feature flag off (no regressions)
- [x] Feature flag on shows placeholder viewer shell

Validation note:
- Enable shell quickly with URL parameter: `pages/browser.html?ff_enableBibleViewer=1`

## Phase 1: UI Skeleton (No live API yet)
Status: Completed

- [x] Add Bible Settings entry point in pages/browser.html
- [x] Add Bible Viewer panel (side drawer/modal) in pages/browser.html
- [x] Make reference chips clickable in References section
- [x] Parse clicked reference into book, chapter, verse
- [x] Render mock stacked version cards (hardcoded test data)

Definition of done:
- [x] Clicking a reference opens viewer
- [x] Viewer displays stacked cards (one version per card)
- [x] Close/open flow works on desktop and mobile

Validation notes:
- Enable with: `pages/browser.html?ff_enableBibleViewer=1`
- ⚙ Bible Versions button appears in sidebar
- Clicking any reference chip opens right-side viewer panel with 3 mock version cards (ESV, KJV, French)
- Close button (✕) on viewer and settings panels both work
- Reference label in viewer header shows the clicked reference string

## Phase 2: Settings + Catalog Curation
Status: Completed

- [x] Add settings state model in pages/browser.html
- [x] Fetch available Bibles catalog from API (or temp local JSON mock)
- [x] Group versions by language
- [x] Add language search/filter
- [x] Multi-select Bible versions and persist identifiers (example: MALDIP)
- [x] Restore selected versions on reload

Definition of done:
- [x] User can select multiple versions grouped by language
- [x] Selection persists after refresh
- [x] Catalog UX remains responsive

Validation notes:
- Enable with: `pages/browser.html?ff_enableBibleViewer=1`
- 25 Bible versions across 15 language groups (English, French, Spanish, Portuguese, German, Swahili, Indonesian, Tagalog, Hindi, Amharic, Hausa, Yoruba, Zulu, Tok Pisin, Malagasy)
- Default selection: ENGESV restored on first load
- Search box filters both language names and version names/IDs in real time
- Save & Close writes to localStorage; viewer re-renders immediately with new selection
- `BIBLE_CATALOG` is the single source of truth — Phase 3 API adapter will read from the same selected IDs

## Phase 3: Live Bible Text Fetch
Status: Blocked until API key

Dependency:
- [ ] Bible.is/BibleBrains API key provided

Tasks:
- [ ] Add API client adapter (single integration layer)
- [ ] Map parsed references to API request format
- [ ] Fetch text per selected Bible identifier
- [ ] Render stacked results (default behavior)
- [ ] Show per-version loading and error states
- [ ] Add Open on Bible.is deep link for each version

Definition of done:
- [ ] Clicking a reference loads real text for selected versions
- [ ] Failed version fetch does not break other versions
- [ ] At least one successful end-to-end reference load

## Phase 4: Larger Context (Show More)
Status: Not started

- [ ] Default view
  - Show focused verse or compact snippet in each stacked card
- [ ] Add Show more per version card
  - Expands to larger chapter context around selection
- [ ] Add Show less
- [ ] Persist expansion state per opened reference (optional)
- [ ] Add simple context-size levels
  - Compact
  - Medium
  - Full chapter (optional if API supports efficiently)

Definition of done:
- [ ] Show more expands context without reloading full UI
- [ ] User can independently expand/collapse per version
- [ ] Expanded content is readable and performant

## Phase 5: Performance + Resilience
Status: Not started

- [ ] Add response caching by reference+version
- [ ] Limit concurrent fetches
- [ ] Add retry/backoff for transient failures
- [ ] Add empty-state and timeout messaging
- [ ] Add graceful fallback link when content unavailable

Definition of done:
- [ ] Repeat reference opens feel fast
- [ ] No UI freeze when multiple versions are selected
- [ ] Errors are actionable and non-blocking

## Phase 6: UX Polish + QA
Status: Not started

- [ ] Keyboard navigation for viewer and settings
- [ ] Accessibility checks (focus trap, labels, contrast)
- [ ] Mobile layout tuning for stacked cards
- [ ] Verify existing features still work
  - Category/subcategory filtering
  - Reference formatting
  - Image rendering

Definition of done:
- [ ] No regressions in existing browser behavior
- [ ] Viewer is usable on desktop and mobile
- [ ] Ready for production flag enablement

## API Key Handoff Checklist
Status: Waiting

- [ ] API base URL
- [ ] API key/token
- [ ] Required headers
- [ ] Rate limit guidance
- [ ] Endpoint examples
  - list Bibles
  - fetch verse/chapter text
- [ ] Terms/usage constraints

## Suggested Execution Order

1. Phase 1
2. Phase 2
3. Phase 3 (when key arrives)
4. Phase 4
5. Phase 5
6. Phase 6

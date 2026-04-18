# Resource Browser UI Design

## Overview

The resource browser is the **primary entry point** for users to discover, filter, search, and navigate translation resources. It's built for **mobile-first**, **modern**, and **elegant** design with progressive enhancement for desktop.

## MVP Scope

**Primary Goal:** Enable users to browse translation resources (dictionaries, lexicons, Bibles, commentaries, etc.) by filtering, searching, and viewing individual entries with source text and any existing translations.

**Core Features (Phase 1):**
1. **Resource Library View** - List of available translation resources (UBS, unfoldingWord, SIL, Tyndale, Strong's, etc.)
2. **Entry Search & Filter** - Search by entry key, title, Bible reference (for relevant resources)
3. **Entry Viewer** - Side-by-side source and target language display
4. **Mobile-Optimized Layout** - Touch-friendly, responsive design
5. **Navigation** - Link to translator workbench for authenticated users

## Mobile-First Design Principles

- **Single-column layout on mobile** - Stacked entry list and viewer
- **Responsive breakpoints** - Tablet (768px): sidebar + viewer side-by-side; Desktop (1024px): full layout
- **Touch-friendly interactions** - Buttons, links sized for touch (min 48px)
- **Fast load times** - Lazy-load entry content, virtualized lists for large datasets
- **Dark mode ready** - Uses Tailwind CSS dark mode utilities
- **Accessibility** - WCAG 2.1 AA compliance (semantic HTML, ARIA labels, keyboard navigation)

## Layout Structure

```
Mobile (< 768px):
┌──────────────────────┐
│  Header / Search Bar │
├──────────────────────┤
│   Entry List Sidebar │
│  (scrollable, full)  │
│                      │
├──────────────────────┤
│   Entry Viewer       │
│  (below on scroll)   │
└──────────────────────┘

Tablet (768px - 1024px):
┌──────────────────────────────────────┐
│   Header / Filters                   │
├────────────┬────────────────────────┤
│  Entries   │  Entry Viewer          │
│  (sidebar) │  (main content)        │
│            │                        │
│            │                        │
└────────────┴────────────────────────┘

Desktop (> 1024px):
┌───────────────────────────────────────────┐
│ Header | Filters | Toolbar                │
├──────────────┬──────────────────────────┤
│ Resource Lib │  Entry List   │ Viewer   │
│              │               │          │
│              │               │          │
└──────────────┴──────────────┴──────────┘
```

## Color & Typography

- **Background**: Dark slate (`bg-slate-900`, `bg-slate-800`)
- **Text**: Light (`text-white`, `text-slate-300`, `text-slate-400`)
- **Accent**: Blue (`bg-blue-600`, `hover:bg-blue-700`)
- **Borders**: Subtle slate (`border-slate-700`)
- **Typography**: Inter/system font stack, readable line heights (1.5-1.75)

## Key Components

### Header
- Logo / App name
- Search bar (entry/reference search)
- Settings button (language, format preferences)
- Breadcrumb (resource name)

### Resource Library (Sidebar - Desktop only)
- Filterable list of translation resources
- Resource type badge (Dictionary, Lexicon, Bible, Commentary, etc.)
- Source label (UBS, unfoldingWord, SIL, Tyndale, Strong's)
- Entry count per resource

### Entry List
- Searchable, scrollable list
- Entry key + title + Bible reference (if applicable)
- Active entry highlight
- Virtual scrolling for large datasets (1000+ entries)

### Entry Viewer
- **Source Column**: Original entry text (language tag, read-only)
- **Target Column**: Existing translations (by language, editable for authorized users)
- **Metadata Panel**: Entry key, source, references, creation date, last translator
- **Actions**: Link to translator workbench, export, compare languages

### Filters (Mobile Drawer / Desktop Sidebar)
- Resource type (Dictionary, Lexicon, Bible, Commentary, etc.)
- Source (UBS, unfoldingWord, SIL, Tyndale, Strong's)
- Language (source + target)
- Entry status (translated, in-progress, untranslated)

### Translation Status Filter (Accepted)

- Provide a dedicated filter for translation status in the browser list.
- Minimum statuses in Phase 1:
   - `Untranslated`
   - `Draft`
   - `Ready for Review`
   - `Approved`
- Filter applies within current search scope and selected target language.
- Status filter state is represented in URL query params for shareable views.

### Default Status View (Accepted)

- Default status filter on first load: `All statuses`.
- Provide a one-tap quick chip: `Needs Work`.
- `Needs Work` expands to: `Untranslated + Draft`.
- This quick chip is available in both mobile filter drawer and desktop filter controls.

### Default Target Language (Accepted)

- Target language resolution order:
   1. user preference
   2. organization default
   3. project fallback (`ml` for current UBS Phase 1)
- Selected language controls translation-status evaluation and cache keys.
- User changes are persisted as preference for future sessions.

## Search Scope Selector (Accepted)

Use a two-layer scope selector for unified search.

### Layer 1: Scope Chips (always visible)
- `All`
- `Selected Resources`
- `Current Resource`

### Layer 2: Resource Picker Drawer (on demand)
- Opened when users choose or edit `Selected Resources`
- Multi-select resource versions (example: `UBS FAUNA v1.0`, `UBS FLORA v1.0`)
- Search runs only against selected resources when `Selected Resources` is active

This keeps default UX simple while enabling precise cross-resource control as catalog size grows.

## Data Display Format

Each entry viewer should display:
```
Entry Key: A123
Title: Lion
Source Language: English
Source Text: [rendered entry content]
---
Translations Available:
- French (fr) - translated by [user], [date]
- Spanish (es) - translated by [user], [date]
- Malayalam (ml) - draft [%]
---
Related References:
- Genesis 49:9
- 1 Peter 5:8
```

## Interaction Patterns

1. **Search Entry**
   - User types in search bar
   - Real-time filter (debounced)
   - Show matches as they type

## Search Behavior (Accepted)

- Use a unified search box (no mode toggle in Phase 1).
- One query searches across:
   - entry key
   - title
   - indexed source content snippets
   - Bible references
- Query results can be narrowed further by translation status filter.
- Bible references are matched using both:
   - human-readable forms (example: John 3:16)
   - source mnemonic forms stored in data
- Result cards show match context and field type (key/title/content/reference) to reduce ambiguity.

This replaces separate Entries vs Bible Refs modes for a simpler and faster user workflow.

### Unified Search Ranking (Accepted)

Default result ordering:
1. Exact entry key match
2. Exact title match
3. Prefix title match
4. Bible reference exact match
5. Content snippet match
6. Tie-breakers: resource priority, then stable alphabetical title

Result ranking should be deterministic so the same query returns consistent ordering.

2. **Filter Resources**
   - Click filter button (mobile) / sidebar (desktop)
   - Adjust resource type, source, language
   - Apply filters (list updates)

3. **View Entry**
   - Click entry in list
   - Viewer shows source + available translations
   - Metadata panel updates

4. **Navigate to Translator**
   - Click "Translate This Entry" button (if authenticated)
   - Redirect to `/translator?resourceId=X&entryKey=Y`

5. **No Results Recovery**
   - Show explicit empty-state reason (scope/filter/search combination)
   - Primary CTA: `Clear filters`
   - Secondary CTA: `Switch scope`
   - Keep `Open Resource Picker` action available for quick scope expansion

## Mobile Navigation Pattern (Accepted)

- Use master-detail navigation on mobile.
- Default mobile view is the entry list.
- Selecting an entry opens detail in a full-screen panel.
- A persistent Back action returns to the list.
- Tablet and desktop use split-view where space allows.

This pattern is preferred for translator focus, one-handed use, and reduced visual clutter on small screens.

## Accessibility Requirements

- **Keyboard Navigation**: Tab through entries, Enter to select
- **Screen Reader**: Semantic HTML, ARIA labels for buttons/filters
- **Color Contrast**: WCAG AA (4.5:1 for text)
- **Focus Indicators**: Visible focus ring on interactive elements
- **Language Tags**: Mark source/target text with `lang` attribute

## Performance Targets

- **First Contentful Paint**: < 2s
- **Time to Interactive**: < 3s
- **Lighthouse Score**: 90+
- **Mobile Performance**: Optimized for 3G

## Data Loading Strategy (Phase 1 Decision)

Hybrid loading is the default strategy for browser UX.

- Initial result page is server-rendered from Postgres for fast first paint.
- Entry list pages are fetched via API with pagination and URL-based search/filter params.
- Client keeps a short-lived cache for recently viewed resources, entry pages, and selected entry payloads.
- Entry detail is loaded on demand, then reused from cache to avoid repeated waits during translator navigation.
- Cache invalidates when resource version, language, or major filter scope changes.

Rationale:
- Better translator UX than pure server reloads.
- Better scalability than loading all entries in-browser.
- Works for current UBS scope and future multi-source expansion.

### Cache Freshness Policy (Accepted)

- Entry list pages TTL: 60 seconds
- Entry detail payload TTL: 5 minutes
- Immediate invalidation when resource version changes
- Immediate invalidation when target language changes
- Immediate invalidation on major filter scope reset

This policy balances fast navigation with low stale-content risk.

## Future Enhancements (Phase 2)

- Bible reference cross-links (click reference → view Bible text in side panel)
- Advanced search (full-text, regex, field-specific)
- Export filters (PDF, Excel, JSON)
- Collaborative translation view (see real-time translator activity)
- Resource versioning and comparison

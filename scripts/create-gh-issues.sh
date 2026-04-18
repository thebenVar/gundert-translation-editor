#!/bin/bash

# Create all 12 GitHub issues for PRD-001

gh issue create -t "GH-011 FR-01 Database schema" -b "Implement complete database schema for resources, entries, translations, feedback, and user management." -m "Phase 1"

gh issue create -t "GH-008 US-008 Import UBS XML resources" -b "Admin needs to import UBS FAUNA, FLORA, and REALIA XML files so entries are available for browsing." -m "Phase 1"

gh issue create -t "GH-009 US-009 Data integrity round-trip validation" -b "Admin needs proof that imported data has not been corrupted or lost during import/export cycles." -m "Phase 1"

gh issue create -t "GH-012 FR-03 Browser page route & dark/light themes" -b "Set up /browser route with public access, SSR initial render, and dark/light theme support." -m "Phase 1"

gh issue create -t "GH-001 US-001 Browse entry list" -b "Users need to see a paginated list of all entries across imported resources to understand the scope of work." -m "Phase 1"

gh issue create -t "GH-003 US-003 Search for an entry" -b "Translators need fast, unified search to jump directly to entries without mode toggles." -m "Phase 1"

gh issue create -t "GH-002 US-002 Filter by translation status" -b "Translators need to filter entries by status to focus on entries that need their attention." -m "Phase 1"

gh issue create -t "GH-004 US-004 Scope search to specific resources" -b "Translators need to narrow search results to specific resources to avoid clutter." -m "Phase 1"

gh issue create -t "GH-006 US-006 Select target language" -b "Translators need to set a target language once and have it persist across sessions." -m "Phase 1"

gh issue create -t "GH-005 US-005 View entry detail" -b "Users need to see full source content and existing translations for each entry to assess work progress." -m "Phase 1"

gh issue create -t "GH-007 US-007 Preserve browser state" -b "Users need browser navigation to preserve filters, scroll position, and selection." -m "Phase 1"

gh issue create -t "GH-010 US-010 Public reader ratings and feedback" -b "Public Readers need to submit entry ratings and feedback without creating an account with CAPTCHA anti-spam." -m "Phase 1"

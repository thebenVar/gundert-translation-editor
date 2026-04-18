# Create all 12 GitHub issues for PRD-001

$issues = @(
    @{ title = "GH-011 FR-01 Database schema"; body = "Implement complete database schema for resources, entries, translations, feedback, and user management." },
    @{ title = "GH-008 US-008 Import UBS XML resources"; body = "Admin needs to import UBS FAUNA, FLORA, and REALIA XML files so entries are available for browsing." },
    @{ title = "GH-009 US-009 Data integrity round-trip validation"; body = "Admin needs proof that imported data has not been corrupted or lost during import/export cycles." },
    @{ title = "GH-012 FR-03 Browser page route & dark/light themes"; body = "Set up /browser route with public access, SSR initial render, and dark/light theme support." },
    @{ title = "GH-001 US-001 Browse entry list"; body = "Users need to see a paginated list of all entries across imported resources to understand the scope of work." },
    @{ title = "GH-003 US-003 Search for an entry"; body = "Translators need fast, unified search to jump directly to entries without mode toggles." },
    @{ title = "GH-002 US-002 Filter by translation status"; body = "Translators need to filter entries by status to focus on entries that need their attention." },
    @{ title = "GH-004 US-004 Scope search to specific resources"; body = "Translators need to narrow search results to specific resources to avoid clutter." },
    @{ title = "GH-006 US-006 Select target language"; body = "Translators need to set a target language once and have it persist across sessions." },
    @{ title = "GH-005 US-005 View entry detail"; body = "Users need to see full source content and existing translations for each entry to assess work progress." },
    @{ title = "GH-007 US-007 Preserve browser state"; body = "Users need browser navigation to preserve filters, scroll position, and selection." },
    @{ title = "GH-010 US-010 Public reader ratings and feedback"; body = "Public Readers need to submit entry ratings and feedback without creating an account with CAPTCHA anti-spam." }
)

foreach ($issue in $issues) {
    Write-Host "Creating: $($issue.title)"
    gh issue create -t $issue.title -b $issue.body -m "Phase 1" 2>&1 | Select-Object -First 1
    Start-Sleep -Milliseconds 500
}

Write-Host "`nAll issues created! Listing them now:`n"
gh issue list --limit 20 --state all

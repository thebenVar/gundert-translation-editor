# UBS Resources Workspace

This repository is organized by function to keep content, code, and tools easy to find.

## Structure

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

## Entry Points

- Root browser.html redirects to pages/browser.html
- Root dashboard.html redirects to pages/dashboard.html
- Root fauna.html redirects to pages/fauna.html
- Root flora.html redirects to pages/flora.html
- Root realia.html redirects to pages/realia.html
- Root test-runner.html redirects to tests/test-runner.html

## Working With Data Scripts

Run scripts from the repository root:

- node scripts/analyze_dictionaries.js
- node scripts/analyze_sfm.js

Outputs are written to data/.

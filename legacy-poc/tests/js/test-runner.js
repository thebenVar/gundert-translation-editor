// Create a mock ALL_DICTIONARY_ENTRIES for testing if needed
        if (typeof ALL_DICTIONARY_ENTRIES === 'undefined') {
            window.ALL_DICTIONARY_ENTRIES = [
                {
                    key: '1.1',
                    title: 'Lion',
                    category: 'fauna',
                    content: 'The lion is mentioned in John 3:16. Also see Matthew 5:5.',
                    wordCount: 12
                },
                {
                    key: '2.1',
                    title: 'Olive Tree',
                    category: 'flora',
                    content: 'Referenced in Romans 11:17 and also 1 Peter 2:24.',
                    wordCount: 20
                }
            ];
        }

// Global variables needed by test suite
        let allEntries = [];
        let bibleReferenceIndex = {};
        let activeFilters = { dictionary: '', topKey: '', keyScope: '', searchTerm: '', searchMode: 'entries' };
    let keyTitleLookup = new Map();

        // Extract and inject the functions we need from browser.html
        // These are the core functions being tested
        const BBB_TO_USFM = {
            '001': 'GEN', '002': 'EXO', '003': 'LEV', '004': 'NUM', '005': 'DEU', '006': 'JOS', '007': 'JDG', '008': 'RUT',
            '009': '1SA', '010': '2SA', '011': '1KI', '012': '2KI', '013': '1CH', '014': '2CH', '015': 'EZR', '016': 'NEH',
            '017': 'EST', '018': 'JOB', '019': 'PSA', '020': 'PRO', '021': 'ECC', '022': 'SNG', '023': 'ISA', '024': 'JER',
            '025': 'LAM', '026': 'EZK', '027': 'DAN', '028': 'HOS', '029': 'JOL', '030': 'AMO', '031': 'OBA', '032': 'JON',
            '033': 'MIC', '034': 'NAM', '035': 'HAB', '036': 'ZEP', '037': 'HAG', '038': 'ZEC', '039': 'MAL', '040': 'MAT',
            '041': 'MRK', '042': 'LUK', '043': 'JHN', '044': 'ACT', '045': 'ROM', '046': '1CO', '047': '2CO', '048': 'GAL',
            '049': 'EPH', '050': 'PHP', '051': 'COL', '052': '1TH', '053': '2TH', '054': '1TI', '055': '2TI', '056': 'TIT',
            '057': 'PHM', '058': 'HEB', '059': 'JAS', '060': '1PE', '061': '2PE', '062': '1JN', '063': '2JN', '064': '3JN',
            '065': 'JUD', '066': 'REV'
        };

        function formatMnemonicReference(token) {
            const raw = (token || '').trim();
            const match = raw.match(/^[A-Z]?(\d{14})$/);
            if (!match) return raw;

            const numeric = match[1];
            const bbb = numeric.slice(0, 3);
            const ccc = numeric.slice(3, 6);
            const vvv = numeric.slice(6, 9);
            const usfmBook = BBB_TO_USFM[bbb];

            if (!usfmBook) return raw;

            const chapter = String(parseInt(ccc, 10));
            const verse = String(parseInt(vvv, 10));
            return `${usfmBook} ${chapter}:${verse}`;
        }

        const HUMAN_REFERENCE_PATTERN = /\b(?:[1-4]\s+)?(?:[A-Z]{2,}|[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|of))*)\s+\d+:\d+(?:-\d+)?\b/g;

        function extractBibleReferences(content) {
            if (!content) return [];
            const references = [];

            let match;
            while ((match = HUMAN_REFERENCE_PATTERN.exec(content)) !== null) {
                references.push(match[0]);
            }

            const mnemonicPattern = /\b[A-Z]?(\d{14})\b/g;
            while ((match = mnemonicPattern.exec(content)) !== null) {
                references.push(match[0]);
                const formatted = formatMnemonicReference(match[0]);
                if (formatted && formatted !== match[0]) {
                    references.push(formatted);
                }
            }

            return references;
        }

        function normalizeBibleReference(ref) {
            const normalized = (ref || '').trim().replace(/\s+/g, ' ').toLowerCase();
            if (normalized.length === 0) return null;
            return normalized;
        }

        function buildBibleReferenceIndex() {
            bibleReferenceIndex = {};
            allEntries.forEach((entry, entryIdx) => {
                const references = extractBibleReferences(entry.content);
                references.forEach(ref => {
                    const normalized = normalizeBibleReference(ref);
                    if (normalized) {
                        if (!bibleReferenceIndex[normalized]) {
                            bibleReferenceIndex[normalized] = [];
                        }
                        if (!bibleReferenceIndex[normalized].includes(entryIdx)) {
                            bibleReferenceIndex[normalized].push(entryIdx);
                        }
                    }
                });
            });
        }

        function searchBibleReferences(term) {
            if (!term || term.length < 2) {
                return [];
            }
            
            const searchTerm = term.toLowerCase();
            const matchingIndices = new Set();
            
            Object.entries(bibleReferenceIndex).forEach(([ref, indices]) => {
                if (ref.includes(searchTerm)) {
                    indices.forEach(idx => matchingIndices.add(idx));
                }
            });
            
            return Array.from(matchingIndices).map(idx => allEntries[idx]);
        }

        function getFilteredEntries() {
            if (activeFilters.searchMode === 'references' && activeFilters.searchTerm) {
                let results = searchBibleReferences(activeFilters.searchTerm);
                
                if (activeFilters.dictionary) {
                    results = results.filter(e => (e.category || '').toLowerCase() === activeFilters.dictionary);
                }
                
                return results;
            }
            
            let results = allEntries;
            if (activeFilters.dictionary) {
                results = results.filter(e => (e.category || '').toLowerCase() === activeFilters.dictionary);
            }
            if (activeFilters.searchTerm) {
                const term = activeFilters.searchTerm;
                results = results.filter(e =>
                    (e.title || '').toLowerCase().includes(term) || String(e.key || '').includes(term)
                );
            }
            return results;
        }

        function resolveImageCandidates(baseName) {
            const imageBasePaths = [
                '../data/images',
                'data/images',
                'images',
                'https://raw.githubusercontent.com/tfbf/scripture-resource-studio-app/main/images'
            ];
            const explicitExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(baseName);
            if (explicitExt) {
                return imageBasePaths.map(basePath => `${basePath}/${baseName}`);
            }

            const extensions = ['jpg', 'png', 'jpeg', 'webp', 'gif', 'JPG', 'PNG', 'JPEG', 'WEBP'];
            const candidates = [];

            imageBasePaths.forEach((basePath) => {
                extensions.forEach((ext) => {
                    candidates.push(`${basePath}/${baseName}.${ext}`);
                });
            });

            return candidates;
        }

        function buildKeyTitleLookup() {
            keyTitleLookup = new Map();
            allEntries.forEach((entry) => {
                const key = String(entry.key || '');
                const category = String(entry.category || '').toLowerCase();
                if (key) {
                    keyTitleLookup.set(`${category}|${key}`, entry.title || `Section ${key}`);
                }
            });
        }

        function getHierarchyLabels(entry) {
            const key = String(entry.key || '');
            const category = String(entry.category || '').toLowerCase();
            const parts = key.split('.').filter(Boolean);
            if (parts.length === 0) {
                return { categoryLabel: '', subcategoryLabel: '' };
            }

            const topKey = parts[0];
            const categoryLabel = keyTitleLookup.get(`${category}|${topKey}`) || `Section ${topKey}`;

            let subcategoryLabel = '';
            if (parts.length === 1) {
                subcategoryLabel = '';
            } else if (parts.length === 2) {
                subcategoryLabel = keyTitleLookup.get(`${category}|${key}`) || '';
            } else {
                const parentKey = parts.slice(0, -1).join('.');
                subcategoryLabel = keyTitleLookup.get(`${category}|${parentKey}`) || '';
            }

            if (subcategoryLabel === categoryLabel) {
                subcategoryLabel = '';
            }

            return { categoryLabel, subcategoryLabel };
        }

        function renderList(entries) {
            const listEl = document.getElementById('entryList');
            if (!listEl) return;
            listEl.innerHTML = entries.map((entry, idx) => {
                const hierarchy = getHierarchyLabels(entry);
                const subTag = hierarchy.subcategoryLabel
                    ? `<span class="meta-tag sub"><strong>Sub:</strong>${hierarchy.subcategoryLabel}</span>`
                    : '';

                return `
                <div class="entry-item" data-cat="${(entry.category || '').toLowerCase()}" onclick="viewEntry(${idx}, this)">
                    <span class="title">${entry.title}</span>
                    <div class="meta">
                        <div class="meta-row">
                            <span class="badge badge-${entry.category.toLowerCase()}">${entry.category}</span>
                            <span class="meta-key">Key: ${entry.key}</span>
                        </div>
                        <div class="meta-row">
                            <div class="meta-hierarchy">
                                <span class="meta-tag"><strong>Category:</strong>${hierarchy.categoryLabel}</span>
                                ${subTag}
                            </div>
                        </div>
                        <div class="meta-row meta-row-secondary">
                            <span class="meta-words">${entry.wordCount} words</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }

        function escapeXmlText(text) {
            return (text || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function getRenderableXmlChildren(node) {
            return Array.from(node.childNodes || []).filter((child) => {
                if (child.nodeType !== Node.TEXT_NODE) {
                    return true;
                }
                return Boolean((child.textContent || '').trim());
            });
        }

        function renderXmlNode(node, depth = 0) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
                if (!text) {
                    return '';
                }
                return `<div class="xml-text" style="--xml-depth:${depth}">${escapeXmlText(text)}</div>`;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
                return '';
            }

            const tagName = (node.tagName || '').toLowerCase();
            const attrs = Array.from(node.attributes || [])
                .map((attr) => ` <span class="xml-attr-name">${escapeXmlText(attr.name)}</span>=<span class="xml-attr-value">&quot;${escapeXmlText(attr.value)}&quot;</span>`)
                .join('');

            const children = getRenderableXmlChildren(node);
            const openTag = `<span class="xml-punc">&lt;</span><span class="xml-tag">${escapeXmlText(tagName)}</span>${attrs}<span class="xml-punc">&gt;</span>`;
            const closeTag = `<span class="xml-punc">&lt;/</span><span class="xml-tag">${escapeXmlText(tagName)}</span><span class="xml-punc">&gt;</span>`;

            if (children.length === 0) {
                return `<div class="xml-leaf" style="--xml-depth:${depth}"><span class="xml-punc">&lt;</span><span class="xml-tag">${escapeXmlText(tagName)}</span>${attrs}<span class="xml-punc"> /&gt;</span></div>`;
            }

            const renderedChildren = children
                .map((child) => renderXmlNode(child, depth + 1))
                .filter(Boolean)
                .join('');

            const isTopLevel = depth === 0;
            return `
                <details class="xml-node" style="--xml-depth:${depth}"${isTopLevel ? ' open' : ''}>
                    <summary class="xml-summary">${openTag}</summary>
                    <div class="xml-children">${renderedChildren}</div>
                    <div class="xml-close">${closeTag}</div>
                </details>
            `;
        }

        function buildXmlView(rawContent) {
            if (!rawContent) {
                return '<div class="xml-viewer"><div class="xml-empty">No XML content found for this entry.</div></div>';
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(`<xml-root>${rawContent}</xml-root>`, 'text/html');
            const root = doc.querySelector('xml-root');
            if (!root) {
                return `<div class="xml-viewer"><pre class="xml-fallback">${escapeXmlText(rawContent)}</pre></div>`;
            }

            const rendered = getRenderableXmlChildren(root)
                .map((node) => renderXmlNode(node, 0))
                .filter(Boolean)
                .join('');

            if (!rendered) {
                return '<div class="xml-viewer"><div class="xml-empty">No XML content found for this entry.</div></div>';
            }

            return `<div class="xml-viewer" aria-label="Read-only XML view">${rendered}</div>`;
        }

const consoleEl = document.getElementById('console');
        const summaryEl = document.getElementById('summary');
        const resultsEl = document.getElementById('testResults');

        // Override console.log for testing
        const originalLog = console.log;
        const originalError = console.error;

        function addConsoleLine(text, className = '') {
            const line = document.createElement('div');
            line.className = `console-line ${className}`;
            line.textContent = text;
            consoleEl.appendChild(line);
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }

        console.log = function(...args) {
            const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            originalLog(...args);
            
            if (text.includes('PASS')) {
                addConsoleLine(text, 'console-pass');
            } else if (text.includes('FAIL')) {
                addConsoleLine(text, 'console-fail');
            } else if (text.includes('===')) {
                addConsoleLine(text, 'console-section');
            } else if (text.includes('PASS') || text.includes('FAIL') || text.includes('All tests passed')) {
                addConsoleLine(text, 'console-info');
            } else {
                addConsoleLine(text);
            }
        };

        console.error = function(...args) {
            const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            originalError(...args);
            addConsoleLine(text, 'console-fail');
        };

        function clearConsole() {
            consoleEl.innerHTML = '';
            summaryEl.style.display = 'none';
            resultsEl.style.display = 'none';
        }

        function runTests() {
            clearConsole();
            addConsoleLine('Running tests...', 'console-debug');
            
            setTimeout(() => {
                try {
                    const results = runAllTests();
                    
                    // Update summary cards
                    document.getElementById('passedCount').textContent = results.passed;
                    document.getElementById('failedCount').textContent = results.failed;
                    document.getElementById('totalCount').textContent = results.total;
                    summaryEl.style.display = 'grid';
                    
                    // Display detailed results
                    if (results.results.length > 0) {
                        resultsEl.innerHTML = results.results.map((r, idx) => `
                            <div class="test-result ${r.status.toLowerCase()}">
                                <span class="test-result-status">${r.status}</span>
                                <span class="test-result-name">${r.testName}</span>
                                ${r.message ? `<div class="test-result-message">${r.message}</div>` : ''}
                            </div>
                        `).join('');
                        resultsEl.style.display = 'block';
                    }
                    
                } catch (err) {
                    addConsoleLine(`Error running tests: ${err.message}`, 'console-fail');
                    originalError(err);
                }
            }, 100);
        }

        function downloadResults() {
            const text = consoleEl.innerText;
            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
            element.setAttribute('download', 'test-results.txt');
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        }

        // Initial message
        addConsoleLine('Ready to run tests. Click "Run All Tests" to begin.', 'console-info');

const INTEGRATION_MODE = {
            primary: 'biblebrains-api',
            fallback: 'live-bible-is-link'
        };

        const LOCAL_STORAGE_KEYS = {
            selectedBibleIds: 'selectedBibleIds',
            viewerDisplayMode: 'viewerDisplayMode',
            contextExpansionState: 'contextExpansionState',
            browserContentView: 'browserContentView',
            browserTargetLang: 'browserTargetLang'
        };

        const FEATURE_FLAGS = {
            enableBibleViewer: false,
            enableBibleCatalogFetch: false,
            enableBibleTextFetch: false
        };

        const ENTRY_FEEDBACK_STORAGE_KEY = 'entryFeedbackByLang';

        function getFeatureFlag(flagName) {
            const params = new URLSearchParams(window.location.search);
            const paramValue = params.get(`ff_${flagName}`);
            if (paramValue === '1' || paramValue === 'true') {
                return true;
            }
            if (paramValue === '0' || paramValue === 'false') {
                return false;
            }
            return Boolean(FEATURE_FLAGS[flagName]);
        }

        function setLocalPreference(keyName, value) {
            if (!LOCAL_STORAGE_KEYS[keyName]) {
                return;
            }
            localStorage.setItem(LOCAL_STORAGE_KEYS[keyName], JSON.stringify(value));
        }

        function getLocalPreference(keyName, fallbackValue = null) {
            if (!LOCAL_STORAGE_KEYS[keyName]) {
                return fallbackValue;
            }

            const raw = localStorage.getItem(LOCAL_STORAGE_KEYS[keyName]);
            if (!raw) {
                return fallbackValue;
            }

            try {
                return JSON.parse(raw);
            } catch {
                return fallbackValue;
            }
        }

        // ---- Phase 1: Bible Viewer ----

        function parseUSFMReference(refString) {
            const match = (refString || '').trim().match(/^([1-4]?[A-Z]{2,3})\s+(\d+):(\d+)/);
            if (!match) return null;
            return { book: match[1], chapter: parseInt(match[2], 10), verse: parseInt(match[3], 10) };
        }

        function renderMockVersionCards(parsedRef) {
            if (!parsedRef) {
                return '<div class="bv-empty">Could not parse this reference.</div>';
            }
            const selectedIds = getSelectedVersionIds();
            const versions = selectedIds
                .map(id => BIBLE_CATALOG.find(v => v.id === id))
                .filter(Boolean);

            if (versions.length === 0) {
                return '<div class="bv-empty">No Bible versions selected.<br>Open Bible Versions to choose versions to display.</div>';
            }

            return versions.map(v => `
                <div class="bv-card" data-version-id="${v.id}">
                    <div class="bv-card-header">
                        <span class="bv-card-version-name">${v.name}</span>
                        <span class="bv-card-lang">${v.lang}</span>
                    </div>
                    <div class="bv-card-body">
                        <span class="bv-card-verse-num">${parsedRef.verse}</span>
                        Mock text for ${v.id} - live content will load here once a BibleBrains API key is configured (Phase 3).
                    </div>
                </div>
            `).join('');
        }

        function openBibleViewer(refString) {
            const viewer = document.getElementById('bibleViewer');
            const refLabel = document.getElementById('bvRefLabel');
            const cardsEl = document.getElementById('bvCards');
            if (!viewer) return;
            const parsed = parseUSFMReference(refString);
            refLabel.textContent = refString || 'Bible Viewer';
            cardsEl.innerHTML = renderMockVersionCards(parsed);
            viewer.classList.remove('is-hidden');
        }

        function closeBibleViewer() {
            const viewer = document.getElementById('bibleViewer');
            if (viewer) viewer.classList.add('is-hidden');
        }

        function openBibleSettings() {
            const panel = document.getElementById('bibleSettings');
            if (!panel) return;
            renderSettingsPanel();
            panel.classList.remove('is-hidden');
            // Focus search after render
            const searchEl = document.getElementById('bsSearch');
            if (searchEl) setTimeout(() => searchEl.focus(), 50);
        }

        function closeBibleSettings() {
            const panel = document.getElementById('bibleSettings');
            if (panel) panel.classList.add('is-hidden');
        }

        function initBibleViewer() {
            const viewerEnabled = getFeatureFlag('enableBibleViewer');

            const settingsBtn = document.getElementById('bibleSettingsBtn');
            if (settingsBtn) {
                if (viewerEnabled) {
                    settingsBtn.classList.remove('is-hidden');
                    settingsBtn.addEventListener('click', openBibleSettings);
                } else {
                    settingsBtn.classList.add('is-hidden');
                }
            }

            const bvClose = document.getElementById('bvClose');
            if (bvClose) bvClose.addEventListener('click', closeBibleViewer);

            const bsClose = document.getElementById('bsClose');
            if (bsClose) bsClose.addEventListener('click', closeBibleSettings);
        }

        // ---- Phase 2: Catalog & Settings ----

        const BIBLE_CATALOG = [
            // English
            { id: 'ENGESV', name: 'English Standard Version',         lang: 'English',    langCode: 'eng' },
            { id: 'ENGKJV', name: 'King James Version',               lang: 'English',    langCode: 'eng' },
            { id: 'ENGNIV', name: 'New International Version',        lang: 'English',    langCode: 'eng' },
            { id: 'ENGNLT', name: 'New Living Translation',           lang: 'English',    langCode: 'eng' },
            // French
            { id: 'FRABLS', name: 'Bible en franÃ§ais courant',        lang: 'French',     langCode: 'fra' },
            { id: 'FRASEG', name: 'Segond 21',                        lang: 'French',     langCode: 'fra' },
            // Spanish
            { id: 'SPARVR', name: 'Reina-Valera 1960',                lang: 'Spanish',    langCode: 'spa' },
            { id: 'SPANVI', name: 'Nueva VersiÃ³n Internacional',      lang: 'Spanish',    langCode: 'spa' },
            // Portuguese
            { id: 'PORJFA', name: 'JoÃ£o Ferreira de Almeida',         lang: 'Portuguese', langCode: 'por' },
            { id: 'PORNVI', name: 'Nova VersÃ£o Internacional',        lang: 'Portuguese', langCode: 'por' },
            // German
            { id: 'GERLUT', name: 'Lutherbibel',                      lang: 'German',     langCode: 'deu' },
            { id: 'GERELB', name: 'EinheitsÃ¼bersetzung',              lang: 'German',     langCode: 'deu' },
            // Swahili
            { id: 'SWASUV', name: 'Swahili Union Version',            lang: 'Swahili',    langCode: 'swa' },
            { id: 'SWABHN', name: 'Habari Njema',                     lang: 'Swahili',    langCode: 'swa' },
            // Indonesian
            { id: 'INDTBI', name: 'Terjemahan Baru',                  lang: 'Indonesian', langCode: 'ind' },
            { id: 'INDTKI', name: 'Terjemahan Kitab Injil',           lang: 'Indonesian', langCode: 'ind' },
            // Tagalog
            { id: 'TAGMBB', name: 'Magandang Balita Biblia',          lang: 'Tagalog',    langCode: 'tgl' },
            { id: 'TAGPAG', name: 'Ang Salita ng Dios',               lang: 'Tagalog',    langCode: 'tgl' },
            // Hindi
            { id: 'HINIRV', name: 'Indian Revised Version',           lang: 'Hindi',      langCode: 'hin' },
            // Amharic
            { id: 'AMHBIB', name: 'Amharic Bible (1994)',             lang: 'Amharic',    langCode: 'amh' },
            // Hausa
            { id: 'HAUBSN', name: 'Littafi Mai Tsarki',               lang: 'Hausa',      langCode: 'hau' },
            // Yoruba
            { id: 'YORBIB', name: 'Bibeli Mimo',                      lang: 'Yoruba',     langCode: 'yor' },
            // Zulu
            { id: 'ZULBIB', name: 'IBhayibheli',                      lang: 'Zulu',       langCode: 'zul' },
            // Tok Pisin
            { id: 'TOKBUK', name: 'Buk Baibel',                       lang: 'Tok Pisin',  langCode: 'tpi' },
            // Malagasy
            { id: 'MLGBIB', name: 'Baiboly Malagasy',                 lang: 'Malagasy',   langCode: 'mlg' }
        ];

        const DEFAULT_SELECTED_IDS = ['ENGESV'];

        function getSelectedVersionIds() {
            const saved = getLocalPreference('selectedBibleIds', null);
            if (Array.isArray(saved) && saved.length > 0) return saved;
            return [...DEFAULT_SELECTED_IDS];
        }

        function saveSelectedVersionIds(ids) {
            setLocalPreference('selectedBibleIds', ids);
        }

        function groupCatalogByLanguage(catalog) {
            const map = {};
            catalog.forEach(v => {
                if (!map[v.lang]) map[v.lang] = [];
                map[v.lang].push(v);
            });
            return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
        }

        function renderLanguageGroups(groups, selected) {
            return groups.map(([lang, versions]) => `
                <div class="bs-lang-group" data-lang="${lang.toLowerCase()}">
                    <div class="bs-lang-header">${lang} <span class="bs-lang-count">${versions.length}</span></div>
                    <div class="bs-version-list">
                        ${versions.map(v => `
                            <label class="bs-version-row${selected.has(v.id) ? ' is-checked' : ''}">
                                <input type="checkbox" class="bs-checkbox" data-version-id="${v.id}"${selected.has(v.id) ? ' checked' : ''}>
                                <span class="bs-version-label">${v.name}</span>
                                <span class="bs-version-id">${v.id}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }

        function filterSettingsGroups(term) {
            const groups = document.querySelectorAll('#bsLangGroups .bs-lang-group');
            groups.forEach(group => {
                const langName = group.dataset.lang || '';
                const rows = group.querySelectorAll('.bs-version-row');
                let visibleCount = 0;
                rows.forEach(row => {
                    const rowText = row.textContent.toLowerCase();
                    const show = !term || langName.includes(term) || rowText.includes(term);
                    row.style.display = show ? '' : 'none';
                    if (show) visibleCount++;
                });
                group.style.display = (!term || langName.includes(term) || visibleCount > 0) ? '' : 'none';
            });
        }

        function renderSettingsPanel() {
            const content = document.getElementById('bsContent');
            if (!content) return;

            const currentSelected = new Set(getSelectedVersionIds());
            const groups = groupCatalogByLanguage(BIBLE_CATALOG);

            content.innerHTML = `
                <div class="bs-search-row">
                    <input type="text" id="bsSearch" class="bs-search" placeholder="Filter languages or versions..." autocomplete="off" aria-label="Filter versions">
                    <span class="bs-selected-count" id="bsSelectedCount">${currentSelected.size} selected</span>
                </div>
                <div class="bs-lang-groups" id="bsLangGroups">
                    ${renderLanguageGroups(groups, currentSelected)}
                </div>
                <div class="bs-save-row">
                    <button type="button" class="bs-save-btn" id="bsSave">Save &amp; Close</button>
                </div>
            `;

            // Fix layout: make bs-body a proper flex column container
            const bsBody = document.querySelector('.bs-body');
            if (bsBody) {
                bsBody.style.display = 'flex';
                bsBody.style.flexDirection = 'column';
                bsBody.style.overflow = 'hidden';
                bsBody.style.padding = '14px 16px';
                content.style.display = 'contents';
            }

            document.getElementById('bsSearch').addEventListener('input', e => {
                filterSettingsGroups(e.target.value.toLowerCase());
            });

            document.getElementById('bsLangGroups').addEventListener('change', e => {
                const target = e.target;
                if (target.type !== 'checkbox') return;
                const id = target.dataset.versionId;
                const row = target.closest('.bs-version-row');
                if (target.checked) {
                    currentSelected.add(id);
                    if (row) row.classList.add('is-checked');
                } else {
                    currentSelected.delete(id);
                    if (row) row.classList.remove('is-checked');
                }
                const countEl = document.getElementById('bsSelectedCount');
                if (countEl) countEl.textContent = `${currentSelected.size} selected`;
            });

            document.getElementById('bsSave').addEventListener('click', () => {
                saveSelectedVersionIds([...currentSelected]);
                closeBibleSettings();
                // Re-render viewer cards with new selection if viewer is open
                const viewer = document.getElementById('bibleViewer');
                const refLabel = document.getElementById('bvRefLabel');
                if (viewer && !viewer.classList.contains('is-hidden') && refLabel && refLabel.textContent !== 'Bible Viewer') {
                    openBibleViewer(refLabel.textContent);
                }
            });
        }

        let allEntries = [];
        let scopedEntries = [];
        let visibleEntries = [];
        let keyTitleLookup = new Map();
        let currentViewedEntry = null;
        let requestedEntryKey = '';
        let contentViewMode = getLocalPreference('browserContentView', 'source') === 'target' ? 'target' : 'source';
        let targetLang = String(getLocalPreference('browserTargetLang', 'ml') || 'ml');
        let translationDraftsByLang = {};
        let translationReadyByLang = {};

        // Viewer mode can be rendered (formatted) or xml (read-only tree).
        let viewerMode = getLocalPreference('viewerDisplayMode', 'rendered') === 'xml' ? 'xml' : 'rendered';

        // Active filter state (UI-driven; seeded from URL on load)
        let activeFilters = { dictionary: '', topKey: '', keyScope: '', searchTerm: '', searchMode: 'entries' };
        
        // Bible reference index: map of normalized reference -> array of entry indices
        let bibleReferenceIndex = {};
        const HUMAN_REFERENCE_PATTERN = /\b(?:[1-4]\s+)?(?:[A-Z]{2,}|[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|of))*)\s+\d+:\d+(?:-\d+)?\b/g;

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

        function getDraftStorageKey(lang) {
            return `translatorDrafts_${lang}`;
        }

        function getReadyStorageKey(lang) {
            return `translatorReady_${lang}`;
        }

        function readJsonLocalStorage(key, fallback) {
            const raw = localStorage.getItem(key);
            if (!raw) {
                return fallback;
            }
            try {
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : fallback;
            } catch {
                return fallback;
            }
        }

        function loadTranslationState(lang) {
            const normalizedLang = String(lang || 'ml');
            translationDraftsByLang[normalizedLang] = readJsonLocalStorage(getDraftStorageKey(normalizedLang), {});
            translationReadyByLang[normalizedLang] = readJsonLocalStorage(getReadyStorageKey(normalizedLang), {});
            return {
                drafts: translationDraftsByLang[normalizedLang],
                ready: translationReadyByLang[normalizedLang]
            };
        }

        function getEntryCacheKey(entry) {
            if (!entry) return null;
            const cat = String(entry.category || '').toLowerCase();
            return `${cat ? cat + ':' : ''}${entry.key}`;
        }

        function getDraftForEntry(entry, lang) {
            if (!entry) return null;
            const state = loadTranslationState(lang);
            const cacheKey = getEntryCacheKey(entry);
            const newKey = `${lang}:${cacheKey}`;
            const oldKey = `${lang}:${entry.key}`;
            
            const draft = state.drafts[newKey] || state.drafts[oldKey];
            
            if (!draft || typeof draft !== 'object') {
                return null;
            }
            if (!Array.isArray(draft.sections)) {
                return null;
            }
            return draft;
        }

        function isEntryCompletedInLang(entry, lang) {
            if (!entry) return false;
            const state = loadTranslationState(lang);
            const cacheKey = getEntryCacheKey(entry);
            const ready = Boolean(state.ready[cacheKey] || state.ready[String(entry.key)]);
            if (!ready) {
                return false;
            }
            return Boolean(getDraftForEntry(entry, lang));
        }

        function getEntryTranslationStatus(entry, lang) {
            if (!entry) {
                return 'fallback';
            }
            const hasDraft = Boolean(getDraftForEntry(entry, lang));
            if (hasDraft && isEntryCompletedInLang(entry, lang)) {
                return 'reviewed';
            }
            if (hasDraft) {
                return 'draft';
            }
            return 'fallback';
        }

        function getTranslationStatusMeta(status, lang) {
            if (status === 'reviewed') {
                return {
                    pillClass: 'is-reviewed',
                    pillText: `${lang} reviewed`,
                    bannerClass: 'is-reviewed',
                    bannerTitle: `Target ${lang} reviewed`,
                    bannerBody: 'This entry is marked ready and reviewed in Translation Workbench.'
                };
            }
            if (status === 'draft') {
                return {
                    pillClass: 'is-draft',
                    pillText: `${lang} draft`,
                    bannerClass: 'is-draft',
                    bannerTitle: `Target ${lang} draft`,
                    bannerBody: 'This translation is saved as a draft and is still under review.'
                };
            }
            return {
                pillClass: 'is-fallback',
                pillText: 'English fallback',
                bannerClass: 'is-fallback',
                bannerTitle: `No ${lang} draft yet`,
                bannerBody: 'Showing the English source as a fallback until a translation draft is saved.'
            };
        }

        function getTargetOnlyTypeLabel(type) {
            if (type === 'target-subheading') return 'Target Subheading';
            if (type === 'translator-note') return 'Translator Note';
            return 'Target Paragraph';
        }

        function isReferenceLine(line) {
            const normalized = (line || '').trim();
            if (!normalized) return false;
            if (/^[A-Z]?\d{14}$/.test(normalized)) return true;
            return /^(?:[1-4]?[A-Z]{2,3})\s+\d+:\d+(?:-\d+)?$/.test(normalized);
        }

        function parseReferenceGroups(lines) {
            const groups = [];
            let current = null;
            lines.forEach((line) => {
                if (isReferenceLine(line)) {
                    if (!current) {
                        current = { sense: '', rendering: '', refs: [] };
                        groups.push(current);
                    }
                    current.refs.push(line);
                    return;
                }
                if (!current || current.refs.length > 0) {
                    current = { sense: line, rendering: '', refs: [] };
                    groups.push(current);
                    return;
                }
                if (!current.rendering) {
                    current.rendering = line;
                } else {
                    current.rendering += ` ${line}`;
                }
            });
            return groups;
        }

        function renderReferenceGroupsHtml(paragraphs) {
            const allText = paragraphs.join('\n');
            const lines = allText
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
                .map((l) => formatMnemonicReferencesInContent(l));

            const groups = parseReferenceGroups(lines);
            if (!groups.some((g) => g.refs.length > 0)) return null;

            const renderedGroups = groups.map((group, idx) => {
                if (group.refs.length === 0) {
                    const noteText = group.rendering
                        ? `${group.sense} ${group.rendering}`.trim()
                        : group.sense;
                    return `<div class="reference-note">${escapeXmlText(noteText)}</div>`;
                }
                const startsCollapsed = idx !== 0;
                const refsHtml = group.refs
                    .map((ref) => `<span class="reference-chip">${escapeXmlText(ref)}</span>`)
                    .join('');
                return `
                    <article class="reference-group">
                        <div class="reference-group-header">
                            <div class="reference-group-title">
                                ${group.sense ? `<div class="reference-sense">${escapeXmlText(group.sense)}</div>` : ''}
                                ${group.rendering ? `<div class="reference-rendering">${escapeXmlText(group.rendering)}</div>` : ''}
                            </div>
                        </div>
                        <div class="reference-list${startsCollapsed ? ' collapsed' : ''}" data-ref-idx="${idx}">${refsHtml}</div>
                    </article>`;
            }).join('');

            return `<div class="reference-groups">${renderedGroups}</div>`;
        }

        function buildTranslatedEntryHtml(draft) {
            if (!draft) {
                return '';
            }

            const title = escapeXmlText(String(draft.title || 'Untitled'));
            const sections = Array.isArray(draft.sections) ? draft.sections : [];
            const targetOnlyBlocks = Array.isArray(draft.targetOnlyBlocks) ? draft.targetOnlyBlocks : [];
            const bySection = new Map();
            targetOnlyBlocks.forEach((block) => {
                const sid = Number(block.sectionId);
                if (!bySection.has(sid)) {
                    bySection.set(sid, []);
                }
                bySection.get(sid).push(block);
            });

            const renderedSections = sections.map((section) => {
                const heading = section.heading ? `<h4>${escapeXmlText(section.heading)}</h4>` : '';
                const isRefSection = section.label === 'reference' || section.label === 'references';
                let paragraphs = '';
                
                if (isRefSection && Array.isArray(section.paragraphs)) {
                    paragraphs = renderReferenceGroupsHtml(section.paragraphs) || section.paragraphs.map((p) => `<p>${escapeXmlText(String(p || ''))}</p>`).join('');
                } else {
                    paragraphs = Array.isArray(section.paragraphs)
                        ? section.paragraphs.map((p) => `<p>${escapeXmlText(String(p || ''))}</p>`).join('')
                        : '';
                }
                
                const injected = (bySection.get(Number(section.id)) || []).map((block) => `
                    <div class="reference-note">
                        <strong>${escapeXmlText(getTargetOnlyTypeLabel(block.type))}:</strong>
                        ${escapeXmlText(String(block.text || ''))}
                    </div>
                `).join('');

                return `
                    <section class="section-box">
                        <div class="section-label">${escapeXmlText(String(section.label || 'section'))}</div>
                        ${heading}
                        ${paragraphs}
                        ${injected}
                    </section>
                `;
            }).join('');

            const translatedHtml = `<div class="section-box"><div class="section-label">translated title</div><h4>${title}</h4></div>${renderedSections}`;
            return formatMnemonicReferencesInContent(translatedHtml);
        }

        function buildTargetContentView(entry, lang) {
            const draft = getDraftForEntry(entry, lang);
            const status = getEntryTranslationStatus(entry, lang);
            const meta = getTranslationStatusMeta(status, lang);

            if (status === 'fallback') {
                return {
                    status,
                    meta,
                    contentHtml: enrichEntryContent(entry.content)
                };
            }

            return {
                status,
                meta,
                contentHtml: buildTranslatedEntryHtml(draft)
            };
        }

        function getFeedbackKey(entry, lang) {
            if (!entry) {
                return '';
            }
            return `${String(lang || 'ml')}:${String(entry.key || '')}`;
        }

        function loadFeedbackStore() {
            return readJsonLocalStorage(ENTRY_FEEDBACK_STORAGE_KEY, {});
        }

        function saveFeedbackStore(store) {
            localStorage.setItem(ENTRY_FEEDBACK_STORAGE_KEY, JSON.stringify(store));
        }

        function getFeedbackForEntry(entry, lang) {
            const key = getFeedbackKey(entry, lang);
            if (!key) {
                return [];
            }
            const store = loadFeedbackStore();
            const list = store[key];
            if (!Array.isArray(list)) {
                return [];
            }
            return list.filter((item) => {
                if (!item || typeof item !== 'object') {
                    return false;
                }
                const rating = Number(item.rating);
                return Number.isFinite(rating) && rating >= 1 && rating <= 5;
            });
        }

        function saveFeedbackForEntry(entry, lang, payload) {
            const key = getFeedbackKey(entry, lang);
            if (!key) {
                return;
            }
            const store = loadFeedbackStore();
            const current = Array.isArray(store[key]) ? store[key] : [];
            const next = [
                {
                    rating: Number(payload.rating),
                    comment: String(payload.comment || '').trim(),
                    status: String(payload.status || ''),
                    createdAt: new Date().toISOString()
                },
                ...current
            ].slice(0, 100);
            store[key] = next;
            saveFeedbackStore(store);
        }

        function getFeedbackSummary(entry, lang) {
            const items = getFeedbackForEntry(entry, lang);
            if (items.length === 0) {
                return {
                    count: 0,
                    average: 0,
                    averageLabel: 'No ratings yet',
                    recent: []
                };
            }

            const total = items.reduce((sum, item) => sum + Number(item.rating || 0), 0);
            const average = total / items.length;
            return {
                count: items.length,
                average,
                averageLabel: `${average.toFixed(1)} / 5`,
                recent: items.slice(0, 5)
            };
        }

        function formatFeedbackDate(isoDate) {
            if (!isoDate) {
                return '';
            }
            const date = new Date(isoDate);
            if (Number.isNaN(date.getTime())) {
                return '';
            }
            return date.toLocaleString();
        }

        function buildAverageStars(average) {
            const rounded = Math.round(Number(average || 0));
            let stars = '';
            for (let i = 1; i <= 5; i += 1) {
                stars += i <= rounded ? '★' : '☆';
            }
            return stars;
        }

        function buildFeedbackPanelHtml(entry, lang, status) {
            const summary = getFeedbackSummary(entry, lang);
            const recentItems = summary.recent.length
                ? summary.recent.map((item) => {
                    const commentHtml = item.comment
                        ? `<p class="entry-feedback-comment">${escapeXmlText(item.comment)}</p>`
                        : '<p class="entry-feedback-comment muted">No written suggestion.</p>';
                    return `
                        <li class="entry-feedback-item">
                            <div class="entry-feedback-item-head">
                                <span class="entry-feedback-item-rating">${buildAverageStars(item.rating)} (${item.rating}/5)</span>
                                <span class="entry-feedback-item-time">${escapeXmlText(formatFeedbackDate(item.createdAt))}</span>
                            </div>
                            ${commentHtml}
                        </li>
                    `;
                }).join('')
                : '<li class="entry-feedback-empty">No feedback submitted for this entry yet.</li>';

            return `
                <section class="entry-feedback-panel" aria-label="Entry feedback">
                    <div class="entry-feedback-summary">
                        <h3>Translation Feedback</h3>
                        <p>Help improve quality by rating this entry and sharing suggestions.</p>
                        <div class="entry-feedback-stats">
                            <span class="entry-feedback-stars" aria-hidden="true">${buildAverageStars(summary.average)}</span>
                            <span class="entry-feedback-average">${summary.averageLabel}</span>
                            <span class="entry-feedback-count">(${summary.count} rating${summary.count === 1 ? '' : 's'})</span>
                        </div>
                    </div>
                    <form class="entry-feedback-form" id="entryFeedbackForm">
                        <input type="hidden" id="entryFeedbackRating" value="">
                        <div class="entry-feedback-row">
                            <label class="entry-feedback-label">Star rating</label>
                            <div class="entry-feedback-rating" role="radiogroup" aria-label="Star rating">
                                <button type="button" class="entry-star-btn" data-rating="1" aria-label="1 star">★</button>
                                <button type="button" class="entry-star-btn" data-rating="2" aria-label="2 stars">★</button>
                                <button type="button" class="entry-star-btn" data-rating="3" aria-label="3 stars">★</button>
                                <button type="button" class="entry-star-btn" data-rating="4" aria-label="4 stars">★</button>
                                <button type="button" class="entry-star-btn" data-rating="5" aria-label="5 stars">★</button>
                            </div>
                        </div>
                        <div class="entry-feedback-row">
                            <label for="entryFeedbackComment" class="entry-feedback-label">Suggestion or feedback</label>
                            <textarea id="entryFeedbackComment" class="entry-feedback-textarea" rows="3" placeholder="Tell us what can be improved in this translation."></textarea>
                        </div>
                        <div class="entry-feedback-row entry-feedback-actions">
                            <button type="submit" class="entry-feedback-submit">Submit feedback</button>
                            <span class="entry-feedback-status">Current status: ${escapeXmlText(String(status || '').toUpperCase())}</span>
                        </div>
                        <p class="entry-feedback-message" id="entryFeedbackMessage" aria-live="polite"></p>
                    </form>
                    <div class="entry-feedback-recent-wrap">
                        <h4>Recent feedback</h4>
                        <ul class="entry-feedback-list">
                            ${recentItems}
                        </ul>
                    </div>
                </section>
            `;
        }

        function bindFeedbackPanel(entry, lang, status) {
            const form = document.getElementById('entryFeedbackForm');
            if (!form) {
                return;
            }

            const ratingInput = document.getElementById('entryFeedbackRating');
            const commentInput = document.getElementById('entryFeedbackComment');
            const messageEl = document.getElementById('entryFeedbackMessage');
            const starButtons = form.querySelectorAll('.entry-star-btn');

            const updateSelectedStars = (rating) => {
                starButtons.forEach((btn) => {
                    const btnRating = Number(btn.dataset.rating || 0);
                    btn.classList.toggle('active', btnRating <= rating);
                    btn.setAttribute('aria-checked', String(btnRating === rating));
                });
                if (ratingInput) {
                    ratingInput.value = String(rating || '');
                }
            };

            starButtons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const rating = Number(btn.dataset.rating || 0);
                    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
                        updateSelectedStars(rating);
                        if (messageEl) {
                            messageEl.textContent = '';
                        }
                    }
                });
            });

            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const rating = Number(ratingInput ? ratingInput.value : 0);
                const comment = commentInput ? commentInput.value : '';
                if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
                    if (messageEl) {
                        messageEl.textContent = 'Please choose a star rating before submitting feedback.';
                    }
                    return;
                }

                saveFeedbackForEntry(entry, lang, {
                    rating,
                    comment,
                    status
                });

                renderCurrentEntryView();
            });
        }

        function bindContentViewControls() {
            const sourceBtn = document.getElementById('viewSourceBtn');
            const targetBtn = document.getElementById('viewTargetBtn');
            const langSelect = document.getElementById('targetLangSelect');
            if (!sourceBtn || !targetBtn || !langSelect) {
                return;
            }

            langSelect.value = targetLang;
            sourceBtn.classList.toggle('active', contentViewMode === 'source');
            targetBtn.classList.toggle('active', contentViewMode === 'target');

            sourceBtn.addEventListener('click', () => {
                contentViewMode = 'source';
                setLocalPreference('browserContentView', contentViewMode);
                sourceBtn.classList.add('active');
                targetBtn.classList.remove('active');
                renderList(visibleEntries);
                renderCurrentEntryView();
            });

            targetBtn.addEventListener('click', () => {
                contentViewMode = 'target';
                setLocalPreference('browserContentView', contentViewMode);
                targetBtn.classList.add('active');
                sourceBtn.classList.remove('active');
                renderList(visibleEntries);
                renderCurrentEntryView();
            });

            langSelect.addEventListener('change', () => {
                targetLang = String(langSelect.value || 'ml');
                setLocalPreference('browserTargetLang', targetLang);
                renderList(visibleEntries);
                renderCurrentEntryView();
            });
        }

        function buildTranslatorEntryUrl(entry) {
            const params = new URLSearchParams();
            params.set('entry', String(entry.key || ''));
            params.set('lang', String(targetLang || 'ml'));
            const category = String(entry.category || '').toLowerCase();
            if (category) {
                params.set('category', category);
            }
            return `translator.html?${params.toString()}`;
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
        
        function buildBibleReferenceIndex() {
            bibleReferenceIndex = {};
            allEntries.forEach((entry, entryIdx) => {
                // Extract all Bible references from content
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
            // Normalize to lowercase for searching
            const normalized = (ref || '').trim().replace(/\s+/g, ' ').toLowerCase();
            if (normalized.length === 0) return null;
            return normalized;
        }
        
        function searchBibleReferences(term) {
            if (!term || term.length < 2) {
                return [];
            }
            
            const searchTerm = term.toLowerCase();
            const matchingIndices = new Set();
            
            // Search through the index
            Object.entries(bibleReferenceIndex).forEach(([ref, indices]) => {
                if (ref.includes(searchTerm)) {
                    indices.forEach(idx => matchingIndices.add(idx));
                }
            });
            
            return Array.from(matchingIndices).map(idx => allEntries[idx]);
        }

        function getTopKeyGroups(dictionary) {
            const pool = dictionary
                ? allEntries.filter(e => (e.category || '').toLowerCase() === dictionary)
                : allEntries;
            const topKeyMap = new Map();
            pool.forEach(entry => {
                const k = String(entry.key || '');
                const topKey = k.split('.')[0];
                if (!topKeyMap.has(topKey)) {
                    const topEntry = pool.find(e => String(e.key) === topKey);
                    topKeyMap.set(topKey, topEntry ? topEntry.title : `Section ${topKey}`);
                }
            });
            return [...topKeyMap.entries()].sort((a, b) => {
                const na = parseInt(a[0], 10), nb = parseInt(b[0], 10);
                return (isNaN(na) || isNaN(nb)) ? a[0].localeCompare(b[0]) : na - nb;
            });
        }

        function populateCategoryDropdown(dictionary, selectedTopKey) {
            const select = document.getElementById('catSelect');
            if (!select) return;
            const groups = getTopKeyGroups(dictionary);
            select.innerHTML = '<option value="">All categories</option>' +
                groups.map(([k, title]) =>
                    `<option value="${k}"${k === selectedTopKey ? ' selected' : ''}>${title}</option>`
                ).join('');
        }

        function renderScopeTag() {
            const container = document.getElementById('scopeTagContainer');
            if (!container) return;
            if (!activeFilters.keyScope) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = `
                <div class="scope-tag">
                    <span>Scope: key ${activeFilters.keyScope}</span>
                    <button class="scope-tag-dismiss" type="button" title="Remove scope" onclick="clearKeyScope()">X</button>
                </div>
            `;
        }

        function clearKeyScope() {
            activeFilters.keyScope = '';
            renderScopeTag();
            applyFilters();
        }

        function getFilteredEntries() {
            // If searching by Bible references
            if (activeFilters.searchMode === 'references' && activeFilters.searchTerm) {
                let results = searchBibleReferences(activeFilters.searchTerm);
                
                // Apply dictionary filter
                if (activeFilters.dictionary) {
                    results = results.filter(e => (e.category || '').toLowerCase() === activeFilters.dictionary);
                }
                
                return results;
            }
            
            // Original entry search mode
            let results = allEntries;
            if (activeFilters.dictionary) {
                results = results.filter(e => (e.category || '').toLowerCase() === activeFilters.dictionary);
            }
            if (activeFilters.keyScope) {
                const ks = activeFilters.keyScope;
                results = results.filter(e => {
                    const k = String(e.key || '');
                    return k === ks || k.startsWith(`${ks}.`);
                });
            } else if (activeFilters.topKey) {
                const tk = activeFilters.topKey;
                results = results.filter(e => {
                    const k = String(e.key || '');
                    return k === tk || k.startsWith(`${tk}.`);
                });
            }
            if (activeFilters.searchTerm) {
                const term = activeFilters.searchTerm;
                results = results.filter(e =>
                    (e.title || '').toLowerCase().includes(term) || String(e.key || '').includes(term)
                );
            }
            return results;
        }

        function updateCountLabel(count) {
            const parts = [];
            
            const searchMode = activeFilters.searchMode;
            if (searchMode === 'references' && activeFilters.searchTerm) {
                return; // Skip context label for reference search
            }
            
            if (activeFilters.dictionary) {
                parts.push(activeFilters.dictionary.charAt(0).toUpperCase() + activeFilters.dictionary.slice(1));
            }
            if (activeFilters.keyScope) {
                parts.push(`key ${activeFilters.keyScope}`);
            } else if (activeFilters.topKey) {
                const sel = document.getElementById('catSelect');
                const opt = sel && sel.querySelector(`option[value="${activeFilters.topKey}"]`);
                parts.push(opt ? opt.textContent : `Section ${activeFilters.topKey}`);
            }
            const context = parts.join(' > ');
            const countEl = document.getElementById('count');
            if (countEl) {
                countEl.textContent = context
                    ? `${count} entries in ${context}`
                    : `${count} entries`;
            }
        }

        function applyFilters() {
            const results = getFilteredEntries();
            renderList(results);
            updateCountLabel(results.length);
        }

        function initFilters() {
            // Initialize search mode toggle
            const modeEntriesBtn = document.getElementById('searchModeEntries');
            const modeReferencesBtn = document.getElementById('searchModeReferences');
            const searchBox = document.getElementById('search');
            
            if (modeEntriesBtn && modeReferencesBtn && searchBox) {
                modeEntriesBtn.addEventListener('click', () => {
                    activeFilters.searchMode = 'entries';
                    activeFilters.searchTerm = '';
                    searchBox.value = '';
                    searchBox.placeholder = 'Search entries...';
                    modeEntriesBtn.classList.add('active');
                    modeReferencesBtn.classList.remove('active');
                    applyFilters();
                });
                
                modeReferencesBtn.addEventListener('click', () => {
                    activeFilters.searchMode = 'references';
                    activeFilters.searchTerm = '';
                    searchBox.value = '';
                    searchBox.placeholder = 'Search Bible refs (e.g., John 3:16)...';
                    modeReferencesBtn.classList.add('active');
                    modeEntriesBtn.classList.remove('active');
                    applyFilters();
                });
            }
            
            // Seed from URL
            const urlContext = getFilterContextFromUrl();
            if (urlContext.category) {
                activeFilters.dictionary = urlContext.category.toLowerCase();
            }
            if (urlContext.keyPrefix) {
                const segments = String(urlContext.keyPrefix).split('.');
                activeFilters.topKey = segments[0];
                if (segments.length > 1) {
                    activeFilters.keyScope = urlContext.keyPrefix;
                }
            }

            // Sync dict pills to seeded state
            document.querySelectorAll('.dict-pill').forEach(pill => {
                const val = pill.dataset.dict;
                pill.classList.toggle('active', val === activeFilters.dictionary);
                pill.addEventListener('click', () => {
                    activeFilters.dictionary = val;
                    activeFilters.topKey = '';
                    activeFilters.keyScope = '';
                    document.querySelectorAll('.dict-pill').forEach(p =>
                        p.classList.toggle('active', p.dataset.dict === val)
                    );
                    populateCategoryDropdown(val, '');
                    renderScopeTag();
                    applyFilters();
                });
            });

            // Seed category dropdown
            populateCategoryDropdown(activeFilters.dictionary, activeFilters.topKey);
            renderScopeTag();

            document.getElementById('catSelect').addEventListener('change', e => {
                activeFilters.topKey = e.target.value;
                activeFilters.keyScope = '';
                renderScopeTag();
                applyFilters();
            });

            document.getElementById('clearFilters').addEventListener('click', () => {
                activeFilters.dictionary = '';
                activeFilters.topKey = '';
                activeFilters.keyScope = '';
                activeFilters.searchTerm = '';
                document.getElementById('search').value = '';
                document.querySelectorAll('.dict-pill').forEach(p =>
                    p.classList.toggle('active', p.dataset.dict === '')
                );
                populateCategoryDropdown('', '');
                renderScopeTag();
                applyFilters();
            });
        }
        const BBB_TO_USFM = {
            '001': 'GEN', '002': 'EXO', '003': 'LEV', '004': 'NUM', '005': 'DEU', '006': 'JOS', '007': 'JDG', '008': 'RUT',
            '009': '1SA', '010': '2SA', '011': '1KI', '012': '2KI', '013': '1CH', '014': '2CH', '015': 'EZR', '016': 'NEH',
            '017': 'EST', '018': 'JOB', '019': 'PSA', '020': 'PRO', '021': 'ECC', '022': 'SNG', '023': 'ISA', '024': 'JER',
            '025': 'LAM', '026': 'EZK', '027': 'DAN', '028': 'HOS', '029': 'JOL', '030': 'AMO', '031': 'OBA', '032': 'JON',
            '033': 'MIC', '034': 'NAM', '035': 'HAB', '036': 'ZEP', '037': 'HAG', '038': 'ZEC', '039': 'MAL', '040': 'MAT',
            '041': 'MRK', '042': 'LUK', '043': 'JHN', '044': 'ACT', '045': 'ROM', '046': '1CO', '047': '2CO', '048': 'GAL',
            '049': 'EPH', '050': 'PHP', '051': 'COL', '052': '1TH', '053': '2TH', '054': '1TI', '055': '2TI', '056': 'TIT',
            '057': 'PHM', '058': 'HEB', '059': 'JAS', '060': '1PE', '061': '2PE', '062': '1JN', '063': '2JN', '064': '3JN',
            '065': 'JUD', '066': 'REV', '067': 'TOB', '068': 'JDT', '069': 'ESG', '070': 'WIS', '071': 'SIR', '072': 'BAR',
            '073': 'LJE', '074': 'S3Y', '075': 'SUS', '076': 'BEL', '077': '1MA', '078': '2MA', '079': '3MA', '080': '4MA',
            '081': '1ES', '082': '2ES', '083': 'MAN', '084': 'PS2', '085': 'ODA', '086': 'PSS'
        };

        function formatMnemonicReference(token) {
            const raw = (token || '').trim();
            const match = raw.match(/^[A-Z]?(\d{14})$/);
            if (!match) {
                return raw;
            }

            const numeric = match[1];
            const bbb = numeric.slice(0, 3);
            const ccc = numeric.slice(3, 6);
            const vvv = numeric.slice(6, 9);
            const usfmBook = BBB_TO_USFM[bbb];

            if (!usfmBook) {
                return raw;
            }

            const chapter = String(parseInt(ccc, 10));
            const verse = String(parseInt(vvv, 10));
            return `${usfmBook} ${chapter}:${verse}`;
        }

        function formatMnemonicReferencesInContent(contentHtml) {
            return contentHtml.replace(/\b[A-Z]?\d{14}\b/g, (token) => formatMnemonicReference(token));
        }

        function normalizeImageBaseName(name) {
            const trimmed = (name || '').trim();
            return trimmed.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
        }

        function buildImageMarkup(baseName, caption) {
            const safeBase = normalizeImageBaseName(baseName);
            const safeCaption = (caption || safeBase).trim();
            if (!safeBase) {
                return '';
            }

            return `
                <figure class="entry-image">
                    <img class="resolved-image" data-image-base="${safeBase}" alt="${safeCaption}">
                    <figcaption>${safeCaption}</figcaption>
                </figure>
            `;
        }

        function enrichEntryContent(rawContent) {
            if (!rawContent) {
                return '<p><i>No content found for this entry.</i></p>';
            }

            const withImages = rawContent.replace(
                /<div class="image-(?:placeholder|box)">\s*Image:\s*([^<]+)\s*<\/div>/gi,
                (_, imageKey) => buildImageMarkup(imageKey, imageKey)
            );

            return formatMnemonicReferencesInContent(withImages);
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

        function bindViewerModeSwitch(viewer) {
            const modeButtons = viewer.querySelectorAll('.viewer-mode-btn');
            modeButtons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const nextMode = btn.dataset.viewMode === 'xml' ? 'xml' : 'rendered';
                    if (viewerMode === nextMode || !currentViewedEntry) {
                        return;
                    }
                    viewerMode = nextMode;
                    setLocalPreference('viewerDisplayMode', viewerMode);
                    renderCurrentEntryView();
                });
            });
        }

        function renderCurrentEntryView() {
            if (!currentViewedEntry) {
                return;
            }

            const entry = currentViewedEntry;
            const viewer = document.getElementById('viewer');
            const isTargetView = contentViewMode === 'target';
            const targetView = isTargetView ? buildTargetContentView(entry, targetLang) : null;
            const contentHtml = isTargetView
                ? targetView.contentHtml
                : (viewerMode === 'xml' ? buildXmlView(entry.content) : enrichEntryContent(entry.content));
            const modeSwitchHtml = isTargetView
                ? ''
                : `<div class="viewer-mode-switch" role="tablist" aria-label="Entry view mode">
                        <button class="viewer-mode-btn${viewerMode === 'rendered' ? ' active' : ''}" type="button" data-view-mode="rendered" role="tab" aria-selected="${viewerMode === 'rendered'}">Formatted</button>
                        <button class="viewer-mode-btn${viewerMode === 'xml' ? ' active' : ''}" type="button" data-view-mode="xml" role="tab" aria-selected="${viewerMode === 'xml'}">XML</button>
                    </div>`;
            const targetBannerHtml = isTargetView
                ? `<div class="translation-state-banner ${targetView.meta.bannerClass}">
                        <strong>${escapeXmlText(targetView.meta.bannerTitle)}</strong>
                        <span>${escapeXmlText(targetView.meta.bannerBody)}</span>
                    </div>`
                : '';
            const targetPillHtml = isTargetView
                ? `<span class="translation-status-pill ${targetView.meta.pillClass}">${escapeXmlText(targetView.meta.pillText)}</span>`
                : '';
            const feedbackPanelHtml = isTargetView
                ? buildFeedbackPanelHtml(entry, targetLang, targetView.status)
                : '';

            viewer.innerHTML = `
                <div class="viewer-header">
                    <span class="badge badge-${entry.category.toLowerCase()}">${entry.category} Dictionary</span>
                    ${targetPillHtml}
                    <h1>${entry.title}</h1>
                    <p style="color: #888; margin-top: 5px;">Key: ${entry.key} | Word Count: ${entry.wordCount}</p>
                    <div class="viewer-tools">
                        <a class="viewer-tool-btn" href="${buildTranslatorEntryUrl(entry)}">Open In Translation Workbench</a>
                    </div>
                    ${modeSwitchHtml}
                </div>
                <div class="entry-content${(!isTargetView && viewerMode === 'xml') ? ' xml-mode' : ''}${isTargetView ? ` target-state-${targetView.status}` : ''}">
                    ${targetBannerHtml}
                    ${contentHtml}
                    ${feedbackPanelHtml}
                </div>
            `;

            if (!isTargetView) {
                bindViewerModeSwitch(viewer);
            }

            if (!isTargetView && viewerMode === 'rendered') {
                enhanceReferenceSections(viewer);
                hydrateEntryImages(viewer);
            }

            if (isTargetView && targetView && targetView.status === 'fallback') {
                enhanceReferenceSections(viewer);
                hydrateEntryImages(viewer);
            }

            if (isTargetView && targetView) {
                bindFeedbackPanel(entry, targetLang, targetView.status);
            }
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

        function tryLoadImage(imgEl, candidates, attempt = 0) {
            if (attempt >= candidates.length) {
                const missing = document.createElement('div');
                missing.className = 'image-missing';
                missing.textContent = `Image not found: ${imgEl.dataset.imageBase}`;
                const parent = imgEl.parentElement;
                imgEl.remove();
                if (parent) {
                    parent.insertBefore(missing, parent.firstChild);
                }
                return;
            }

            const candidate = candidates[attempt];
            const probe = new Image();
            probe.onload = () => {
                imgEl.src = candidate;
            };
            probe.onerror = () => {
                tryLoadImage(imgEl, candidates, attempt + 1);
            };
            probe.src = candidate;
        }

        function hydrateEntryImages(container) {
            const images = container.querySelectorAll('img.resolved-image');
            images.forEach((imgEl) => {
                const baseName = imgEl.dataset.imageBase;
                const candidates = resolveImageCandidates(baseName);
                tryLoadImage(imgEl, candidates);
                
                // Add click handler to open modal
                imgEl.addEventListener('click', () => {
                    openImageModal(imgEl.src, imgEl.alt);
                });
                imgEl.style.cursor = 'pointer';
            });
        }

        function openImageModal(imageSrc, caption) {
            // Create modal if it doesn't exist
            let modal = document.getElementById('imageModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'imageModal';
                modal.className = 'image-modal';
                modal.innerHTML = `
                    <button class="image-modal-close" type="button" title="Close" aria-label="Close image">×</button>
                    <div class="image-modal-content">
                        <img id="modalImage" alt="Full-size view" style="margin-bottom: 12px;">
                        <div class="image-modal-caption" id="modalCaption"></div>
                    </div>
                `;
                document.body.appendChild(modal);
                
                // Close on background click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        closeImageModal();
                    }
                });
                
                // Close button handler
                const closeBtn = modal.querySelector('.image-modal-close');
                closeBtn.addEventListener('click', closeImageModal);
                
                // Close on Escape key
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && modal.classList.contains('show')) {
                        closeImageModal();
                    }
                });
            }
            
            // Set content and show
            modal.querySelector('#modalImage').src = imageSrc;
            modal.querySelector('#modalCaption').textContent = caption || '';
            modal.classList.add('show');
        }

        function closeImageModal() {
            const modal = document.getElementById('imageModal');
            if (modal) {
                modal.classList.remove('show');
            }
        }

        function getFilterContextFromUrl() {
            const params = new URLSearchParams(window.location.search);
            return {
                category: (params.get('category') || '').trim(),
                chapter: (params.get('chapter') || '').trim(),
                subcategory: (params.get('subcategory') || '').trim(),
                keyPrefix: (params.get('key') || '').trim(),
                entry: (params.get('entry') || '').trim(),
                lang: (params.get('lang') || '').trim(),
                content: (params.get('content') || '').trim().toLowerCase()
            };
        }

        function updateBrowserUrlFromEntry(entry) {
            if (!entry) return;
            const params = new URLSearchParams(window.location.search);
            params.set('entry', String(entry.key || ''));
            params.set('lang', String(targetLang || 'ml'));
            params.set('content', String(contentViewMode || 'source'));
            const next = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, '', next);
        }

        function openRequestedEntryIfPresent() {
            if (!requestedEntryKey || visibleEntries.length === 0) {
                return;
            }
            const idx = visibleEntries.findIndex((entry) => String(entry.key || '') === requestedEntryKey);
            if (idx < 0) {
                return;
            }
            const cards = document.querySelectorAll('.entry-item');
            if (cards[idx]) {
                viewEntry(idx, cards[idx]);
            } else {
                currentViewedEntry = visibleEntries[idx];
                renderCurrentEntryView();
            }
            requestedEntryKey = '';
        }

        function tokenizeFilterText(text) {
            return (text || '')
                .toLowerCase()
                .replace(/\.\.\./g, ' ')
                .replace(/[(),:/-]/g, ' ')
                .split(/\s+/)
                .filter(token => token.length > 2);
        }

        function entryMatchesSubcategory(entry, subcategory) {
            if (!subcategory) {
                return true;
            }

            const tokens = tokenizeFilterText(subcategory);
            if (tokens.length === 0) {
                return true;
            }

            const haystack = `${entry.title || ''} ${(entry.content || '').slice(0, 2500)}`.toLowerCase();
            return tokens.every(token => haystack.includes(token));
        }

        function getScopedEntries(entries, filterContext) {
            const byCategory = filterContext.category
                ? entries.filter(entry => (entry.category || '').toLowerCase() === filterContext.category.toLowerCase())
                : entries;

            if (filterContext.keyPrefix) {
                const keyPrefix = filterContext.keyPrefix;
                return byCategory.filter(entry => {
                    const entryKey = (entry.key || '').toString();
                    return entryKey === keyPrefix || entryKey.startsWith(`${keyPrefix}.`);
                });
            }

            if (!filterContext.subcategory) {
                return byCategory;
            }

            const subcategoryMatches = byCategory.filter(entry => entryMatchesSubcategory(entry, filterContext.subcategory));
            return subcategoryMatches;
        }

        function buildScopeLabel(filterContext, scopedCount, totalCount) {
            if (!filterContext.category && !filterContext.subcategory) {
                return `${totalCount} entries available`;
            }

            if (filterContext.keyPrefix) {
                const contextLabel = [filterContext.category, filterContext.subcategory].filter(Boolean).join(' > ');
                return `${scopedCount} entries in ${contextLabel || filterContext.keyPrefix}`;
            }

            if (filterContext.subcategory) {
                const contextLabel = [filterContext.category, filterContext.subcategory].filter(Boolean).join(' > ');
                return `${scopedCount} entries in ${contextLabel}`;
            }

            return `${scopedCount} entries in ${filterContext.category}`;
        }

        function isReferenceLine(line) {
            const normalized = (line || '').trim();
            if (!normalized) {
                return false;
            }

            if (/^[A-Z]?\d{14}$/.test(normalized)) {
                return true;
            }

            return /^(?:[1-4]?[A-Z]{2,3})\s+\d+:\d+(?:-\d+)?$/.test(normalized);
        }

        function parseReferenceGroups(lines) {
            const groups = [];
            let current = null;

            lines.forEach((line) => {
                if (isReferenceLine(line)) {
                    if (!current) {
                        current = { sense: '', rendering: '', refs: [] };
                        groups.push(current);
                    }
                    current.refs.push(line);
                    return;
                }

                if (!current || current.refs.length > 0) {
                    current = { sense: line, rendering: '', refs: [] };
                    groups.push(current);
                    return;
                }

                if (!current.rendering) {
                    current.rendering = line;
                } else {
                    current.rendering += ` ${line}`;
                }
            });

            return groups;
        }

        function enhanceReferenceSections(container) {
            const sectionBoxes = container.querySelectorAll('.section-box');
            sectionBoxes.forEach((sectionBox) => {
                const labelEl = sectionBox.querySelector('.section-label');
                if (!labelEl) {
                    return;
                }
                const labelText = labelEl.textContent.trim().toLowerCase();
                if (!(labelText === 'reference' || labelText === 'references')) {
                    return;
                }

                const sectionCopy = sectionBox.cloneNode(true);
                const copyLabel = sectionCopy.querySelector('.section-label');
                const copyHeading = sectionCopy.querySelector('h4');
                if (copyLabel) {
                    copyLabel.remove();
                }
                if (copyHeading) {
                    copyHeading.remove();
                }

                const lines = sectionCopy.textContent
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(Boolean);

                const groups = parseReferenceGroups(lines);
                const hasReferences = groups.some(group => group.refs.length > 0);
                if (!hasReferences) {
                    return;
                }

                const renderedGroups = groups.map((group, idx) => {
                    if (group.refs.length === 0) {
                        const noteText = group.rendering ? `${group.sense} ${group.rendering}`.trim() : group.sense;
                        return `<div class="reference-note">${noteText}</div>`;
                    }

                    const startsCollapsed = idx !== 0;

                    const refsHtml = group.refs
                        .map(ref => {
                            if (getFeatureFlag('enableBibleViewer')) {
                                const safeRef = ref.replace(/'/g, "\\'");
                                return `<button class="reference-chip" type="button" onclick="openBibleViewer('${safeRef}')">${ref}</button>`;
                            }
                            return `<span class="reference-chip">${ref}</span>`;
                        })
                        .join('');

                    return `
                        <article class="reference-group">
                            <div class="reference-group-header">
                                <div class="reference-group-title">
                                    ${group.sense ? `<div class="reference-sense">${group.sense}</div>` : ''}
                                    ${group.rendering ? `<div class="reference-rendering">${group.rendering}</div>` : ''}
                                </div>
                                <button class="reference-toggle-btn${startsCollapsed ? ' collapsed' : ''}" type="button" data-ref-idx="${idx}" title="Toggle references" aria-expanded="${startsCollapsed ? 'false' : 'true'}">▼</button>
                            </div>
                            <div class="reference-list${startsCollapsed ? ' collapsed' : ''}" data-ref-idx="${idx}">${refsHtml}</div>
                        </article>
                    `;
                }).join('');

                const heading = sectionBox.querySelector('h4');
                const headingHtml = heading ? heading.outerHTML : '<h4>References:</h4>';
                sectionBox.classList.add('references-section');
                sectionBox.innerHTML = `
                    <div class="section-label">${labelEl.textContent}</div>
                    ${headingHtml}
                    <div class="reference-groups">${renderedGroups}</div>
                `;
                
                // Add collapse/expand listeners for individual reference groups
                const toggleBtns = sectionBox.querySelectorAll('.reference-toggle-btn');
                toggleBtns.forEach(btn => {
                    const refIdx = btn.dataset.refIdx;
                    const initialRefList = sectionBox.querySelector(`.reference-list[data-ref-idx="${refIdx}"]`);
                    if (initialRefList) {
                        btn.setAttribute('aria-expanded', String(!initialRefList.classList.contains('collapsed')));
                    }

                    btn.addEventListener('click', () => {
                        const refIdx = btn.dataset.refIdx;
                        const refList = sectionBox.querySelector(`.reference-list[data-ref-idx="${refIdx}"]`);
                        if (refList) {
                            btn.classList.toggle('collapsed');
                            refList.classList.toggle('collapsed');
                            btn.setAttribute('aria-expanded', String(!refList.classList.contains('collapsed')));
                        }
                    });
                });
            });
        }
        
        function init() {
            if (typeof ALL_DICTIONARY_ENTRIES !== 'undefined') {
                const urlContext = getFilterContextFromUrl();
                requestedEntryKey = urlContext.entry;
                if (urlContext.lang) {
                    targetLang = urlContext.lang;
                    setLocalPreference('browserTargetLang', targetLang);
                }
                if (urlContext.content === 'source' || urlContext.content === 'target') {
                    contentViewMode = urlContext.content;
                    setLocalPreference('browserContentView', contentViewMode);
                }
                allEntries = ALL_DICTIONARY_ENTRIES;
                bindContentViewControls();
                buildKeyTitleLookup();
                buildBibleReferenceIndex();
                initFilters();
                applyFilters();
                openRequestedEntryIfPresent();
            } else {
                document.getElementById('entryList').innerHTML = '<div style="padding:20px; color:red">Error: entries.js not found or failed to load. Please ensure it is in the same folder.</div>';
            }
        }

        function renderList(entries) {
            visibleEntries = entries;
            const listEl = document.getElementById('entryList');
            listEl.innerHTML = entries.map((entry, idx) => `
                ${(() => {
                    const translationStatus = contentViewMode === 'target' ? getEntryTranslationStatus(entry, targetLang) : '';
                    const translationMeta = translationStatus ? getTranslationStatusMeta(translationStatus, targetLang) : null;
                    const hierarchy = getHierarchyLabels(entry);
                    const subTag = hierarchy.subcategoryLabel
                        ? `<span class="meta-tag sub"><strong>Sub:</strong>${hierarchy.subcategoryLabel}</span>`
                        : '';
                    return `
                <div class="entry-item" data-cat="${(entry.category || '').toLowerCase()}" onclick="viewEntry(${idx}, this)">
                    <span class="title">${entry.title}${translationMeta ? `<span class="translation-status-pill ${translationMeta.pillClass}">${translationMeta.pillText}</span>` : ''}</span>
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
                            <a class="entry-edit-link" href="${buildTranslatorEntryUrl(entry)}" onclick="event.stopPropagation()">Edit</a>
                        </div>
                    </div>
                </div>
                    `;
                })()}
            `).join('');
        }

        function viewEntry(idx, el) {
            document.querySelectorAll('.entry-item').forEach(item => item.classList.remove('active'));
            el.classList.add('active');

            const entry = visibleEntries[idx];
            currentViewedEntry = entry;
            renderCurrentEntryView();
            updateBrowserUrlFromEntry(entry);
            document.querySelector('.main-content').scrollTop = 0;
        }

        document.getElementById('search').addEventListener('input', (e) => {
            activeFilters.searchTerm = e.target.value.toLowerCase();
            applyFilters();
        });

        // Initialize when page loads
        window.onload = () => {
            initBibleViewer();
            init();
        };

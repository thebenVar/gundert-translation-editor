(function () {
    const PROTECTED_SECTION_LABELS = new Set(['reference', 'references']);
    const TARGET_ONLY_TYPES = [
        'target-subheading',
        'target-paragraph',
        'translator-note'
    ];
    const MNEMONIC_REFERENCE_PATTERN = /\b(?:[A-Z])?\d{14}\b/g;
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
    const PROFILE_PROMPTS = {
        'malayalam-common': [
            'You are a Bible dictionary adaptation assistant.',
            'Task: translate and adapt source dictionary content into Malayalam for everyday Malayalam Christians with minimal English and only basic Bible-language familiarity.',
            'Use simple, conversational Malayalam and reader-focused explanations.',
            'Rephrase translator-oriented notes for ordinary readers.',
            'When describing how a term is translated, explain it as "this is how Bible translations translated the term" — for example: "Bear is translated as brown bear in Middle Eastern translations, while Latin American translations usually use <local term>".',
            'Strictly preserve biblical accuracy and core theological meaning.',
            'Preserve all references, placeholders, XML/HTML tags, and protected tokens exactly as given.',
            'Avoid scholarly jargon where possible; explain technical terms plainly when needed.',
            'Return only the adapted translation output content, with no extra commentary.'
        ].join(' '),
        default: 'You are a Bible dictionary translation assistant. Translate prose only and preserve references, tags, and placeholders exactly.',
        literal: 'Translate with high literal fidelity. Keep sentence structure close to source while preserving protected tokens.',
        natural: 'Translate for natural readability while preserving all protected tokens and references exactly.'
    };

    const RUNTIME_CONFIG = (typeof window !== 'undefined' && window.TRANSLATOR_RUNTIME_CONFIG)
        ? window.TRANSLATOR_RUNTIME_CONFIG
        : { providers: {} };

    const PROVIDER_DEFAULTS = {
        demo: {
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4.1-mini',
            models: ['gpt-4.1-mini']
        },
        'openai-compatible': {
            baseUrl: (RUNTIME_CONFIG.providers && RUNTIME_CONFIG.providers['openai-compatible'] && RUNTIME_CONFIG.providers['openai-compatible'].baseUrl)
                || 'https://api.openai.com/v1',
            model: (RUNTIME_CONFIG.providers && RUNTIME_CONFIG.providers['openai-compatible'] && RUNTIME_CONFIG.providers['openai-compatible'].models && RUNTIME_CONFIG.providers['openai-compatible'].models[0])
                || 'o3',
            models: (RUNTIME_CONFIG.providers && RUNTIME_CONFIG.providers['openai-compatible'] && RUNTIME_CONFIG.providers['openai-compatible'].models)
                || ['o3', 'o4-mini', 'gpt-4.1-mini']
        },
        gemini: {
            baseUrl: (RUNTIME_CONFIG.providers && RUNTIME_CONFIG.providers.gemini && RUNTIME_CONFIG.providers.gemini.baseUrl)
                || 'https://generativelanguage.googleapis.com/v1beta/openai',
            model: (RUNTIME_CONFIG.providers && RUNTIME_CONFIG.providers.gemini && RUNTIME_CONFIG.providers.gemini.models && RUNTIME_CONFIG.providers.gemini.models[0])
                || 'gemini-2.5-pro',
            models: (RUNTIME_CONFIG.providers && RUNTIME_CONFIG.providers.gemini && RUNTIME_CONFIG.providers.gemini.models)
                || ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']
        }
    };

    const state = {
        entries: [],
        filteredEntries: [],
        selectedEntry: null,
        selectedIndex: -1,
        targetLang: 'ml',
        drafts: {},
        readyKeys: {},
        previewMode: true,
        mtProvider: 'gemini',
        mtBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        mtModel: 'gemini-2.5-pro',
        mtApiKey: '',
        sidebarOpen: false,
        sidebarPinned: false,
        settingsOpen: false,
        previewEditToken: null
    };

    const el = {
        langSelect: document.getElementById('langSelect'),
        profileSelect: document.getElementById('profileSelect'),
        systemPrompt: document.getElementById('systemPrompt'),
        savePromptBtn: document.getElementById('savePromptBtn'),
        resetPromptBtn: document.getElementById('resetPromptBtn'),
        promptCustomBadge: document.getElementById('promptCustomBadge'),
        mtProviderSelect: document.getElementById('mtProviderSelect'),
        mtBaseUrl: document.getElementById('mtBaseUrl'),
        mtModel: document.getElementById('mtModel'),
        mtApiKey: document.getElementById('mtApiKey'),
        sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
        sidebarPinBtn: document.getElementById('sidebarPinBtn'),
        openSettingsBtn: document.getElementById('openSettingsBtn'),
        closeSettingsBtn: document.getElementById('closeSettingsBtn'),
        settingsPanel: document.getElementById('settingsPanel'),
        settingsBackdrop: document.getElementById('settingsBackdrop'),
        entrySearch: document.getElementById('entrySearch'),
        entryCount: document.getElementById('entryCount'),
        entryList: document.getElementById('entryList'),
        currentEntryMeta: document.getElementById('currentEntryMeta'),
        openInBrowserBtn: document.getElementById('openInBrowserBtn'),
        sourceView: document.getElementById('sourceView'),
        targetView: document.getElementById('targetView'),
        validationOutput: document.getElementById('validationOutput'),
        translateBtn: document.getElementById('translateBtn'),
        previewToggleBtn: document.getElementById('previewToggleBtn'),
        validateBtn: document.getElementById('validateBtn'),
        saveDraftBtn: document.getElementById('saveDraftBtn'),
        markReadyBtn: document.getElementById('markReadyBtn'),
        exportEntryBtn: document.getElementById('exportEntryBtn')
    };

    function draftStorageKey() {
        return `translatorDrafts_${state.targetLang}`;
    }

    function readyStorageKey() {
        return `translatorReady_${state.targetLang}`;
    }

    function uiPrefsStorageKey() {
        return 'translatorUiPrefs';
    }

    function customPromptsStorageKey() {
        return 'translatorCustomPrompts';
    }

    function loadCustomPrompts() {
        try {
            return JSON.parse(localStorage.getItem(customPromptsStorageKey()) || '{}');
        } catch {
            return {};
        }
    }

    function saveCustomPrompt(profileKey, promptText) {
        const all = loadCustomPrompts();
        all[profileKey] = promptText;
        localStorage.setItem(customPromptsStorageKey(), JSON.stringify(all));
    }

    function resetCustomPrompt(profileKey) {
        const all = loadCustomPrompts();
        delete all[profileKey];
        localStorage.setItem(customPromptsStorageKey(), JSON.stringify(all));
    }

    function hasCustomPrompt(profileKey) {
        const all = loadCustomPrompts();
        return Object.prototype.hasOwnProperty.call(all, profileKey);
    }

    function resolvedPromptForProfile(profileKey) {
        const all = loadCustomPrompts();
        return all[profileKey] || PROFILE_PROMPTS[profileKey] || PROFILE_PROMPTS.default;
    }

    function getUrlContext() {
        const params = new URLSearchParams(window.location.search);
        return {
            entryKey: String(params.get('entry') || '').trim(),
            lang: String(params.get('lang') || '').trim()
        };
    }

    function syncEntryUrl() {
        if (!state.selectedEntry) return;
        const params = new URLSearchParams(window.location.search);
        params.set('entry', String(state.selectedEntry.key || ''));
        params.set('lang', String(state.targetLang || 'ml'));
        const query = params.toString();
        const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
        window.history.replaceState({}, '', next);
    }

    function updateBrowserLinkForEntry() {
        if (!el.openInBrowserBtn) return;
        if (!state.selectedEntry) {
            el.openInBrowserBtn.href = 'browser.html';
            return;
        }
        const params = new URLSearchParams();
        params.set('entry', String(state.selectedEntry.key || ''));
        params.set('lang', String(state.targetLang || 'ml'));
        params.set('content', 'target');
        const category = String(state.selectedEntry.category || '').trim().toLowerCase();
        if (category) {
            params.set('category', category);
        }
        el.openInBrowserBtn.href = `browser.html?${params.toString()}`;
    }

    function loadLocalState() {
        try {
            state.drafts = JSON.parse(localStorage.getItem(draftStorageKey()) || '{}');
        } catch {
            state.drafts = {};
        }
        try {
            state.readyKeys = JSON.parse(localStorage.getItem(readyStorageKey()) || '{}');
        } catch {
            state.readyKeys = {};
        }

        try {
            const ui = JSON.parse(localStorage.getItem(uiPrefsStorageKey()) || '{}');
            state.sidebarPinned = Boolean(ui.sidebarPinned);
            state.sidebarOpen = Boolean(ui.sidebarOpen);
        } catch {
            state.sidebarPinned = false;
            state.sidebarOpen = false;
        }
    }

    function persistLocalState() {
        localStorage.setItem(draftStorageKey(), JSON.stringify(state.drafts));
        localStorage.setItem(readyStorageKey(), JSON.stringify(state.readyKeys));
        localStorage.setItem(uiPrefsStorageKey(), JSON.stringify({
            sidebarPinned: state.sidebarPinned,
            sidebarOpen: state.sidebarOpen
        }));
    }

    function applySidebarState() {
        const open = state.sidebarPinned || state.sidebarOpen;
        document.body.classList.toggle('tw-sidebar-open', open && !state.sidebarPinned);
        document.body.classList.toggle('tw-sidebar-pinned', state.sidebarPinned);
        if (el.sidebarPinBtn) {
            el.sidebarPinBtn.textContent = state.sidebarPinned ? 'Unpin' : 'Pin';
        }
    }

    function applySettingsState() {
        document.body.classList.toggle('tw-settings-open', state.settingsOpen);
        if (el.settingsPanel) {
            el.settingsPanel.setAttribute('aria-hidden', state.settingsOpen ? 'false' : 'true');
        }
        if (el.settingsBackdrop) {
            el.settingsBackdrop.setAttribute('aria-hidden', state.settingsOpen ? 'false' : 'true');
        }
    }

    function toggleSidebarOpen() {
        if (state.sidebarPinned) {
            state.sidebarPinned = false;
        }
        state.sidebarOpen = !state.sidebarOpen;
        applySidebarState();
        persistLocalState();
    }

    function toggleSidebarPin() {
        state.sidebarPinned = !state.sidebarPinned;
        if (state.sidebarPinned) {
            state.sidebarOpen = true;
        }
        applySidebarState();
        persistLocalState();
    }

    function openSettings() {
        state.settingsOpen = true;
        applySettingsState();
    }

    function closeSettings() {
        state.settingsOpen = false;
        applySettingsState();
    }

    function profileSystemPrompt(profile) {
        return resolvedPromptForProfile(profile);
    }

    function refreshPromptBadge() {
        const profile = el.profileSelect?.value || 'default';
        const isCustom = hasCustomPrompt(profile);
        if (el.promptCustomBadge) {
            el.promptCustomBadge.style.display = isCustom ? 'inline' : 'none';
        }
    }

    function gatherMtConfigFromUi() {
        state.mtProvider = String(el.mtProviderSelect?.value || 'demo');
        state.mtBaseUrl = String(el.mtBaseUrl?.value || 'https://api.openai.com/v1').trim();
        state.mtModel = String(el.mtModel?.value || 'gpt-4.1-mini').trim();
        state.mtApiKey = String(el.mtApiKey?.value || '');
    }

    function normalizeModelName(raw) {
        const value = String(raw || '').trim();
        return value.startsWith('models/') ? value.slice('models/'.length) : value;
    }

    function rankModelName(name) {
        const n = String(name || '').toLowerCase();
        let score = 0;
        if (n.includes('thinking') || n.includes('reason')) score += 8;
        if (n.includes('o3') || n.includes('o4') || n.includes('pro')) score += 4;
        if (n.includes('flash')) score += 2;
        return score;
    }

    function pickThreeModels(provider, availableModels, preferredModels) {
        const available = Array.from(new Set((availableModels || []).map(normalizeModelName).filter(Boolean)));
        const preferred = Array.from(new Set((preferredModels || []).map(normalizeModelName).filter(Boolean)));
        if (available.length === 0) {
            return preferred.slice(0, 3);
        }

        const selected = [];
        preferred.forEach((m) => {
            if (available.includes(m) && !selected.includes(m)) {
                selected.push(m);
            }
        });

        const byRanking = [...available]
            .filter((m) => !selected.includes(m))
            .sort((a, b) => rankModelName(b) - rankModelName(a));

        byRanking.forEach((m) => {
            if (selected.length < 3) {
                selected.push(m);
            }
        });

        return selected.slice(0, 3);
    }

    async function fetchAvailableModels(provider) {
        if (provider === 'demo') return null;
        gatherMtConfigFromUi();

        const baseUrl = String(state.mtBaseUrl || '').replace(/\/$/, '');
        const apiKey = String(state.mtApiKey || '');
        if (!baseUrl || !apiKey) {
            return null;
        }

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        };
        if (provider === 'gemini') {
            headers['x-goog-api-key'] = apiKey;
        }

        try {
            const response = await fetch(`${baseUrl}/models`, {
                method: 'GET',
                headers
            });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (Array.isArray(data?.data)) {
                return data.data.map((m) => normalizeModelName(m.id || m.name)).filter(Boolean);
            }
            if (Array.isArray(data?.models)) {
                return data.models.map((m) => normalizeModelName(m.id || m.name || m.model)).filter(Boolean);
            }
            return null;
        } catch {
            return null;
        }
    }

    function populateModelPicker(provider, preferredModel, availableModels) {
        if (!el.mtModel) return;
        const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.demo;
        const models = Array.isArray(defaults.models) && defaults.models.length > 0
            ? pickThreeModels(provider, availableModels, defaults.models)
            : ['gpt-4.1-mini'];

        el.mtModel.innerHTML = models.map((model) => `<option value="${model}">${model}</option>`).join('');

        const desired = preferredModel && models.includes(preferredModel)
            ? preferredModel
            : (defaults.model || models[0]);
        el.mtModel.value = desired;
    }

    function getRuntimeProviderKey(provider) {
        if (!RUNTIME_CONFIG.providers || !RUNTIME_CONFIG.providers[provider]) return '';
        return String(RUNTIME_CONFIG.providers[provider].apiKey || '');
    }

    function refreshProviderPicker() {
        if (!el.mtProviderSelect) return;

        const hasOpenAiKey = Boolean(getRuntimeProviderKey('openai-compatible'));
        const hasGeminiKey = Boolean(getRuntimeProviderKey('gemini'));

        const options = [
            { value: 'demo', label: 'Demo (local, no API)', enabled: true },
            { value: 'openai-compatible', label: 'OpenAI-compatible API', enabled: hasOpenAiKey },
            { value: 'gemini', label: 'Gemini', enabled: hasGeminiKey }
        ].filter((o) => o.enabled);

        el.mtProviderSelect.innerHTML = options
            .map((o) => `<option value="${o.value}">${o.label}</option>`)
            .join('');

        if (!options.find((o) => o.value === state.mtProvider)) {
            state.mtProvider = options[0] ? options[0].value : 'demo';
        }
        el.mtProviderSelect.value = state.mtProvider;
    }

    function applyProviderDefaults(provider, forceOverride, availableModels) {
        const nextProvider = String(provider || 'demo');
        const defaults = PROVIDER_DEFAULTS[nextProvider];
        if (!defaults) return;

        if (el.mtBaseUrl && (forceOverride || !String(el.mtBaseUrl.value || '').trim())) {
            el.mtBaseUrl.value = defaults.baseUrl;
        }
        if (el.mtModel && (forceOverride || !String(el.mtModel.value || '').trim())) {
            populateModelPicker(nextProvider, defaults.model, availableModels);
        } else {
            populateModelPicker(nextProvider, String(el.mtModel?.value || defaults.model), availableModels);
        }

        const runtimeKey = getRuntimeProviderKey(nextProvider);
        if (el.mtApiKey && runtimeKey && (forceOverride || !String(el.mtApiKey.value || '').trim())) {
            el.mtApiKey.value = runtimeKey;
        }
    }

    function escapeAttr(raw) {
        return String(raw || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .trim();
    }

    function normalizeEntryHtmlForParsing(entryHtml) {
        return String(entryHtml || '').replace(
            /<div class="image-(?:placeholder|box)">\s*Image:\s*([^<]+)\s*<\/div>/gi,
            (_, imageKey) => `<span class="tw-image-marker" data-image-key="${escapeAttr(imageKey)}"></span>`
        );
    }

    function parseSections(entryHtml) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = normalizeEntryHtmlForParsing(entryHtml);
        const sectionEls = [...wrapper.querySelectorAll('.section-box')];

        return sectionEls.map((box, idx) => {
            const label = (box.querySelector('.section-label')?.textContent || 'other').trim().toLowerCase();
            const heading = (box.querySelector('h4')?.innerHTML || '').trim();
            
            // Extract paragraphs from <p> tags
            const paragraphs = [...box.querySelectorAll('p')]
                .map((p) => {
                    const clone = p.cloneNode(true);
                    clone.querySelectorAll('.tw-image-marker').forEach((marker) => marker.remove());
                    return clone.innerHTML.trim();
                })
                .filter((p) => p.length > 0);
            
            // For sections without <p> tags (like references), extract text content
            if (paragraphs.length === 0) {
                const clone = box.cloneNode(true);
                // Remove section-label, h4, and image markers
                clone.querySelectorAll('.section-label').forEach((el) => el.remove());
                clone.querySelectorAll('h4').forEach((el) => el.remove());
                clone.querySelectorAll('.tw-image-marker').forEach((el) => el.remove());
                // Get remaining text content, split by whitespace and filter
                const textContent = clone.textContent.trim();
                if (textContent) {
                    paragraphs.push(textContent);
                }
            }
            
            const imageKeys = [...box.querySelectorAll('.tw-image-marker[data-image-key]')]
                .map((marker) => String(marker.getAttribute('data-image-key') || '').trim())
                .filter((key) => key.length > 0);
            return {
                id: idx,
                label,
                heading,
                paragraphs,
                imageKeys,
                locked: PROTECTED_SECTION_LABELS.has(label)
            };
        });
    }

    function normalizeImageBaseName(name) {
        const trimmed = (name || '').trim();
        return trimmed.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
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
            return imageBasePaths.map((basePath) => `${basePath}/${baseName}`);
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

    function tryLoadSourceImage(imgEl, candidates, attempt = 0) {
        if (attempt >= candidates.length) {
            const missing = document.createElement('div');
            missing.className = 'tw-source-image-missing';
            missing.textContent = `Image not found: ${imgEl.dataset.imageBase || ''}`;
            const parent = imgEl.parentElement;
            imgEl.remove();
            if (parent) {
                parent.appendChild(missing);
            }
            return;
        }
        const candidate = candidates[attempt];
        const probe = new Image();
        probe.onload = () => {
            imgEl.src = candidate;
        };
        probe.onerror = () => {
            tryLoadSourceImage(imgEl, candidates, attempt + 1);
        };
        probe.src = candidate;
    }

    function hydrateSourceImages() {
        const images = el.sourceView.querySelectorAll('img.resolved-source-image');
        images.forEach((imgEl) => {
            const baseName = String(imgEl.dataset.imageBase || '').trim();
            if (!baseName) return;
            tryLoadSourceImage(imgEl, resolveImageCandidates(baseName));
        });
    }

    function renderSourceImages(imageKeys) {
        const keys = Array.isArray(imageKeys) ? imageKeys : [];
        if (keys.length === 0) {
            return '';
        }
        return `
            <div class="tw-source-thumbs">
                ${keys.map((key) => {
                    const safe = normalizeImageBaseName(key);
                    return `<img class="resolved-source-image tw-source-thumb" data-image-base="${escapeHtml(safe)}" alt="${escapeHtml(key)}" title="${escapeHtml(key)}">`;
                }).join('')}
            </div>
        `;
    }

    function selectEntry(index) {
        state.selectedIndex = index;
        state.selectedEntry = state.filteredEntries[index] || null;
        state.previewEditToken = null;
        renderEntryList();
        renderSelectedEntry();
        renderValidationMessage('Run validation to see results.');
        updateBrowserLinkForEntry();
        syncEntryUrl();
        if (!state.sidebarPinned) {
            state.sidebarOpen = false;
            applySidebarState();
        }
    }

    function renderEntryList() {
        const selectedKey = state.selectedEntry ? state.selectedEntry.key : null;
        el.entryList.innerHTML = state.filteredEntries.map((entry, idx) => {
            const active = entry.key === selectedKey ? 'active' : '';
            const readyTag = state.readyKeys[entry.key] ? ' READY' : '';
            return `
                <button class="tw-entry-item ${active}" data-index="${idx}" type="button">
                    <span class="k">${entry.key}</span>
                    <span class="t">${entry.title}${readyTag}</span>
                </button>
            `;
        }).join('');

        el.entryCount.textContent = `${state.filteredEntries.length} entries`;

        [...el.entryList.querySelectorAll('.tw-entry-item')].forEach((btn) => {
            btn.addEventListener('click', () => selectEntry(Number(btn.dataset.index)));
        });
    }

    function getCurrentDraftKey() {
        if (!state.selectedEntry) return null;
        return `${state.targetLang}:${state.selectedEntry.key}`;
    }

    function getCurrentDraft() {
        const key = getCurrentDraftKey();
        if (!key) return null;
        const draft = state.drafts[key] || null;
        if (!draft) return null;
        const fixed = ensureDraftShape(draft, state.selectedEntry);
        state.drafts[key] = fixed;
        return fixed;
    }

    function setCurrentDraft(draft) {
        const key = getCurrentDraftKey();
        if (!key) return;
        state.drafts[key] = ensureDraftShape(draft, state.selectedEntry);
    }

    function buildDraftFromSource(entry) {
        const sourceSections = parseSections(entry.content);
        return {
            schemaVersion: '1.0',
            entryKey: entry.key,
            key: entry.key,
            title: entry.title,
            sections: sourceSections.map((s) => ({
                id: s.id,
                label: s.label,
                locked: s.locked,
                heading: s.heading,
                paragraphs: [...s.paragraphs]
            })),
            targetOnlyBlocks: [],
            operations: [],
            nextBlockId: 1,
            updatedAt: new Date().toISOString()
        };
    }

    function ensureDraftShape(draft, entry) {
        const safe = draft && typeof draft === 'object' ? draft : {};
        let sections = Array.isArray(safe.sections) ? safe.sections : [];

        if ((!sections || sections.length === 0) && entry) {
            sections = parseSections(entry.content).map((s) => ({
                id: s.id,
                label: s.label,
                locked: s.locked,
                heading: s.heading,
                paragraphs: [...s.paragraphs]
            }));
        }

        const targetOnlyBlocks = Array.isArray(safe.targetOnlyBlocks) ? safe.targetOnlyBlocks : [];
        const maxExistingId = targetOnlyBlocks.reduce((max, b) => {
            const match = String(b && b.id ? b.id : '').match(/^tb-(\d+)$/);
            if (!match) return max;
            const numeric = Number(match[1]);
            return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
        }, 0);

        return {
            schemaVersion: safe.schemaVersion || '1.0',
            entryKey: safe.entryKey || safe.key || (entry ? entry.key : 'unknown'),
            key: safe.key || (entry ? entry.key : 'unknown'),
            title: typeof safe.title === 'string' ? safe.title : (entry ? entry.title : ''),
            sections,
            targetOnlyBlocks,
            operations: Array.isArray(safe.operations) ? safe.operations : [],
            nextBlockId: Number.isFinite(Number(safe.nextBlockId)) ? Number(safe.nextBlockId) : (maxExistingId + 1),
            updatedAt: safe.updatedAt || new Date().toISOString()
        };
    }

    function makeOperation(kind, details) {
        return {
            opId: `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            kind,
            timestamp: new Date().toISOString(),
            details: details || {}
        };
    }

    function allocateTargetOnlyId(draft) {
        const next = Number(draft.nextBlockId || 1);
        draft.nextBlockId = next + 1;
        return `tb-${String(next).padStart(4, '0')}`;
    }

    function getTargetOnlyTypeLabel(type) {
        if (type === 'target-subheading') return 'Target Subheading';
        if (type === 'translator-note') return 'Translator Note';
        return 'Target Paragraph';
    }

    function renderTypeOptions(selectedType) {
        return TARGET_ONLY_TYPES.map((type) => {
            const selected = type === selectedType ? 'selected' : '';
            return `<option value="${type}" ${selected}>${getTargetOnlyTypeLabel(type)}</option>`;
        }).join('');
    }

    function renderSelectedEntry() {
        const entry = state.selectedEntry;
        if (!entry) {
            el.currentEntryMeta.textContent = 'No entry selected';
            el.sourceView.innerHTML = '<p>Select an entry to start translating.</p>';
            el.targetView.innerHTML = '<p>Select an entry to start translating.</p>';
            return;
        }

        const ready = state.readyKeys[entry.key] ? ' | Status: Ready' : '';
        el.currentEntryMeta.textContent = `${entry.category} | Key ${entry.key} | ${entry.title}${ready}`;

        const sourceSections = parseSections(entry.content);

        el.sourceView.innerHTML = sourceSections.map((s) => {
            const isRefSection = s.label === 'reference' || s.label === 'references';
            const bodyHtml = isRefSection
                ? (renderReferenceGroupsHtml(s.paragraphs) || s.paragraphs.map((p) => `<p>${formatMnemonicReferencesForDisplay(p)}</p>`).join(''))
                : s.paragraphs.map((p) => `<p>${formatMnemonicReferencesForDisplay(p)}</p>`).join('');
            return `
            <section class="tw-source-section${isRefSection ? ' tw-refs-section' : ''}" data-section-id="${s.id}">
                <div class="tw-section-head">
                    <span class="tw-lock">${s.label}</span>
                    <button class="tw-jump-btn" type="button" data-jump-to="target" data-section-id="${s.id}">Jump To Target</button>
                </div>
                <h4>${s.heading || '(no heading)'}</h4>
                ${renderSourceImages(s.imageKeys)}
                ${bodyHtml}
            </section>
        `;
        }).join('');
        hydrateSourceImages();

        const draft = getCurrentDraft() || buildDraftFromSource(entry);
        setCurrentDraft(draft);
        const activeEditToken = String(state.previewEditToken || '');

        const targetOnlyBySection = new Map();
        draft.targetOnlyBlocks.forEach((block) => {
            const sid = Number(block.sectionId);
            if (!targetOnlyBySection.has(sid)) {
                targetOnlyBySection.set(sid, []);
            }
            targetOnlyBySection.get(sid).push(block);
        });

        el.targetView.innerHTML = `
            <section class="tw-target-section tw-target-section-source">
                <div class="tw-section-head">
                    <span class="tw-kind-chip">source-mapped</span>
                    <span class="tw-lock">title</span>
                    ${state.previewMode ? '<button class="tw-mini-btn tw-preview-edit-btn" type="button" data-preview-edit="title">Edit</button>' : ''}
                </div>
                ${state.previewMode
                    ? (activeEditToken === 'title'
                        ? `<input id="previewTitleEditor" class="tw-preview-inline-input" type="text" value="${escapeHtml(draft.title)}">
                           <div class="tw-preview-inline-actions"><button class="tw-mini-btn" type="button" data-preview-done="title">Done</button></div>`
                        : `<h3>${escapeHtml(draft.title)}</h3>`)
                    : `<label>Target Title</label><input id="targetTitle" class="tw-target-input" type="text" value="${escapeHtml(draft.title)}">`
                }
            </section>
            ${draft.sections.map((s) => {
                const isRefSection = s.label === 'reference' || s.label === 'references';
                const refChips = isRefSection
                    ? (renderReferenceGroupsHtml(s.paragraphs) || null)
                    : null;
                const paragraphsHtml = refChips
                    ? refChips
                    : s.paragraphs.map((p, i) => state.previewMode
                        ? (() => {
                            const token = `section:${s.id}:para:${i}`;
                            if (activeEditToken === token && !s.locked) {
                                return `<textarea class="tw-preview-inline-input" data-preview-section-id="${s.id}" data-preview-para-index="${i}" rows="4">${escapeHtml(p)}</textarea>
                                        <div class="tw-preview-inline-actions"><button class="tw-mini-btn" type="button" data-preview-done="${token}">Done</button></div>`;
                            }
                            return `<div class="tw-preview-inline-row"><p>${escapeHtml(formatMnemonicReferencesForDisplay(p))}</p>${s.locked ? '' : `<button class="tw-mini-btn tw-preview-edit-btn" type="button" data-preview-edit="${token}">Edit</button>`}</div>`;
                        })()
                        : `<textarea class="tw-target-paragraph" data-section-id="${s.id}" data-para-index="${i}" rows="4" ${s.locked ? 'disabled' : ''}>${escapeHtml(p)}</textarea>
                           ${s.locked ? '' : `<div class="tw-source-para-actions">
                               <button class="tw-mini-btn" type="button" data-insert-para-after="${s.id}:${i}">Insert Below</button>
                               <button class="tw-mini-btn tw-mini-btn-danger" type="button" data-delete-para="${s.id}:${i}">Delete</button>
                           </div>`}`
                    ).join('');
                return `
                <section class="tw-target-section tw-target-section-source${isRefSection ? ' tw-refs-section' : ''}" data-section-id="${s.id}">
                    <div class="tw-section-head">
                        <span class="tw-kind-chip">source-mapped</span>
                        <span class="tw-lock">${s.label}${s.locked ? ' (locked)' : ''}</span>
                        <button class="tw-jump-btn" type="button" data-jump-to="source" data-section-id="${s.id}">Jump To Source</button>
                    </div>
                    <h4>${s.heading || '(no heading)'}</h4>
                    ${state.previewMode || s.locked ? '' : `
                        <div class="tw-source-block-controls">
                            <button class="tw-mini-btn" type="button" data-add-para="${s.id}">Add Paragraph</button>
                        </div>
                    `}
                    ${paragraphsHtml}

                    ${(targetOnlyBySection.get(s.id) || []).map((b) => `
                        <section class="tw-target-section tw-target-section-added" data-target-only-id="${escapeHtml(b.id)}">
                            <div class="tw-section-head">
                                <span class="tw-kind-chip tw-kind-chip-added">target-only</span>
                                ${state.previewMode
                                    ? `<span class="tw-lock">${escapeHtml(getTargetOnlyTypeLabel(b.type))}</span>`
                                    : `<select class="tw-target-only-type" data-target-only-type-id="${escapeHtml(b.id)}">${renderTypeOptions(b.type)}</select>`
                                }
                            </div>
                            <h4>${escapeHtml(getTargetOnlyTypeLabel(b.type))}</h4>
                            ${state.previewMode
                                ? (activeEditToken === `targetonly:${escapeHtml(b.id)}`
                                    ? `<textarea class="tw-preview-inline-input" data-preview-target-only-id="${escapeHtml(b.id)}" rows="4">${escapeHtml(b.text || '')}</textarea>
                                       <div class="tw-preview-inline-actions"><button class="tw-mini-btn" type="button" data-preview-done="targetonly:${escapeHtml(b.id)}">Done</button></div>`
                                    : `<div class="tw-preview-inline-row"><p>${escapeHtml(formatMnemonicReferencesForDisplay(b.text || ''))}</p><button class="tw-mini-btn tw-preview-edit-btn" type="button" data-preview-edit="targetonly:${escapeHtml(b.id)}">Edit</button></div>`)
                                : `<textarea class="tw-target-paragraph tw-target-only-text" data-target-only-id="${escapeHtml(b.id)}" rows="4">${escapeHtml(b.text || '')}</textarea>
                                   <div class="tw-block-actions">
                                       <button class="tw-mini-btn tw-mini-btn-danger" type="button" data-delete-target-only="${escapeHtml(b.id)}">Remove Block</button>
                                   </div>`
                            }
                        </section>
                    `).join('')}

                    ${state.previewMode ? '' : `
                        <div class="tw-add-block-controls" data-add-host-section="${s.id}">
                            <label>Block Type</label>
                            <select data-add-type="${s.id}">
                                ${TARGET_ONLY_TYPES.map((type) => `<option value="${type}">${getTargetOnlyTypeLabel(type)}</option>`).join('')}
                            </select>
                            <label>Block Text</label>
                            <textarea data-add-text="${s.id}" rows="3" placeholder="Write ${s.label} adaptation text..."></textarea>
                            <div class="tw-block-actions">
                                <button class="tw-mini-btn" type="button" data-add-target-only="${s.id}">Insert Block</button>
                            </div>
                        </div>
                    `}
                </section>
            `; }).join('')}
        `;

        const titleEl = document.getElementById('targetTitle');
        if (titleEl) {
            titleEl.addEventListener('input', () => {
                const d = getCurrentDraft();
                if (!d) return;
                d.title = titleEl.value;
                d.operations.push(makeOperation('edit-content', { field: 'title' }));
                d.updatedAt = new Date().toISOString();
            });
        }

        [...el.targetView.querySelectorAll('.tw-target-paragraph')].forEach((area) => {
            area.addEventListener('input', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const sid = Number(area.dataset.sectionId);
                const pidx = Number(area.dataset.paraIndex);
                const section = d.sections.find((s) => s.id === sid);
                if (!section || section.locked) return;
                section.paragraphs[pidx] = area.value;
                d.operations.push(makeOperation('edit-content', {
                    sectionId: sid,
                    paragraphIndex: pidx
                }));
                d.updatedAt = new Date().toISOString();
            });
        });

        [...el.targetView.querySelectorAll('.tw-target-only-text')].forEach((area) => {
            area.addEventListener('input', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const id = String(area.dataset.targetOnlyId || '');
                const block = d.targetOnlyBlocks.find((b) => String(b.id) === id);
                if (!block) return;
                block.text = area.value;
                d.operations.push(makeOperation('edit-content', {
                    targetOnlyId: id
                }));
                d.updatedAt = new Date().toISOString();
            });
        });

        [...el.targetView.querySelectorAll('.tw-target-only-type')].forEach((sel) => {
            sel.addEventListener('change', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const id = String(sel.dataset.targetOnlyTypeId || '');
                const block = d.targetOnlyBlocks.find((b) => String(b.id) === id);
                if (!block) return;
                const nextType = String(sel.value || 'target-paragraph');
                if (!TARGET_ONLY_TYPES.includes(nextType)) {
                    renderValidationMessages([{ type: 'error', text: `Unsupported target-only block type: ${nextType}` }]);
                    sel.value = block.type;
                    return;
                }
                block.type = nextType;
                d.operations.push(makeOperation('edit-content', {
                    targetOnlyId: id,
                    field: 'type'
                }));
                d.updatedAt = new Date().toISOString();
                renderSelectedEntry();
            });
        });

        [...el.targetView.querySelectorAll('[data-add-target-only]')].forEach((btn) => {
            btn.addEventListener('click', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const sectionId = Number(btn.dataset.addTargetOnly);
                const typeSel = el.targetView.querySelector(`select[data-add-type="${sectionId}"]`);
                const textArea = el.targetView.querySelector(`textarea[data-add-text="${sectionId}"]`);
                const type = String(typeSel?.value || 'target-paragraph');
                const text = String(textArea?.value || '');
                if (!TARGET_ONLY_TYPES.includes(type)) {
                    renderValidationMessages([{ type: 'error', text: `Unsupported target-only block type: ${type}` }]);
                    return;
                }

                const blockId = allocateTargetOnlyId(d);
                d.targetOnlyBlocks.push({
                    id: blockId,
                    sectionId,
                    type,
                    text,
                    rationale: '',
                    createdAt: new Date().toISOString()
                });
                d.operations.push(makeOperation('insert-target-only', {
                    blockId,
                    sectionId,
                    type
                }));
                d.updatedAt = new Date().toISOString();
                renderValidationMessages([{ type: 'ok', text: `Added ${getTargetOnlyTypeLabel(type)} block.` }]);
                renderSelectedEntry();
            });
        });

        [...el.targetView.querySelectorAll('[data-delete-target-only]')].forEach((btn) => {
            btn.addEventListener('click', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const id = String(btn.dataset.deleteTargetOnly || '');
                const idx = d.targetOnlyBlocks.findIndex((b) => String(b.id) === id);
                if (idx < 0) return;
                const removed = d.targetOnlyBlocks[idx];
                d.targetOnlyBlocks.splice(idx, 1);
                d.operations.push(makeOperation('delete-target-only', {
                    blockId: id,
                    sectionId: removed.sectionId,
                    type: removed.type
                }));
                d.updatedAt = new Date().toISOString();
                renderSelectedEntry();
            });
        });

        [...el.targetView.querySelectorAll('[data-add-para]')].forEach((btn) => {
            btn.addEventListener('click', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const sectionId = Number(btn.dataset.addPara);
                const section = d.sections.find((x) => x.id === sectionId);
                if (!section || section.locked) return;
                section.paragraphs.push('');
                d.operations.push(makeOperation('insert-block', {
                    sectionId,
                    paragraphIndex: section.paragraphs.length - 1
                }));
                d.updatedAt = new Date().toISOString();
                renderSelectedEntry();
            });
        });

        [...el.targetView.querySelectorAll('[data-insert-para-after]')].forEach((btn) => {
            btn.addEventListener('click', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const [sidRaw, idxRaw] = String(btn.dataset.insertParaAfter || '').split(':');
                const sectionId = Number(sidRaw);
                const paragraphIndex = Number(idxRaw);
                const section = d.sections.find((x) => x.id === sectionId);
                if (!section || section.locked) return;
                section.paragraphs.splice(paragraphIndex + 1, 0, '');
                d.operations.push(makeOperation('split-block', {
                    sectionId,
                    paragraphIndex
                }));
                d.updatedAt = new Date().toISOString();
                renderSelectedEntry();
            });
        });

        [...el.targetView.querySelectorAll('[data-delete-para]')].forEach((btn) => {
            btn.addEventListener('click', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const [sidRaw, idxRaw] = String(btn.dataset.deletePara || '').split(':');
                const sectionId = Number(sidRaw);
                const paragraphIndex = Number(idxRaw);
                const section = d.sections.find((x) => x.id === sectionId);
                if (!section || section.locked) return;
                if (section.paragraphs.length <= 1) {
                    renderValidationMessages([{ type: 'warn', text: 'Section must keep at least one paragraph.' }]);
                    return;
                }
                section.paragraphs.splice(paragraphIndex, 1);
                d.operations.push(makeOperation('delete-block', {
                    sectionId,
                    paragraphIndex
                }));
                d.updatedAt = new Date().toISOString();
                renderSelectedEntry();
            });
        });

        const previewTitleEditor = document.getElementById('previewTitleEditor');
        if (previewTitleEditor) {
            previewTitleEditor.addEventListener('input', () => {
                const d = getCurrentDraft();
                if (!d) return;
                d.title = previewTitleEditor.value;
                d.operations.push(makeOperation('edit-content', { field: 'title', via: 'preview-inline' }));
                d.updatedAt = new Date().toISOString();
            });
            previewTitleEditor.focus();
        }

        [...el.targetView.querySelectorAll('[data-preview-section-id]')].forEach((area) => {
            area.addEventListener('input', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const sid = Number(area.dataset.previewSectionId);
                const pidx = Number(area.dataset.previewParaIndex);
                const section = d.sections.find((s) => s.id === sid);
                if (!section || section.locked) return;
                section.paragraphs[pidx] = area.value;
                d.operations.push(makeOperation('edit-content', {
                    sectionId: sid,
                    paragraphIndex: pidx,
                    via: 'preview-inline'
                }));
                d.updatedAt = new Date().toISOString();
            });
            area.focus();
        });

        [...el.targetView.querySelectorAll('[data-preview-target-only-id]')].forEach((area) => {
            area.addEventListener('input', () => {
                const d = getCurrentDraft();
                if (!d) return;
                const id = String(area.dataset.previewTargetOnlyId || '');
                const block = d.targetOnlyBlocks.find((b) => String(b.id) === id);
                if (!block) return;
                block.text = area.value;
                d.operations.push(makeOperation('edit-content', {
                    targetOnlyId: id,
                    via: 'preview-inline'
                }));
                d.updatedAt = new Date().toISOString();
            });
            area.focus();
        });

        [...el.targetView.querySelectorAll('[data-preview-edit]')].forEach((btn) => {
            btn.addEventListener('click', () => {
                state.previewEditToken = String(btn.dataset.previewEdit || '');
                renderSelectedEntry();
            });
        });

        [...el.targetView.querySelectorAll('[data-preview-done]')].forEach((btn) => {
            btn.addEventListener('click', () => {
                state.previewEditToken = null;
                renderSelectedEntry();
            });
        });

        bindReferenceToggles(el.sourceView);
        bindReferenceToggles(el.targetView);
        bindSectionJumpLinks();
    }

    function bindReferenceToggles(container) {
        container.querySelectorAll('.reference-toggle-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const refIdx = btn.dataset.refIdx;
                const refList = btn.closest('.reference-group')?.querySelector(`.reference-list[data-ref-idx="${refIdx}"]`);
                if (refList) {
                    btn.classList.toggle('collapsed');
                    refList.classList.toggle('collapsed');
                    btn.setAttribute('aria-expanded', String(!refList.classList.contains('collapsed')));
                }
            });
        });
    }

    function bindSectionJumpLinks() {
        const jumpButtons = [
            ...el.sourceView.querySelectorAll('.tw-jump-btn'),
            ...el.targetView.querySelectorAll('.tw-jump-btn')
        ];

        jumpButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const sectionId = Number(btn.dataset.sectionId);
                const jumpTo = btn.dataset.jumpTo;
                const selector = jumpTo === 'target'
                    ? `.tw-target-section[data-section-id="${sectionId}"]`
                    : `.tw-source-section[data-section-id="${sectionId}"]`;
                const host = jumpTo === 'target' ? el.targetView : el.sourceView;
                const targetSection = host.querySelector(selector);
                if (!targetSection) {
                    return;
                }
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                targetSection.classList.add('tw-section-focus');
                setTimeout(() => targetSection.classList.remove('tw-section-focus'), 1100);
            });
        });
    }

    function escapeHtml(raw) {
        return String(raw || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatMnemonicReference(token) {
        const raw = String(token || '').trim();
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

    function formatMnemonicReferencesForDisplay(text) {
        return String(text || '').replace(MNEMONIC_REFERENCE_PATTERN, (token) => formatMnemonicReference(token));
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

    /**
     * Renders the chip-based reference groups layout for a reference section.
     * Returns HTML string or null if no references are found.
     */
    function renderReferenceGroupsHtml(paragraphs) {
        const allText = paragraphs.join('\n');
        const lines = allText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => formatMnemonicReferencesForDisplay(l));

        const groups = parseReferenceGroups(lines);
        if (!groups.some((g) => g.refs.length > 0)) return null;

        const renderedGroups = groups.map((group, idx) => {
            if (group.refs.length === 0) {
                const noteText = group.rendering
                    ? `${group.sense} ${group.rendering}`.trim()
                    : group.sense;
                return `<div class="reference-note">${escapeHtml(noteText)}</div>`;
            }
            const startsCollapsed = idx !== 0;
            const refsHtml = group.refs
                .map((ref) => `<span class="reference-chip">${escapeHtml(ref)}</span>`)
                .join('');
            return `
                <article class="reference-group">
                    <div class="reference-group-header">
                        <div class="reference-group-title">
                            ${group.sense ? `<div class="reference-sense">${escapeHtml(group.sense)}</div>` : ''}
                            ${group.rendering ? `<div class="reference-rendering">${escapeHtml(group.rendering)}</div>` : ''}
                        </div>
                        <button class="reference-toggle-btn${startsCollapsed ? ' collapsed' : ''}" type="button" data-ref-idx="${idx}" aria-expanded="${startsCollapsed ? 'false' : 'true'}">▼</button>
                    </div>
                    <div class="reference-list${startsCollapsed ? ' collapsed' : ''}" data-ref-idx="${idx}">${refsHtml}</div>
                </article>`;
        }).join('');

        return `<div class="reference-groups">${renderedGroups}</div>`;
    }

    function runValidation() {
        const entry = state.selectedEntry;
        const draft = getCurrentDraft();
        if (!entry || !draft) return;

        const messages = [];
        const src = entry.content || '';

        const refTokens = src.match(/\b\d{14}\b/g) || [];
        const usfmTokens = src.match(/\b[1-4]?[A-Z]{2,3}\s+\d+:\d+(?:-\d+)?\b/g) || [];

        const mergedTarget = [draft.title]
            .concat(draft.sections.flatMap((s) => s.paragraphs))
            .concat((draft.targetOnlyBlocks || []).map((b) => b.text || ''))
            .join('\n');

        const missingRefs = refTokens.filter((t) => !mergedTarget.includes(t));
        const missingUsfm = usfmTokens.filter((t) => !mergedTarget.includes(t));

        if (missingRefs.length > 0) {
            messages.push({ type: 'error', text: `Missing 14-digit references: ${missingRefs.slice(0, 8).join(', ')}` });
        }
        if (missingUsfm.length > 0) {
            messages.push({ type: 'warn', text: `Missing formatted references: ${missingUsfm.slice(0, 8).join(', ')}` });
        }

        const srcEditableSections = parseSections(entry.content).filter((s) => !s.locked).length;
        const tgtEditableSections = draft.sections.filter((s) => !s.locked).length;
        if (srcEditableSections !== tgtEditableSections) {
            messages.push({ type: 'error', text: 'Editable section count mismatch in draft.' });
        }

        const invalidTargetOnly = (draft.targetOnlyBlocks || []).filter((b) => !TARGET_ONLY_TYPES.includes(String(b.type || '')));
        if (invalidTargetOnly.length > 0) {
            messages.push({ type: 'error', text: `${invalidTargetOnly.length} target-only blocks use unsupported block types.` });
        }

        const untouchedSections = draft.sections
            .filter((s) => !s.locked)
            .filter((s) => {
                const sourceSection = parseSections(entry.content).find((x) => x.id === s.id);
                if (!sourceSection) return false;
                return JSON.stringify(sourceSection.paragraphs) === JSON.stringify(s.paragraphs);
            }).length;

        if (untouchedSections > 0) {
            messages.push({ type: 'warn', text: `${untouchedSections} editable sections are unchanged from source.` });
        }

        if (messages.length === 0) {
            messages.push({ type: 'ok', text: 'Validation passed for current draft checks.' });
        }

        renderValidationMessages(messages);
    }

    function renderValidationMessage(text) {
        el.validationOutput.innerHTML = `<div class="tw-msg-ok">${escapeHtml(text)}</div>`;
    }

    function renderValidationMessages(items) {
        el.validationOutput.innerHTML = items.map((m) => `
            <div class="tw-msg-${m.type}">${escapeHtml(m.text)}</div>
        `).join('');
    }

    async function translateTextWithOpenAICompatible(text, context) {
        const baseUrl = String(state.mtBaseUrl || '').replace(/\/$/, '');
        if (!baseUrl) {
            throw new Error('Missing API base URL.');
        }
        if (!state.mtApiKey) {
            throw new Error('Missing API key. Add it in API Key field.');
        }
        if (!state.mtModel) {
            throw new Error('Missing model name.');
        }

        function extractMnemonicTokens(text) {
            return String(text || '').match(MNEMONIC_REFERENCE_PATTERN) || [];
        }

        function protectMnemonicTokens(text) {
            const tokens = [];
            const protectedText = String(text || '').replace(MNEMONIC_REFERENCE_PATTERN, (match) => {
                const token = `__MNEMONIC_REF_${tokens.length}__`;
                tokens.push(match);
                return token;
            });
            return { protectedText, tokens };
        }

        function restoreMnemonicTokens(text, tokens) {
            let restored = String(text || '');
            (tokens || []).forEach((value, idx) => {
                const marker = `__MNEMONIC_REF_${idx}__`;
                restored = restored.split(marker).join(value);
            });
            return restored;
        }

        const systemPrompt = [
            el.systemPrompt.value || PROFILE_PROMPTS.default,
            'Return strict JSON with keys: translated_text.',
            'Preserve XML/HTML tags and placeholders exactly where present.',
            'Do not add commentary.'
        ].join(' ');

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.mtApiKey}`
        };
        if (state.mtProvider === 'gemini') {
            headers['x-goog-api-key'] = state.mtApiKey;
        }

        const protectedPayload = protectMnemonicTokens(text);

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: state.mtModel,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            objective: 'Translate dictionary content preserving structure and protected tokens.',
                            target_language: state.targetLang,
                            context,
                            source_text: protectedPayload.protectedText
                        })
                    }
                ]
            })
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`LLM request failed (${response.status}): ${body}`);
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('LLM returned empty content.');
        }

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (err) {
            throw new Error('LLM returned non-JSON content.');
        }

        const translated = String(parsed.translated_text || '').trim();
        const restored = restoreMnemonicTokens(translated || protectedPayload.protectedText, protectedPayload.tokens);

        const srcMnemonic = extractMnemonicTokens(text);
        const outMnemonic = extractMnemonicTokens(restored);
        if (srcMnemonic.length !== outMnemonic.length || srcMnemonic.some((token, idx) => token !== outMnemonic[idx])) {
            throw new Error('Translation altered mnemonic references. Please retry with preserved tokens.');
        }

        return restored || text;
    }

    async function mapWithConcurrency(items, limit, mapper) {
        const list = Array.isArray(items) ? items : [];
        if (list.length === 0) return [];
        const maxWorkers = Math.max(1, Math.min(Number(limit) || 1, list.length));
        const out = new Array(list.length);
        let cursor = 0;

        async function worker() {
            while (cursor < list.length) {
                const idx = cursor;
                cursor += 1;
                out[idx] = await mapper(list[idx], idx);
            }
        }

        const workers = [];
        for (let i = 0; i < maxWorkers; i += 1) {
            workers.push(worker());
        }
        await Promise.all(workers);
        return out;
    }

    async function machineDraftDemo() {
        const draft = getCurrentDraft();
        if (!draft) return;

        gatherMtConfigFromUi();

        const lang = state.targetLang;

        if (state.mtProvider === 'demo') {
            draft.sections.forEach((s) => {
                if (s.locked) return;
                s.paragraphs = s.paragraphs.map((p) => pseudoTranslateHtml(p, lang));
            });
            draft.title = `[${lang}] ${draft.title}`;
            draft.updatedAt = new Date().toISOString();
            renderSelectedEntry();
            renderValidationMessages([{ type: 'ok', text: 'Machine draft demo applied. Review and validate before marking ready.' }]);
            return;
        }

        if (state.mtProvider !== 'openai-compatible' && state.mtProvider !== 'gemini') {
            renderValidationMessages([{ type: 'error', text: `Unsupported provider: ${state.mtProvider}` }]);
            return;
        }

        el.translateBtn.disabled = true;
        const originalLabel = el.translateBtn.textContent;
        el.translateBtn.textContent = 'Drafting...';

        try {
            const tasks = [];
            tasks.push({ kind: 'title', text: draft.title });
            draft.sections.forEach((section) => {
                if (section.locked) return;
                section.paragraphs.forEach((paragraph, i) => {
                    if (!String(paragraph || '').trim()) return;
                    tasks.push({
                        kind: 'paragraph',
                        sectionId: section.id,
                        sectionLabel: section.label,
                        paragraphIndex: i,
                        text: paragraph
                    });
                });
            });

            renderValidationMessages([{ type: 'warn', text: `Drafting ${tasks.length} blocks...` }]);

            const results = await mapWithConcurrency(tasks, 4, async (task) => {
                if (task.kind === 'title') {
                    const translated = await translateTextWithOpenAICompatible(task.text, {
                        field: 'title',
                        entryKey: draft.key
                    });
                    return { ...task, translated };
                }
                const translated = await translateTextWithOpenAICompatible(task.text, {
                    field: 'paragraph',
                    entryKey: draft.key,
                    section: task.sectionLabel,
                    paragraphIndex: task.paragraphIndex
                });
                return { ...task, translated };
            });

            results.forEach((r) => {
                if (r.kind === 'title') {
                    draft.title = r.translated;
                    return;
                }
                const section = draft.sections.find((s) => s.id === r.sectionId);
                if (!section) return;
                section.paragraphs[r.paragraphIndex] = r.translated;
            });

            draft.operations.push(makeOperation('edit-content', {
                source: 'machine-draft',
                provider: state.mtProvider,
                model: state.mtModel
            }));
            draft.updatedAt = new Date().toISOString();
            renderSelectedEntry();
            renderValidationMessages([{ type: 'ok', text: `Machine draft applied using ${state.mtModel}.` }]);
        } catch (err) {
            renderValidationMessages([{ type: 'error', text: `Machine draft failed: ${err.message || String(err)}` }]);
        } finally {
            el.translateBtn.disabled = false;
            el.translateBtn.textContent = originalLabel;
        }
    }

    function pseudoTranslateHtml(html, lang) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach((node) => {
            const raw = node.nodeValue || '';
            if (!raw.trim()) return;
            node.nodeValue = `[${lang}] ${raw}`;
        });

        return wrapper.innerHTML;
    }

    function saveDraft() {
        const draft = getCurrentDraft();
        if (!draft) return;
        draft.updatedAt = new Date().toISOString();
        persistLocalState();
        renderValidationMessages([{ type: 'ok', text: 'Draft saved locally.' }]);
    }

    function markReady() {
        const entry = state.selectedEntry;
        if (!entry) return;
        state.readyKeys[entry.key] = true;
        persistLocalState();
        renderEntryList();
        renderSelectedEntry();
        renderValidationMessages([{ type: 'ok', text: `Entry ${entry.key} marked ready.` }]);
    }

    function exportCurrentDraft() {
        const draft = getCurrentDraft();
        const entry = state.selectedEntry;
        if (!draft || !entry) return;

        const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `draft_${state.targetLang}_${entry.key}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function filterEntries() {
        const term = (el.entrySearch.value || '').trim().toLowerCase();
        if (!term) {
            state.filteredEntries = [...state.entries];
        } else {
            state.filteredEntries = state.entries.filter((e) =>
                String(e.key || '').toLowerCase().includes(term) ||
                String(e.title || '').toLowerCase().includes(term) ||
                String(e.category || '').toLowerCase().includes(term)
            );
        }
        renderEntryList();
    }

    function onLanguageChange() {
        state.targetLang = el.langSelect.value;
        loadLocalState();
        renderEntryList();
        renderSelectedEntry();
        updateBrowserLinkForEntry();
        syncEntryUrl();
    }

    function onProfileChange() {
        el.systemPrompt.value = profileSystemPrompt(el.profileSelect.value);
        refreshPromptBadge();
    }

    function onMtConfigChange() {
        gatherMtConfigFromUi();
    }

    async function onProviderChange() {
        const provider = String(el.mtProviderSelect?.value || 'demo');
        const availableModels = await fetchAvailableModels(provider);
        applyProviderDefaults(provider, true, availableModels);
        gatherMtConfigFromUi();

        const isDemo = provider === 'demo';
        if (el.mtApiKey) el.mtApiKey.disabled = isDemo;
        if (el.mtBaseUrl) el.mtBaseUrl.disabled = isDemo;
        if (el.mtModel) el.mtModel.disabled = isDemo;
    }

    function togglePreviewMode() {
        state.previewMode = !state.previewMode;
        state.previewEditToken = null;
        document.body.classList.toggle('tw-reader-preview', state.previewMode);
        if (el.previewToggleBtn) {
            el.previewToggleBtn.textContent = state.previewMode ? 'Editor Mode' : 'Reader Preview';
        }
        renderSelectedEntry();
    }

    function boot() {
        const urlContext = getUrlContext();
        const loaded = window.ALL_DICTIONARY_ENTRIES || window.ALL_ENTRIES || [];
        state.entries = [...loaded];
        state.filteredEntries = [...loaded];
        state.targetLang = urlContext.lang || 'ml';
        if (el.langSelect) {
            const hasLang = [...el.langSelect.options].some((opt) => opt.value === state.targetLang);
            if (!hasLang) {
                state.targetLang = 'ml';
            }
            el.langSelect.value = state.targetLang;
        }
        if (el.profileSelect) {
            el.profileSelect.value = 'malayalam-common';
        }

        loadLocalState();
        document.body.classList.toggle('tw-reader-preview', state.previewMode);
        if (el.previewToggleBtn) {
            el.previewToggleBtn.textContent = state.previewMode ? 'Editor Mode' : 'Reader Preview';
        }
        applySidebarState();
        applySettingsState();
        refreshProviderPicker();
        if (el.mtProviderSelect && [...el.mtProviderSelect.options].some((o) => o.value === 'gemini')) {
            state.mtProvider = 'gemini';
            el.mtProviderSelect.value = 'gemini';
        }
        applyProviderDefaults(state.mtProvider, true, null);
        onProviderChange();
        gatherMtConfigFromUi();
        onProfileChange();
        refreshPromptBadge();
        renderEntryList();

        if (state.filteredEntries.length > 0) {
            const preferredKey = urlContext.entryKey;
            const requestedIndex = preferredKey
                ? state.filteredEntries.findIndex((e) => String(e.key || '') === preferredKey)
                : -1;
            selectEntry(requestedIndex >= 0 ? requestedIndex : 0);
        }

        el.entrySearch.addEventListener('input', filterEntries);
        el.langSelect.addEventListener('change', onLanguageChange);
        el.profileSelect.addEventListener('change', onProfileChange);
        el.savePromptBtn?.addEventListener('click', () => {
            const profile = el.profileSelect?.value || 'default';
            const text = String(el.systemPrompt?.value || '').trim();
            if (!text) return;
            saveCustomPrompt(profile, text);
            refreshPromptBadge();
            renderValidationMessages([{ type: 'ok', text: `Custom prompt saved for "${profile}".` }]);
        });
        el.resetPromptBtn?.addEventListener('click', () => {
            const profile = el.profileSelect?.value || 'default';
            resetCustomPrompt(profile);
            el.systemPrompt.value = PROFILE_PROMPTS[profile] || PROFILE_PROMPTS.default;
            refreshPromptBadge();
            renderValidationMessages([{ type: 'ok', text: `Prompt reset to built-in for "${profile}".` }]);
        });
        el.sidebarToggleBtn?.addEventListener('click', toggleSidebarOpen);
        el.sidebarPinBtn?.addEventListener('click', toggleSidebarPin);
        el.openSettingsBtn?.addEventListener('click', openSettings);
        el.closeSettingsBtn?.addEventListener('click', closeSettings);
        el.settingsBackdrop?.addEventListener('click', closeSettings);
        el.mtProviderSelect?.addEventListener('change', onProviderChange);
        el.mtBaseUrl?.addEventListener('input', onMtConfigChange);
        el.mtModel?.addEventListener('input', onMtConfigChange);
        el.mtApiKey?.addEventListener('input', onMtConfigChange);

        el.translateBtn.addEventListener('click', machineDraftDemo);
        if (el.previewToggleBtn) {
            el.previewToggleBtn.addEventListener('click', togglePreviewMode);
        }
        el.validateBtn.addEventListener('click', runValidation);
        el.saveDraftBtn.addEventListener('click', saveDraft);
        el.markReadyBtn.addEventListener('click', markReady);
        el.exportEntryBtn.addEventListener('click', exportCurrentDraft);
    }

    window.addEventListener('load', boot);
})();

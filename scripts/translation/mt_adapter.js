function chunkTextsByChars(texts, maxChars) {
    const chunks = [];
    let current = [];
    let currentChars = 0;

    texts.forEach((text) => {
        const nextLen = (text || '').length;
        if (current.length > 0 && currentChars + nextLen > maxChars) {
            chunks.push(current);
            current = [];
            currentChars = 0;
        }
        current.push(text);
        currentChars += nextLen;
    });

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
}

async function translateWithOpenAICompatible(texts, options) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = (options.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = options.model || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const systemPrompt = options.systemPrompt || 'Translate preserving structure.';
    const maxBatchChars = Number(options.maxBatchChars || 12000);
    const retries = Number(options.retries || 2);

    if (!apiKey) {
        throw new Error('Missing API key for openai-compatible provider (set OPENAI_API_KEY).');
    }

    const textChunks = chunkTextsByChars(texts, maxBatchChars);
    const translated = [];

    for (const chunk of textChunks) {
        const payload = {
            model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction: 'Return a JSON object with key "translations" containing an array with the same length and order as "inputs".',
                        inputs: chunk
                    })
                }
            ]
        };

        let lastError = null;
        let success = false;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const body = await response.text();
                    throw new Error(`API error ${response.status}: ${body}`);
                }

                const data = await response.json();
                const content = data?.choices?.[0]?.message?.content;
                if (!content) {
                    throw new Error('Empty completion content.');
                }

                const parsed = JSON.parse(content);
                const out = parsed?.translations;
                if (!Array.isArray(out) || out.length !== chunk.length) {
                    throw new Error('Invalid translation payload shape from model.');
                }

                translated.push(...out.map((v, i) => (typeof v === 'string' ? v : chunk[i])));
                success = true;
                break;
            } catch (err) {
                lastError = err;
            }
        }

        if (!success) {
            throw lastError;
        }
    }

    return translated;
}

function createAdapter(options = {}) {
    const provider = (options.provider || 'passthrough').toLowerCase();

    return {
        provider,
        async translateBatch(texts, context = {}) {
            if (!Array.isArray(texts) || texts.length === 0) {
                return [];
            }

            if (provider === 'passthrough') {
                return texts;
            }

            if (provider === 'mock') {
                const lang = context.targetLang || 'xx';
                return texts.map((t) => `[${lang}] ${t}`);
            }

            if (provider === 'openai-compatible') {
                return translateWithOpenAICompatible(texts, {
                    ...options,
                    systemPrompt: context.systemPrompt || options.systemPrompt
                });
            }

            throw new Error(`Unsupported provider: ${provider}`);
        }
    };
}

module.exports = {
    createAdapter,
    chunkTextsByChars
};

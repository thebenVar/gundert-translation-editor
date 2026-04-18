module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const rawBody = normalizeBody(req.body);
        const provider = String(rawBody.provider || 'gemini').trim();
        const payload = rawBody.payload || {};

        if (!payload || typeof payload !== 'object') {
            return res.status(400).send('Invalid request payload.');
        }

        const providerConfig = resolveProviderConfig(provider, rawBody);
        if (!providerConfig.apiKey) {
            return res.status(500).send(`${provider} API key is not configured on server.`);
        }

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${providerConfig.apiKey}`
        };
        if (provider === 'gemini') {
            headers['x-goog-api-key'] = providerConfig.apiKey;
        }

        const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ...payload,
                model: String(rawBody.model || payload.model || providerConfig.model || '').trim()
            })
        });

        const bodyText = await response.text();
        if (!response.ok) {
            return res.status(response.status).send(bodyText || 'Upstream API error.');
        }

        return res.status(200).send(bodyText);
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        return res.status(500).send(`Server translation proxy error: ${message}`);
    }
};

function resolveProviderConfig(provider, rawBody) {
    const requestedBaseUrl = String(rawBody.baseUrl || '').trim().replace(/\/$/, '');

    if (provider === 'openai-compatible') {
        return {
            apiKey: process.env.OPENAI_API_KEY || '',
            baseUrl: requestedBaseUrl || String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
            model: process.env.OPENAI_MODEL || 'o3'
        };
    }

    if (provider === 'gemini') {
        return {
            apiKey: process.env.GEMINI_API_KEY || '',
            baseUrl: requestedBaseUrl || String(process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, ''),
            model: process.env.GEMINI_MODEL || 'gemini-2.5-pro'
        };
    }

    throw new Error(`Unsupported provider: ${provider}`);
}

function normalizeBody(body) {
    if (!body) return {};
    if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        return body;
    }
    const asText = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
    if (!asText.trim()) return {};
    return JSON.parse(asText);
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await normalizeBody(req);
    const provider = String(rawBody.provider || 'gemini').trim();
    const payload = rawBody.payload || {};

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request payload.' },
        { status: 400 }
      );
    }

    const providerConfig = resolveProviderConfig(provider, rawBody);
    if (!providerConfig.apiKey) {
      return NextResponse.json(
        { error: `${provider} API key is not configured on server.` },
        { status: 500 }
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerConfig.apiKey}`,
    };
    
    let endpointUrl = `${providerConfig.baseUrl}/chat/completions`;
    let requestBody: Record<string, any> = {
      ...payload,
      model: String(
        rawBody.model || payload.model || providerConfig.model || ''
      ).trim(),
    };

    if (provider === 'gemini') {
      headers['x-goog-api-key'] = providerConfig.apiKey;
      delete headers.Authorization;
      // Use Gemini's generateContent endpoint
      const model = String(rawBody.model || payload.model || providerConfig.model || 'gemini-2.5-pro').trim();
      endpointUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${providerConfig.apiKey}`;
      // Transform OpenAI-compatible request to Gemini format
      requestBody = {
        contents: [
          {
            parts: [
              {
                text: payload.messages?.[payload.messages.length - 1]?.content || payload.prompt || '',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: payload.temperature || 0.7,
          maxOutputTokens: payload.max_tokens || 2048,
          topP: payload.top_p || 0.95,
        },
      };
    }

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: responseText || 'Upstream API error.' },
        { status: response.status }
      );
    }

    return new NextResponse(responseText, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Server translation proxy error: ${message}` },
      { status: 500 }
    );
  }
}

function resolveProviderConfig(
  provider: string,
  rawBody: Record<string, any>
) {
  const requestedBaseUrl = String(rawBody.baseUrl || '')
    .trim()
    .replace(/\/$/, '');

  if (provider === 'openai-compatible') {
    return {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl:
        requestedBaseUrl ||
        String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(
          /\/$/,
          ''
        ),
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    };
  }

  if (provider === 'gemini') {
    return {
      apiKey: process.env.GEMINI_API_KEY || '',
      baseUrl:
        requestedBaseUrl ||
        String(
          process.env.GEMINI_BASE_URL ||
            'https://generativelanguage.googleapis.com/v1'
        ).replace(/\/$/, ''),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function normalizeBody(
  req: NextRequest
): Promise<Record<string, any>> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

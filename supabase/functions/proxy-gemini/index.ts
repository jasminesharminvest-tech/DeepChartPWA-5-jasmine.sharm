import { corsHeaders, preflightResponse } from '../_shared/cors.ts';
import { checkRateLimit, getSecret } from '../_shared/rate-limit.ts';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_PER_MIN = 10;

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function buildPrompt(symbol: string, candles: Candle[]): string {
  const last20 = candles.slice(-20);
  const ohlc = last20.map((c) => ({
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    v: c.volume,
  }));

  return [
    `Analyze OHLC for ${symbol}. Here are the last ${last20.length} candles (OHLCV):`,
    JSON.stringify(ohlc),
    '',
    'You are a technical analysis assistant. Analyze the price action and return a JSON object with the following structure:',
    '{',
    '  "trend": "bullish" | "bearish" | "sideways",',
    '  "confidence": number 0-100,',
    '  "levels": { "support": number, "resistance": number },',
    '  "recommendation": "buy" | "sell" | "wait",',
    '  "reasoning": string (at least 10 chars, concise technical explanation),',
    '  "keyLevels": [number] (optional, important price levels),',
    '  "riskNote": string (optional, key risk factor)',
    '}',
    '',
    'Return ONLY the JSON object, no markdown, no code fences, no extra text.',
  ].join('\n');
}

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

interface GeminiPart {
  text?: string;
}
interface GeminiContent {
  parts: GeminiPart[];
}
interface GeminiCandidate {
  content?: GeminiContent;
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

Deno.serve(async (req: Request) => {
  const preflight = preflightResponse(req);
  if (preflight) return preflight;

  try {
    const clientKey = req.headers.get('X-Client-Key') ?? 'anonymous';

    const allowed = await checkRateLimit(clientKey, 'proxy-gemini', RATE_LIMIT_PER_MIN);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 10 requests per minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const { symbol, candles, prompt: directPrompt } = body as {
      symbol?: string;
      candles?: Candle[];
      prompt?: string;
      context?: unknown;
    };

    const prompt = directPrompt ?? (symbol && candles ? buildPrompt(symbol, candles) : null);
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Either { symbol, candles } or { prompt } is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = getSecret('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key is not configured on the server.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({ error: `Gemini request failed: ${msg}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return new Response(
        JSON.stringify({
          error: res.status === 401
            ? 'Invalid Gemini API key on server.'
            : res.status === 429
              ? 'Gemini rate limit reached.'
              : `Gemini API error (${res.status}).`,
        }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No analysis returned from Gemini.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const parsed = extractJson(text);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

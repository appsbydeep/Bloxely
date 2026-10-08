import type { AIWorkspacePlanner } from '../lib/aiWorkspacePlanner';
import { AIPlannerTransportError } from '../lib/aiWorkspacePlanner';
import { DEFAULT_GEMINI_MODEL, GeminiWorkspacePlanner } from '../lib/geminiWorkspacePlanner';
import { InvalidAiPlanError, normalizeWorkspacePlan } from '../lib/normalizeWorkspacePlan';

const json = (body: unknown, status: number): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const error = (code: string, status: number): Response => json({ error: { code, message: 'Bloxely could not build your plan.' } }, status);
const localDateToday = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
};

// Netlify enforces this at the edge across function instances. A block returns
// its native 429 response before the handler runs, so it cannot carry our JSON error shape.
export const config = {
  path: '/.netlify/functions/generate-workspace-plan',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return error('METHOD_NOT_ALLOWED', 405);
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 12000) return error('INPUT_TOO_LARGE', 413);
    input = JSON.parse(body);
  } catch {
    return error('INVALID_REQUEST', 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return error('INVALID_REQUEST', 400);
  const data = input as Record<string, unknown>;
  if (typeof data.brainDump !== 'string' || !data.brainDump.trim() || data.brainDump.length > 5000) return error('INVALID_REQUEST', 400);
  const brainDump = data.brainDump.trim();
  const localDate = typeof data.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.localDate) &&
    !Number.isNaN(Date.parse(data.localDate)) ? data.localDate : localDateToday();
  let timeZone = 'UTC';
  if (typeof data.timeZone === 'string' && data.timeZone.length <= 64) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: data.timeZone }); timeZone = data.timeZone; } catch { /* use UTC */ }
  }
  if ((process.env.AI_PROVIDER || 'gemini') !== 'gemini') return error('AI_PROVIDER_UNSUPPORTED', 503);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return error('AI_NOT_CONFIGURED', 503);
  const planner: AIWorkspacePlanner = new GeminiWorkspacePlanner(apiKey, process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  try {
    const output = await planner.generatePlanData({ brainDump, localDate, timeZone });
    return json({ plan: normalizeWorkspacePlan(output, brainDump) }, 200);
  } catch (caught) {
    if (caught instanceof AIPlannerTransportError && caught.status === 429) return error('AI_RATE_LIMITED', 429);
    if (caught instanceof InvalidAiPlanError || caught instanceof AIPlannerTransportError && caught.category === 'invalid_output') {
      return error('AI_INVALID_OUTPUT', 502);
    }
    return error('AI_UPSTREAM_ERROR', 502);
  }
}

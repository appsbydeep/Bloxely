// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { config } from '../../netlify/functions/generate-workspace-plan';
import { AIPlannerTransportError } from '../../netlify/lib/aiWorkspacePlanner';
import { DEFAULT_GEMINI_MODEL, GeminiWorkspacePlanner } from '../../netlify/lib/geminiWorkspacePlanner';
import { InvalidAiPlanError, normalizeWorkspacePlan } from '../../netlify/lib/normalizeWorkspacePlan';

const modelOutput = () => ({
  tasks: [{ title: 'Finish homepage', priority: 'high', dueAt: '2026-10-08', estimatedMinutes: 60 }],
  notes: [{ content: 'Client call at 2 PM' }], unresolvedItems: ['Confirm call time zone'],
});
const geminiResponse = (output: unknown) => new Response(JSON.stringify({
  status: 'completed', steps: [
    { type: 'user_input', content: [{ type: 'text', text: 'Input' }] },
    { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(output) }] },
  ],
}), { status: 200 });
const request = () => new Request('https://example.netlify.app/.netlify/functions/generate-workspace-plan', {
  method: 'POST', body: JSON.stringify({ brainDump: 'Finish homepage today.', localDate: '2026-10-08', timeZone: 'Asia/Kolkata' }),
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('provider-neutral planner and Gemini transport', () => {
  it('declares a Netlify edge limit for the public plan endpoint', () => {
    expect(config).toEqual({
      path: '/.netlify/functions/generate-workspace-plan',
      rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
    });
  });
  it('sends structured Gemini request with server-only credentials and local date', async () => {
    const fetchMock = vi.fn(async () => geminiResponse(modelOutput()));
    const planner = new GeminiWorkspacePlanner('test-key', DEFAULT_GEMINI_MODEL, fetchMock as typeof fetch);
    expect(await planner.generatePlanData({ brainDump: 'Finish homepage today.', localDate: '2026-10-08', timeZone: 'Asia/Kolkata' }))
      .toEqual(modelOutput());
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(options.headers).toMatchObject({ 'x-goog-api-key': 'test-key', 'content-type': 'application/json' });
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(body.system_instruction).toContain('Bloxely AI');
    expect(body.response_format).toMatchObject({ type: 'text', mime_type: 'application/json', schema: { type: 'object' } });
    expect(body.input).toContain('2026-10-08');
    expect(body.input).toContain('Asia/Kolkata');
    expect(body.store).toBe(false);
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('rejects malformed model JSON and non-2xx responses safely', async () => {
    const malformed = vi.fn(async () => new Response(JSON.stringify({
      status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{' }] }],
    }), { status: 200 }));
    await expect(new GeminiWorkspacePlanner('key', DEFAULT_GEMINI_MODEL, malformed as typeof fetch)
      .generatePlanData({ brainDump: 'private', localDate: '2026-10-08', timeZone: 'UTC' }))
      .rejects.toMatchObject({ category: 'invalid_output' } satisfies Partial<AIPlannerTransportError>);
    const upstream = vi.fn(async () => new Response('upstream private content', { status: 429 }));
    await expect(new GeminiWorkspacePlanner('key', DEFAULT_GEMINI_MODEL, upstream as typeof fetch)
      .generatePlanData({ brainDump: 'private', localDate: '2026-10-08', timeZone: 'UTC' }))
      .rejects.toMatchObject({ category: 'upstream', status: 429 });
    const incomplete = vi.fn(async () => new Response(JSON.stringify({
      status: 'incomplete', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(modelOutput()) }] }],
    }), { status: 200 }));
    await expect(new GeminiWorkspacePlanner('key', DEFAULT_GEMINI_MODEL, incomplete as typeof fetch)
      .generatePlanData({ brainDump: 'private', localDate: '2026-10-08', timeZone: 'UTC' }))
      .rejects.toMatchObject({ category: 'invalid_output' });
  });

  it('retries a temporary 503 once, then accepts the response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('busy', { status: 503, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(geminiResponse(modelOutput()));
    const planner = new GeminiWorkspacePlanner('key', DEFAULT_GEMINI_MODEL, fetchMock as typeof fetch);
    await expect(planner.generatePlanData({ brainDump: 'private', localDate: '2026-10-08', timeZone: 'UTC' })).resolves.toEqual(modelOutput());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never retries more than once and does not retry non-retryable errors', async () => {
    const busy = vi.fn(async () => new Response('busy', { status: 503, headers: { 'retry-after': '0' } }));
    const input = { brainDump: 'private', localDate: '2026-10-08', timeZone: 'UTC' };
    await expect(new GeminiWorkspacePlanner('key', DEFAULT_GEMINI_MODEL, busy as typeof fetch).generatePlanData(input))
      .rejects.toMatchObject({ status: 503 });
    expect(busy).toHaveBeenCalledTimes(2);
    const invalidKey = vi.fn(async () => new Response('bad key', { status: 401 }));
    await expect(new GeminiWorkspacePlanner('key', DEFAULT_GEMINI_MODEL, invalidKey as typeof fetch).generatePlanData(input))
      .rejects.toMatchObject({ status: 401 });
    expect(invalidKey).toHaveBeenCalledTimes(1);
    const delayed = vi.fn(async () => new Response('busy', { status: 503, headers: { 'retry-after': '10' } }));
    await expect(new GeminiWorkspacePlanner('key', DEFAULT_GEMINI_MODEL, delayed as typeof fetch).generatePlanData(input))
      .rejects.toMatchObject({ status: 503 });
    expect(delayed).toHaveBeenCalledTimes(1);
  });

  it('strips unknown fields and assigns Bloxely IDs and allowlisted blocks', () => {
    const input = { ...modelOutput(), type: 'calendar', layout: { x: 900 }, id: 'model-id',
      tasks: [{ ...modelOutput().tasks[0], id: 'untrusted', widgetType: 'calendar', html: '<script>alert(1)</script>' }],
      notes: [{ content: '<img src=x onerror=alert(1)>Call at 2 PM', component: 'Calendar' }],
    };
    const plan = normalizeWorkspacePlan(input, 'My input');
    expect(plan.proposedTasks[0].id).not.toBe('untrusted');
    expect(plan.proposedTasks[0]).not.toHaveProperty('widgetType');
    expect(plan.proposedBlocks.map(block => block.type)).toEqual(['todo', 'sticky-note']);
    expect(plan.proposedNotes[0].content).toBe('Call at 2 PM');
    expect(JSON.stringify(plan)).not.toContain('calendar');
    expect(JSON.stringify(plan)).not.toContain('<img');
  });

  it('rejects invalid priority, date, estimates, duplicate tasks and more than eight tasks', () => {
    expect(() => normalizeWorkspacePlan({ ...modelOutput(), tasks: [{ ...modelOutput().tasks[0], priority: 'critical' }] }, 'input')).toThrow(InvalidAiPlanError);
    expect(() => normalizeWorkspacePlan({ ...modelOutput(), tasks: [{ ...modelOutput().tasks[0], dueAt: '2026-02-30' }] }, 'input')).toThrow(InvalidAiPlanError);
    expect(() => normalizeWorkspacePlan({ ...modelOutput(), tasks: [{ ...modelOutput().tasks[0], estimatedMinutes: 999 }] }, 'input')).toThrow(InvalidAiPlanError);
    expect(() => normalizeWorkspacePlan({ ...modelOutput(), tasks: Array.from({ length: 9 }, () => modelOutput().tasks[0]) }, 'input')).toThrow(InvalidAiPlanError);
    expect(() => normalizeWorkspacePlan({ ...modelOutput(), tasks: [modelOutput().tasks[0], modelOutput().tasks[0]] }, 'input')).toThrow(InvalidAiPlanError);
  });

  it('returns configuration errors for a missing key or unsupported provider', async () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', '');
    const missingKey = await handler(request());
    expect(missingKey.status).toBe(503);
    expect((await missingKey.json()).error.code).toBe('AI_NOT_CONFIGURED');
    vi.stubEnv('AI_PROVIDER', 'unknown');
    const unsupported = await handler(request());
    expect((await unsupported.json()).error.code).toBe('AI_PROVIDER_UNSUPPORTED');
  });

  it('returns a normalized draft from the provider-neutral endpoint', async () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.7-flash');
    const fetchMock = vi.fn(async () => geminiResponse({ ...modelOutput(), widgetType: 'calendar' }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await handler(request());
    expect(result.status).toBe(200);
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(options.body)).model).toBe('gemini-3.7-flash');
    const payload = await result.json();
    expect(payload.plan.status).toBe('draft');
    expect(payload.plan.proposedTasks[0]).toMatchObject({ title: 'Finish homepage', priority: 'high', dueAt: '2026-10-08' });
    expect(payload.plan.proposedBlocks.map((block: { type: string }) => block.type)).toEqual(['todo', 'sticky-note']);
    expect(payload.plan).not.toHaveProperty('widgetType');
  });

  it('returns safe errors for invalid output and Gemini non-2xx responses', async () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream private error', { status: 500 })));
    const upstream = await handler(request());
    expect(upstream.status).toBe(502);
    expect((await upstream.text())).not.toContain('upstream private error');
    vi.stubGlobal('fetch', vi.fn(async () => geminiResponse({ ...modelOutput(), tasks: [{ ...modelOutput().tasks[0], priority: 'wrong' }] })));
    const invalid = await handler(request());
    expect((await invalid.json()).error.code).toBe('AI_INVALID_OUTPUT');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: '{malformed' }] }],
    }), { status: 200 })));
    const malformed = await handler(request());
    expect((await malformed.json()).error.code).toBe('AI_INVALID_OUTPUT');
  });

  it('returns a typed safe 429 when Gemini remains rate limited', async () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => new Response('private quota detail', { status: 429, headers: { 'retry-after': '0' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await handler(request());
    expect(result.status).toBe(429);
    expect(await result.json()).toEqual({ error: { code: 'AI_RATE_LIMITED', message: 'Bloxely could not build your plan.' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { createWorkspacePlan } from '../services/workspacePlan';
import { generateAiWorkspacePlan } from '../services/aiWorkspacePlan';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('AI WorkspacePlan flow', () => {
  it('shows loading then opens the existing review without auto-confirming', async () => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    const fetchMock = vi.fn(() => pending);
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Brain dump'), { target: { value: 'Finish homepage today.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build my workspace' }));
    expect(screen.getByRole('status')).toHaveTextContent('Understanding your work…');
    expect(fetchMock).toHaveBeenCalledWith('/.netlify/functions/generate-workspace-plan', expect.objectContaining({ method: 'POST' }));
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({ brainDump: 'Finish homepage today.' });
    expect(JSON.stringify(options)).not.toMatch(/gemini|api.key/i);
    const draft = createWorkspacePlan('Finish homepage today.');
    const plan = { ...draft,
      proposedTasks: [{ ...draft.proposedTasks[0], priority: 'high', dueAt: '2026-10-08', estimatedMinutes: 60 }],
      unresolvedItems: ['Confirm call time zone'],
    };
    finish(new Response(JSON.stringify({ plan }), { status: 200 }));
    expect(await screen.findByRole('heading', { name: 'Review your plan' })).toBeInTheDocument();
    expect(screen.getByText(/Suggested priority: high/)).toHaveTextContent('Due: 2026-10-08');
    expect(screen.getByText('Confirm call time zone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build workspace' })).toBeInTheDocument();
    expect(screen.queryByText('Finish homepage today', { selector: '.todo-widget' })).not.toBeInTheDocument();
  });

  it('preserves the brain dump on upstream failure and supports retry and basic fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Brain dump'), { target: { value: 'Call Sarah.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build my workspace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Bloxely couldn't build your plan. Try again.");
    expect(screen.getByLabelText('Brain dump')).toHaveValue('Call Sarah.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('alert')).toHaveTextContent("Bloxely couldn't build your plan. Try again.");
    fireEvent.click(screen.getByRole('button', { name: 'Use basic planner' }));
    expect(await screen.findByRole('heading', { name: 'Review your plan' })).toBeInTheDocument();
    expect(screen.getByLabelText('Task 1')).toHaveValue('Call Sarah');
  });

  it('rejects malformed or unsupported plan data from the endpoint', async () => {
    const invalid = { ...createWorkspacePlan('Call Sarah.'), proposedBlocks: [{ id: 'bad', type: 'calendar', title: 'Injected' }] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ plan: invalid }), { status: 200 }));
    await expect(generateAiWorkspacePlan('Call Sarah.', fetchMock as typeof fetch)).rejects.toThrow("Bloxely couldn't build your plan. Try again.");
  });
});

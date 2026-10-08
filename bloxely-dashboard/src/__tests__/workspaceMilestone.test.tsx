import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { DashboardProvider, dashboardReducer, useDashboard } from '../context/DashboardContext';
import { NotificationProvider } from '../context/NotificationContext';
import { useDashboardActions } from '../hooks/useDashboardActions';
import GridLayoutManager from '../components/GridLayoutManager';
import WidgetRenderer from '../components/WidgetRenderer';
import { buildWorkspace, createWorkspacePlan } from '../services/workspacePlan';
import { loadDashboardState, saveDashboardState } from '../utils/persistence';
import { validateDashboardState } from '../utils/validation';
import type { DashboardState } from '../types/dashboard';

const emptyState = (): DashboardState => ({
  layout: [], widgets: {}, settings: { theme: 'dark', gridCols: 12, gridRowHeight: 60 },
});

function ProgrammaticLayoutHarness() {
  const { state, isLoading } = useDashboard();
  const { updateBlockLayout } = useDashboardActions();
  if (isLoading) return <p>Loading</p>;
  const block = state.workspace?.blocks[0];
  return (
    <>
      {block && <button onClick={() => updateBlockLayout(block.id, { x: 210, y: 165, width: 510, height: 390 })}>Change layout</button>}
      <GridLayoutManager generatedBlocks={state.workspace?.blocks} onGeneratedLayoutChange={updateBlockLayout}>
        {Object.values(state.widgets).map(widget => <WidgetRenderer key={widget.id} widget={widget} />)}
      </GridLayoutManager>
    </>
  );
}

const renderLayoutHarness = () => render(
  <NotificationProvider><DashboardProvider><ProgrammaticLayoutHarness /></DashboardProvider></NotificationProvider>
);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
    const { brainDump } = JSON.parse(String(options.body)) as { brainDump: string };
    return new Response(JSON.stringify({ plan: createWorkspacePlan(brainDump) }), { status: 200 });
  }));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Bloxely 2.0 milestone 1', () => {
  it('builds a deterministic plan, limits block types, and confirms atomically', () => {
    const plan = createWorkspacePlan('Finish homepage today. Client call at 2.');
    expect(plan.proposedTasks.map(task => task.title)).toEqual(['Finish homepage today', 'Client call at 2']);
    expect(plan.proposedNotes[0].content).toContain('Finish homepage');
    expect(plan.proposedBlocks.map(block => block.type)).toEqual(['todo', 'sticky-note']);

    const edited = {
      ...plan,
      proposedTasks: [{ ...plan.proposedTasks[0], title: 'Ship homepage' }],
      proposedNotes: [{ ...plan.proposedNotes[0], content: 'Remember the proposal' }],
      proposedBlocks: plan.proposedBlocks.map(block => block.type === 'todo'
        ? { ...block, taskIds: [plan.proposedTasks[0].id] } : block),
    };
    const workspace = buildWorkspace(edited);
    const result = dashboardReducer(emptyState(), { type: 'CONFIRM_WORKSPACE_PLAN', payload: { workspace } });
    expect(result.workspace?.tasks[0].title).toBe('Ship homepage');
    expect(Object.values(result.widgets).map(widget => widget.type)).toEqual(['todo', 'sticky-note']);
    expect(result.widgets[workspace.blocks[0].id].content.tasks[0].text).toBe('Ship homepage');
    expect(result.widgets[workspace.blocks[1].id].content.content).toBe('Remember the proposal');
    expect(emptyState().widgets).toEqual({});
    expect(() => buildWorkspace({ ...plan, proposedBlocks: [{ ...plan.proposedBlocks[0], type: 'calendar' as 'todo' }] })).toThrow('unsupported block');
  });

  it('rejects an unsupported block directly in the confirmation reducer', () => {
    const workspace = buildWorkspace(createWorkspacePlan('Finish homepage.'));
    const state = emptyState();
    const malformed = { ...workspace, blocks: [{ ...workspace.blocks[0], type: 'calendar' as 'todo' }] };
    expect(dashboardReducer(state, { type: 'CONFIRM_WORKSPACE_PLAN', payload: { workspace: malformed } })).toBe(state);
    expect(state.workspace).toBeUndefined();
    expect(state.widgets).toEqual({});
  });

  it('shows entry, allows review edits and removals, and builds the canvas', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: "What's on your mind?" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Brain dump'), { target: { value: 'Finish homepage today. Call Sarah.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build my workspace' }));
    expect(await screen.findByRole('heading', { name: 'Review your plan' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Task 1'), { target: { value: 'Ship homepage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove task 2' }));
    fireEvent.change(screen.getByLabelText('Note 1'), { target: { value: 'Call Sarah after lunch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Brain dump')).toHaveValue('Finish homepage today. Call Sarah.');
    fireEvent.click(screen.getByRole('button', { name: 'Build my workspace' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Build workspace' }));
    await waitFor(() => expect(screen.getByText('Finish homepage today')).toBeInTheDocument());
    expect(screen.getByText('Call Sarah')).toBeInTheDocument();
  });

  it('persists generated layout in the workspace and restores it after reload', async () => {
    const workspace = buildWorkspace(createWorkspacePlan('Finish homepage.'));
    const state = dashboardReducer(emptyState(), { type: 'CONFIRM_WORKSPACE_PLAN', payload: { workspace } });
    saveDashboardState(state);
    const view = render(<App />);
    const blockId = workspace.blocks[0].id;
    const element = await waitFor(() => {
      const node = document.getElementById(`widget-${blockId}`);
      expect(node).not.toBeNull();
      expect(node?.style.left).toBe('48px');
      return node as HTMLElement;
    });
    fireEvent.mouseDown(element, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(document);
    const resize = element.querySelector('.resize-handle') as HTMLElement;
    fireEvent.mouseDown(resize, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 140, clientY: 130 });
    fireEvent.mouseUp(document);
    await waitFor(() => {
      const saved = loadDashboardState();
      expect(saved?.workspace?.blocks[0].layout).toEqual({ x: 128, y: 108, width: 460, height: 470 });
    }, { timeout: 2500 });
    expect(localStorage.getItem(`widget-position-${blockId}`)).toBeNull();
    expect(localStorage.getItem(`widget-size-${blockId}`)).toBeNull();
    view.unmount();
    render(<App />);
    await waitFor(() => {
      const restored = document.getElementById(`widget-${blockId}`);
      expect(restored?.style.left).toBe('128px');
      expect(restored?.style.top).toBe('108px');
      expect(restored?.style.width).toBe('460px');
      expect(restored?.style.height).toBe('470px');
    });
  });

  it('renders a programmatic layout update, persists it, and restores it on reload', async () => {
    const workspace = buildWorkspace(createWorkspacePlan('Finish homepage.'));
    saveDashboardState(dashboardReducer(emptyState(), { type: 'CONFIRM_WORKSPACE_PLAN', payload: { workspace } }));
    const view = renderLayoutHarness();
    const blockId = workspace.blocks[0].id;
    await waitFor(() => expect(document.getElementById(`widget-${blockId}`)?.style.left).toBe('48px'));
    fireEvent.click(screen.getByRole('button', { name: 'Change layout' }));
    await waitFor(() => {
      const element = document.getElementById(`widget-${blockId}`);
      expect(element?.style.left).toBe('210px');
      expect(element?.style.top).toBe('165px');
      expect(element?.style.width).toBe('510px');
      expect(element?.style.height).toBe('390px');
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(document.getElementById(`widget-${blockId}`)?.style.left).toBe('210px');
    await waitFor(() => expect(loadDashboardState()?.workspace?.blocks[0].layout).toEqual({
      x: 210, y: 165, width: 510, height: 390,
    }), { timeout: 2500 });
    view.unmount();
    renderLayoutHarness();
    await waitFor(() => {
      const element = document.getElementById(`widget-${blockId}`);
      expect(element?.style.left).toBe('210px');
      expect(element?.style.top).toBe('165px');
      expect(element?.style.width).toBe('510px');
      expect(element?.style.height).toBe('390px');
    });
  });

  it('keeps legacy widget state valid and rejects malformed workspaces', () => {
    const legacy = dashboardReducer(emptyState(), { type: 'ADD_WIDGET', payload: { widgetType: 'clock' } });
    expect(validateDashboardState(legacy).isValid).toBe(true);
    const workspace = buildWorkspace(createWorkspacePlan('Finish homepage.'));
    const generated = dashboardReducer(emptyState(), { type: 'CONFIRM_WORKSPACE_PLAN', payload: { workspace } });
    expect(validateDashboardState(generated).isValid).toBe(true);
    const missingWidget = { ...generated, widgets: { ...generated.widgets } };
    delete missingWidget.widgets[workspace.blocks[0].id];
    expect(validateDashboardState(missingWidget).isValid).toBe(false);
    const mismatchedWidget = {
      ...generated,
      widgets: { ...generated.widgets, [workspace.blocks[0].id]: {
        ...generated.widgets[workspace.blocks[0].id], type: 'sticky-note' as const,
      } },
    };
    expect(validateDashboardState(mismatchedWidget).isValid).toBe(false);
    expect(validateDashboardState({ ...generated, workspace: { ...workspace, blocks: [{ ...workspace.blocks[0], type: 'not-registered' }] } }).isValid).toBe(false);
    expect(validateDashboardState({ ...generated, workspace: { ...workspace, blocks: [{ ...workspace.blocks[0], layout: { x: NaN, y: 0, width: -1, height: 1 } }] } }).isValid).toBe(false);
  });

  it('keeps legacy widgets rendering when their saved dashboard has no workspace', async () => {
    saveDashboardState(dashboardReducer(emptyState(), { type: 'ADD_WIDGET', payload: { widgetType: 'clock' } }));
    render(<App />);
    await waitFor(() => expect(document.querySelector('.clock-widget-card')).not.toBeNull());
    expect(screen.queryByRole('heading', { name: "What's on your mind?" })).not.toBeInTheDocument();
  });

  it('keeps the generated task model in sync with edits in the existing Tasks widget', () => {
    const workspace = buildWorkspace(createWorkspacePlan('Finish homepage.'));
    const state = dashboardReducer(emptyState(), { type: 'CONFIRM_WORKSPACE_PLAN', payload: { workspace } });
    const blockId = workspace.blocks[0].id;
    const updated = dashboardReducer(state, { type: 'UPDATE_WIDGET', payload: {
      widgetId: blockId,
      content: { tasks: [{ id: workspace.tasks[0].id, text: 'Ship homepage', completed: true, createdAt: new Date() }] },
    } });
    expect(updated.workspace?.tasks[0]).toMatchObject({ title: 'Ship homepage', status: 'done' });
    expect(updated.widgets[blockId].content.tasks[0].text).toBe('Ship homepage');
  });

  it('can remove a proposed note and keep only the approved Tasks block', async () => {
    render(<App />);
    await screen.findByLabelText('Brain dump');
    fireEvent.change(screen.getByLabelText('Brain dump'), { target: { value: 'Finish homepage.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build my workspace' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove note 1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Build workspace' }));
    await waitFor(() => expect(screen.getByText('Finish homepage')).toBeInTheDocument());
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('places a note-only plan at the top and stacks blocks on narrow screens', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    try {
      const plan = createWorkspacePlan('Finish homepage.');
      const noteOnly = buildWorkspace({
        ...plan,
        proposedTasks: [],
        proposedBlocks: plan.proposedBlocks.filter(block => block.type === 'sticky-note'),
      });
      expect(noteOnly.blocks[0].layout).toMatchObject({ x: 48, y: 48, width: 279 });
      const full = buildWorkspace(plan);
      expect(full.blocks[1].layout.y).toBeGreaterThan(full.blocks[0].layout.y + full.blocks[0].layout.height);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    }
  });

  it('falls back to the entry screen for malformed stored workspace data', async () => {
    const workspace = buildWorkspace(createWorkspacePlan('Finish homepage.'));
    const valid = dashboardReducer(emptyState(), { type: 'CONFIRM_WORKSPACE_PLAN', payload: { workspace } });
    const malformed = { ...valid, workspace: { ...workspace, blocks: [{ ...workspace.blocks[0], type: 'unknown' }] } };
    const original = JSON.stringify({ version: '1.0', timestamp: Date.now(), state: malformed });
    localStorage.setItem('bloxely-dashboard-state', original);
    render(<App />);
    expect(await screen.findByRole('heading', { name: "What's on your mind?" })).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 1250));
    expect(localStorage.getItem('bloxely-dashboard-state')).toBe(original);
    fireEvent.change(screen.getByLabelText('Brain dump'), { target: { value: 'Create a valid workspace.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build my workspace' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Build workspace' }));
    await waitFor(() => expect(localStorage.getItem('bloxely-dashboard-state')).not.toBe(original), { timeout: 2500 });
    expect(loadDashboardState()?.workspace?.blocks).toHaveLength(2);
  });
});

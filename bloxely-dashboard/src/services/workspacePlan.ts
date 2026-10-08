import { widgetFactory } from './WidgetFactory';
import type { Workspace, WorkspaceBlock, WorkspacePlan, WorkspaceTask } from '../types/workspace';
import { isGeneratedBlockType } from '../types/workspace';
import { isValidTaskSuggestion } from '../utils/workspaceTaskValidation';

const id = () => crypto.randomUUID();

/** Deliberately simple: sentences become tasks; the original dump remains an editable note. */
export function createWorkspacePlan(brainDump: string): WorkspacePlan {
  const text = brainDump.trim();
  if (!text) throw new Error('Enter something to plan first.');

  const proposedTasks: WorkspaceTask[] = text
    .split(/[.!?\n]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(title => ({ id: id(), title, status: 'todo', priority: 'normal' }));
  const noteId = id();
  const tasksBlockId = id();

  return {
    id: id(),
    brainDump: text,
    proposedTasks,
    proposedNotes: [{ id: noteId, content: text }],
    proposedBlocks: [
      { id: tasksBlockId, type: 'todo', title: 'Tasks', taskIds: proposedTasks.map(task => task.id) },
      { id: id(), type: 'sticky-note', title: 'Notes', noteId },
    ],
    unresolvedItems: [],
    status: 'draft',
  };
}

export function buildWorkspace(plan: WorkspacePlan): Workspace {
  if (plan.status !== 'draft') throw new Error('This plan has already been confirmed.');
  if (!plan.proposedTasks.every(task => task.title.trim()) ||
      !plan.proposedNotes.every(note => note.content.trim())) {
    throw new Error('Tasks and notes cannot be empty.');
  }
  if (plan.proposedTasks.length + plan.proposedNotes.length === 0) {
    throw new Error('Keep at least one task or note.');
  }
  if (!plan.proposedTasks.every(isValidTaskSuggestion)) {
    throw new Error('A task has an invalid priority, due date, or estimate.');
  }
  if (plan.proposedBlocks.some(block =>
    !isGeneratedBlockType(block.type) ||
    !widgetFactory.getWidgetDefinition(block.type) || !widgetFactory.isSupported(block.type)
  )) {
    throw new Error('The plan contains an unsupported block.');
  }

  const taskIds = new Set(plan.proposedTasks.map(task => task.id));
  const noteIds = new Set(plan.proposedNotes.map(note => note.id));
  const blockDrafts = plan.proposedBlocks.filter(block =>
    block.type === 'todo' ? plan.proposedTasks.length > 0 : !!block.noteId && noteIds.has(block.noteId)
  );
  if (blockDrafts.some(block => block.type === 'todo' && block.taskIds?.some(taskId => !taskIds.has(taskId)))) {
    throw new Error('The plan references an unknown task.');
  }

  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const narrowCanvas = viewportWidth < 850;
  const taskWidth = Math.min(420, Math.max(240, viewportWidth - 96));
  const noteWidth = Math.min(300, Math.max(240, viewportWidth - 96));
  const hasTaskBlock = blockDrafts.some(block => block.type === 'todo');
  const blocks: WorkspaceBlock[] = blockDrafts.map((block, index) => {
    const noteIndex = hasTaskBlock ? index - 1 : index;
    return {
    id: block.id,
    type: block.type,
    title: block.title,
    ...(block.type === 'todo' ? { taskIds: plan.proposedTasks.map(task => task.id) } : { noteId: block.noteId }),
    layout: block.type === 'todo'
      ? { x: 48, y: 48, width: taskWidth, height: 440 }
      : narrowCanvas
        ? { x: 48, y: (hasTaskBlock ? 528 : 48) + noteIndex * 300, width: noteWidth, height: 260 }
        : { x: (hasTaskBlock ? 504 : 48) + (noteIndex % 2) * 340, y: 48 + Math.floor(noteIndex / 2) * 300, width: noteWidth, height: 260 },
    };
  });
  if (!blocks.length) throw new Error('The plan has no renderable blocks.');

  const now = new Date().toISOString();
  return {
    id: id(),
    title: 'My workspace',
    schemaVersion: 1,
    tasks: plan.proposedTasks.map(task => ({ ...task, title: task.title.trim() })),
    notes: plan.proposedNotes.map(note => ({ ...note, content: note.content.trim() })),
    blocks,
    createdAt: now,
    updatedAt: now,
  };
}

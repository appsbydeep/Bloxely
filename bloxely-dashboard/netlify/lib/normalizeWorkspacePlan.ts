import { randomUUID } from 'node:crypto';
import type { WorkspacePlan, WorkspaceTask } from '../../src/types/workspace';
import { isValidDueAt, MAX_ESTIMATED_MINUTES, MIN_ESTIMATED_MINUTES } from '../../src/utils/workspaceTaskValidation';

const MAX_TASKS = 8;
const MAX_NOTES = 8;
const MAX_UNRESOLVED = 12;

export class InvalidAiPlanError extends Error {
  constructor() { super('The AI returned an invalid workspace plan.'); }
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const cleanText = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string' || value.length > maxLength * 4) throw new InvalidAiPlanError();
  const text = Array.from(value.replace(/<[^>]*>/g, ''), character =>
    character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character).join('').trim();
  if (!text || text.length > maxLength) throw new InvalidAiPlanError();
  return text;
};

/** The model supplies content only. Bloxely owns IDs and block types. */
export function normalizeWorkspacePlan(value: unknown, brainDump: string): WorkspacePlan {
  if (!record(value) || !Array.isArray(value.tasks) || !Array.isArray(value.notes) ||
      !Array.isArray(value.unresolvedItems) || value.tasks.length > MAX_TASKS ||
      value.notes.length > MAX_NOTES || value.unresolvedItems.length > MAX_UNRESOLVED ||
      value.tasks.length + value.notes.length === 0) throw new InvalidAiPlanError();

  const tasks: WorkspaceTask[] = value.tasks.map((item: unknown) => {
    if (!record(item)) throw new InvalidAiPlanError();
    const title = cleanText(item.title, 120);
    const dueAt = item.dueAt;
    if (item.priority !== 'normal' && item.priority !== 'high' && item.priority !== 'urgent') throw new InvalidAiPlanError();
    if (item.estimatedMinutes != null &&
        (!Number.isInteger(item.estimatedMinutes) || (item.estimatedMinutes as number) < MIN_ESTIMATED_MINUTES || (item.estimatedMinutes as number) > MAX_ESTIMATED_MINUTES)) {
      throw new InvalidAiPlanError();
    }
    if (dueAt != null && (typeof dueAt !== 'string' || !isValidDueAt(dueAt))) throw new InvalidAiPlanError();
    return {
      id: randomUUID(), title, status: 'todo', priority: item.priority,
      ...(typeof dueAt === 'string' ? { dueAt } : {}),
      ...(item.estimatedMinutes ? { estimatedMinutes: item.estimatedMinutes as number } : {}),
    };
  });
  if (new Set(tasks.map(task => task.title.toLocaleLowerCase())).size !== tasks.length) throw new InvalidAiPlanError();
  const notes = value.notes.map((item: unknown) => {
    if (!record(item)) throw new InvalidAiPlanError();
    return { id: randomUUID(), content: cleanText(item.content, 2000) };
  });
  const unresolvedItems = value.unresolvedItems.map((item: unknown) => cleanText(item, 250));

  return {
    id: randomUUID(), brainDump, proposedTasks: tasks, proposedNotes: notes,
    proposedBlocks: [
      ...(tasks.length ? [{ id: randomUUID(), type: 'todo' as const, title: 'Tasks', taskIds: tasks.map(task => task.id) }] : []),
      ...notes.map(note => ({ id: randomUUID(), type: 'sticky-note' as const, title: 'Notes', noteId: note.id })),
    ],
    unresolvedItems, status: 'draft',
  };
}

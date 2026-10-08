import { randomUUID } from 'node:crypto';
import type { WorkspacePlan, WorkspaceTask } from '../../src/types/workspace';

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

const validDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() + 1 !== month || calendarDate.getUTCDate() !== day) return false;
  if (match[4] === undefined) return true;
  if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) return false;
  if (match[7] !== 'Z') {
    const offset = match[7].slice(1).split(':').map(Number);
    if (offset[0] > 23 || offset[1] > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
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
        (!Number.isInteger(item.estimatedMinutes) || (item.estimatedMinutes as number) < 5 || (item.estimatedMinutes as number) > 480)) {
      throw new InvalidAiPlanError();
    }
    if (dueAt != null && (typeof dueAt !== 'string' || !validDate(dueAt))) throw new InvalidAiPlanError();
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

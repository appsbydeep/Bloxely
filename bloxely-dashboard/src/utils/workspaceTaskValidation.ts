import type { WorkspaceTask } from '../types/workspace';

export const TASK_PRIORITIES = ['normal', 'high', 'urgent'] as const;
export const MIN_ESTIMATED_MINUTES = 5;
export const MAX_ESTIMATED_MINUTES = 480;

export const isValidDueAt = (value: string): boolean => {
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

export const isValidTaskSuggestion = (task: WorkspaceTask): boolean =>
  TASK_PRIORITIES.includes(task.priority) &&
  (task.dueAt === undefined || isValidDueAt(task.dueAt)) &&
  (task.estimatedMinutes === undefined ||
    (Number.isInteger(task.estimatedMinutes) && task.estimatedMinutes >= MIN_ESTIMATED_MINUTES &&
      task.estimatedMinutes <= MAX_ESTIMATED_MINUTES));

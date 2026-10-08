import type { WorkspacePlan } from '../types/workspace';
import { isGeneratedBlockType } from '../types/workspace';

export class AiWorkspacePlanError extends Error {
  constructor() { super("Bloxely couldn't build your plan. Try again."); }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isWorkspacePlan = (value: unknown): value is WorkspacePlan => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.brainDump !== 'string' ||
      value.status !== 'draft' || !Array.isArray(value.proposedTasks) || !Array.isArray(value.proposedNotes) ||
      !Array.isArray(value.proposedBlocks) || !Array.isArray(value.unresolvedItems)) return false;
  return value.proposedTasks.every(task => isRecord(task) && typeof task.id === 'string' &&
    typeof task.title === 'string' && task.status === 'todo' &&
    ['normal', 'high', 'urgent'].includes(String(task.priority))) &&
    value.proposedNotes.every(note => isRecord(note) && typeof note.id === 'string' && typeof note.content === 'string') &&
    value.proposedBlocks.every(block => isRecord(block) && typeof block.id === 'string' &&
      isGeneratedBlockType(block.type) && typeof block.title === 'string') &&
    value.unresolvedItems.every(item => typeof item === 'string');
};

export async function generateAiWorkspacePlan(brainDump: string, fetchImpl: typeof fetch = fetch): Promise<WorkspacePlan> {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let response: Response;
  try {
    response = await fetchImpl('/.netlify/functions/generate-workspace-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ brainDump, localDate, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }),
    });
    if (!response.ok) throw new AiWorkspacePlanError();
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isWorkspacePlan(payload.plan)) throw new AiWorkspacePlanError();
    return payload.plan;
  } catch {
    throw new AiWorkspacePlanError();
  }
}

import type { WidgetType } from './dashboard';

export const GENERATED_BLOCK_TYPES = ['todo', 'sticky-note'] as const satisfies readonly WidgetType[];
export type GeneratedBlockType = (typeof GENERATED_BLOCK_TYPES)[number];
export const isGeneratedBlockType = (value: unknown): value is GeneratedBlockType =>
  GENERATED_BLOCK_TYPES.some(type => type === value);

export interface WorkspaceTask {
  id: string;
  title: string;
  status: 'todo' | 'done';
  priority: 'normal' | 'high' | 'urgent';
  dueAt?: string;
  estimatedMinutes?: number;
}

export interface WorkspaceNote {
  id: string;
  content: string;
}

/** Pixel coordinates in the freeform canvas. */
export interface BlockLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkspaceBlock {
  id: string;
  type: GeneratedBlockType;
  title: string;
  taskIds?: string[];
  noteId?: string;
  layout: BlockLayout;
}

export interface Workspace {
  id: string;
  title: string;
  schemaVersion: 1;
  tasks: WorkspaceTask[];
  notes: WorkspaceNote[];
  blocks: WorkspaceBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspacePlan {
  id: string;
  brainDump: string;
  proposedTasks: WorkspaceTask[];
  proposedNotes: WorkspaceNote[];
  proposedBlocks: Pick<WorkspaceBlock, 'id' | 'type' | 'title' | 'taskIds' | 'noteId'>[];
  unresolvedItems: string[];
  status: 'draft' | 'confirmed';
}

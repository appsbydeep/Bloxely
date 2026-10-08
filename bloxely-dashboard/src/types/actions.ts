import type { GridLayout, WidgetType, DashboardSettings, DashboardState } from './dashboard';
import type { BlockLayout, Workspace } from './workspace';

export type DashboardAction =
  | { type: 'ADD_WIDGET'; payload: { widgetType: WidgetType; position?: { x: number; y: number } } }
  | { type: 'REMOVE_WIDGET'; payload: { widgetId: string } }
  | { type: 'UPDATE_WIDGET'; payload: { widgetId: string; content: any } }
  | { type: 'UPDATE_LAYOUT'; payload: { layout: GridLayout[] } }
  | { type: 'UPDATE_BLOCK_LAYOUT'; payload: { blockId: string; layout: BlockLayout } }
  | { type: 'CONFIRM_WORKSPACE_PLAN'; payload: { workspace: Workspace } }
  | { type: 'UPDATE_SETTINGS'; payload: { settings: Partial<DashboardSettings> } }
  | { type: 'LOAD_STATE'; payload: { state: DashboardState } }
  | { type: 'RESET_DASHBOARD' };

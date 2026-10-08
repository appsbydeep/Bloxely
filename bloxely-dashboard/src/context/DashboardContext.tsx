import React, { createContext, useContext, useReducer, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { DashboardState, DashboardSettings, WidgetData, GridLayout } from '../types/dashboard';
import type { DashboardAction } from '../types/actions';
import { loadDashboardState, isStorageAvailable, hasStoredDashboardState } from '../utils/persistence';
import { validateDashboardState, isValidWorkspace } from '../utils/validation';
import { useDebouncedPersistence } from '../hooks/useDebouncedPersistence';
import { useNotifications } from '../context/NotificationContext';
import type { Workspace, WorkspaceTask } from '../types/workspace';

// Initial state
const initialSettings: DashboardSettings = {
  theme: 'dark',
  gridCols: 12,
  gridRowHeight: 60,
  allowFreePlacement: false,
};

const initialState: DashboardState = {
  layout: [],
  widgets: {},
  settings: initialSettings,
};

// Dashboard reducer
// Exported for direct tests of atomic workspace confirmation.
// eslint-disable-next-line react-refresh/only-export-components
export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'ADD_WIDGET': {
      const { widgetType, position } = action.payload;
      const widgetId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new widget data
      const newWidget: WidgetData = {
        id: widgetId,
        type: widgetType,
        content: getDefaultContent(widgetType),
        config: { title: getDefaultTitle(widgetType) },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create layout item with default size based on widget type
      const defaultSize = getDefaultSize(widgetType);
      
      // Calculate center position if no position is specified
      const centerX = position?.x ?? Math.max(0, Math.floor((state.settings.gridCols - defaultSize.w) / 2));
      const centerY = position?.y ?? Math.max(0, Math.floor((getMaxYPosition(state.layout) + 1)));
      
      const newLayoutItem: GridLayout = {
        i: widgetId,
        x: centerX,
        y: centerY,
        w: defaultSize.w,
        h: defaultSize.h,
        minW: defaultSize.minW,
        minH: defaultSize.minH,
      };

      return {
        ...state,
        widgets: {
          ...state.widgets,
          [widgetId]: newWidget,
        },
        layout: [...state.layout, newLayoutItem],
      };
    }

    case 'REMOVE_WIDGET': {
      const { widgetId } = action.payload;
      const { [widgetId]: removedWidget, ...remainingWidgets } = state.widgets;
      
      return {
        ...state,
        widgets: remainingWidgets,
        layout: state.layout.filter(item => item.i !== widgetId),
        workspace: state.workspace ? {
          ...state.workspace,
          blocks: state.workspace.blocks.filter(block => block.id !== widgetId),
          updatedAt: new Date().toISOString(),
        } : undefined,
      };
    }

    case 'UPDATE_WIDGET': {
      const { widgetId, content } = action.payload;
      
      if (!state.widgets[widgetId]) {
        return state;
      }

      const block = state.workspace?.blocks.find(item => item.id === widgetId);
      let workspace = state.workspace;
      if (workspace && block?.type === 'todo' && Array.isArray(content?.tasks)) {
        const previous = new Map(workspace.tasks.map(task => [task.id, task]));
        const tasks: WorkspaceTask[] = content.tasks.map((task: { id: string; text: string; completed: boolean }) => ({
          id: task.id,
          title: task.text,
          status: task.completed ? 'done' : 'todo',
          priority: previous.get(task.id)?.priority ?? 'normal',
          ...(previous.get(task.id)?.dueAt ? { dueAt: previous.get(task.id)?.dueAt } : {}),
          ...(previous.get(task.id)?.estimatedMinutes ? { estimatedMinutes: previous.get(task.id)?.estimatedMinutes } : {}),
        }));
        workspace = { ...workspace, tasks, updatedAt: new Date().toISOString() };
      } else if (workspace && block?.type === 'sticky-note' && block.noteId && typeof content?.content === 'string') {
        workspace = {
          ...workspace,
          notes: workspace.notes.map(note => note.id === block.noteId ? { ...note, content: content.content } : note),
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...state,
        workspace,
        widgets: {
          ...state.widgets,
          [widgetId]: {
            ...state.widgets[widgetId],
            content,
            updatedAt: new Date(),
          },
        },
      };
    }

    case 'UPDATE_LAYOUT': {
      const { layout } = action.payload;
      
      return {
        ...state,
        layout,
      };
    }

    case 'UPDATE_BLOCK_LAYOUT': {
      if (!state.workspace?.blocks.some(block => block.id === action.payload.blockId)) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          blocks: state.workspace.blocks.map(block => block.id === action.payload.blockId
            ? { ...block, layout: action.payload.layout } : block),
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case 'CONFIRM_WORKSPACE_PLAN': {
      const workspace: Workspace = action.payload.workspace;
      if (!isValidWorkspace(workspace)) return state;
      const now = new Date();
      const widgets = { ...state.widgets };
      for (const block of workspace.blocks) {
        const content = block.type === 'todo'
          ? { tasks: workspace.tasks.map(task => ({
              id: task.id, text: task.title, completed: task.status === 'done', createdAt: now,
            })) }
          : { content: workspace.notes.find(note => note.id === block.noteId)?.content ?? '',
              color: getDefaultContent('sticky-note').color };
        widgets[block.id] = {
          id: block.id, type: block.type, content, config: { title: block.title },
          createdAt: now, updatedAt: now,
        };
      }
      return { ...state, workspace, widgets };
    }

    case 'UPDATE_SETTINGS': {
      const { settings } = action.payload;
      
      return {
        ...state,
        settings: {
          ...state.settings,
          ...settings,
        },
      };
    }

    case 'LOAD_STATE': {
      const { state: loadedState } = action.payload;
      
      return {
        ...initialState,
        ...loadedState,
      };
    }

    case 'RESET_DASHBOARD': {
      return initialState;
    }

    default:
      return state;
  }
}

// Import widget factory for default values
import { widgetFactory } from '../services/WidgetFactory';

// Helper functions
function getDefaultContent(widgetType: string) {
  const definition = widgetFactory.getWidgetDefinition(widgetType as any);
  return definition?.defaultContent || {};
}

function getDefaultTitle(widgetType: string): string {
  const definition = widgetFactory.getWidgetDefinition(widgetType as any);
  return definition?.defaultConfig.title || 'Widget';
}

function getDefaultSize(widgetType: string) {
  return widgetFactory.getDefaultSize(widgetType as any);
}

// Helper function to find the maximum Y position in the current layout
function getMaxYPosition(layout: GridLayout[]): number {
  if (layout.length === 0) return 0;
  return Math.max(...layout.map(item => item.y + item.h));
}

// Context
interface DashboardContextType {
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
  isLoading: boolean;
  persistenceEnabled: boolean;
  forceSave: () => boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Provider component
interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [persistenceBlockedBecauseLoadFailed, setPersistenceBlockedBecauseLoadFailed] = useState(false);
  const blockedStateRef = useRef<DashboardState | null>(null);
  const { showError, showWarning, showSuccess } = useNotifications();

  // Initialize persistence and load saved state
  useEffect(() => {
    const initializePersistence = async () => {
      try {
        // Check if localStorage is available
        const storageAvailable = isStorageAvailable();
        setPersistenceEnabled(storageAvailable);

        if (storageAvailable) {
          // Try to load saved state
          const hadSavedState = hasStoredDashboardState();
          const savedState = loadDashboardState();
          
          if (savedState) {
            // Validate loaded state
            const validation = validateDashboardState(savedState);
            
            if (validation.isValid) {
              console.log('Restoring dashboard state from localStorage');
              dispatch({ type: 'LOAD_STATE', payload: { state: savedState } });
              showSuccess('Dashboard Restored', 'Your workspace has been restored from local storage.');
            } else {
              blockedStateRef.current = initialState;
              setPersistenceBlockedBecauseLoadFailed(true);
              console.warn('Loaded state is invalid:', validation.errors);
              showWarning(
                'Invalid Data Detected',
                'Some saved data was corrupted and has been reset to defaults.',
                { duration: 8000 }
              );
              // Use default state instead
            }
          } else {
            if (hadSavedState) {
              blockedStateRef.current = initialState;
              setPersistenceBlockedBecauseLoadFailed(true);
            }
            console.log('No saved state found, using default state');
          }
        } else {
          console.warn('localStorage not available, persistence disabled');
          showWarning(
            'Auto-save Disabled',
            'Local storage is not available. Your changes will not be saved.',
            { persistent: true }
          );
        }
      } catch (error) {
        console.error('Failed to initialize persistence:', error);
        setPersistenceEnabled(false);
        showError(
          'Initialization Error',
          'Failed to initialize the dashboard. Some features may not work correctly.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializePersistence();
  }, [showError, showWarning, showSuccess]);

  useEffect(() => {
    if (persistenceBlockedBecauseLoadFailed && state !== blockedStateRef.current &&
        validateDashboardState(state).isValid) {
      blockedStateRef.current = null;
      setPersistenceBlockedBecauseLoadFailed(false);
    }
  }, [state, persistenceBlockedBecauseLoadFailed]);

  // Set up debounced persistence
  const { forceSave } = useDebouncedPersistence(state, {
    enabled: persistenceEnabled && !isLoading && !persistenceBlockedBecauseLoadFailed,
    delay: 1000
  });

  return (
    <DashboardContext.Provider 
      value={{ 
        state, 
        dispatch, 
        isLoading, 
        persistenceEnabled: persistenceEnabled && !persistenceBlockedBecauseLoadFailed,
        forceSave 
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

// Custom hook
export function useDashboard() {
  const context = useContext(DashboardContext);
  
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  
  return context;
}

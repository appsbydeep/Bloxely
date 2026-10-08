import type { DashboardState } from '../types/dashboard';
import type { Workspace } from '../types/workspace';
import { isGeneratedBlockType } from '../types/workspace';
import { widgetFactory } from '../services/WidgetFactory';

export const isValidWorkspace = (value: unknown): value is Workspace => {
  if (!value || typeof value !== 'object') return false;
  const workspace = value as Partial<Workspace>;
  if (workspace.schemaVersion !== 1 || typeof workspace.id !== 'string' ||
      typeof workspace.title !== 'string' || typeof workspace.createdAt !== 'string' ||
      typeof workspace.updatedAt !== 'string' || !Array.isArray(workspace.tasks) ||
      !Array.isArray(workspace.notes) || !Array.isArray(workspace.blocks)) return false;
  const tasks = workspace.tasks;
  const notes = workspace.notes;
  if (!tasks.every(task => task && typeof task.id === 'string' && typeof task.title === 'string' &&
      ['todo', 'done'].includes(task.status) && ['normal', 'high', 'urgent'].includes(task.priority))) return false;
  if (!notes.every(note => note && typeof note.id === 'string' && typeof note.content === 'string')) return false;
  const taskIds = new Set(tasks.map(task => task.id));
  const noteIds = new Set(notes.map(note => note.id));
  return workspace.blocks.every(block => block && typeof block.id === 'string' &&
    isGeneratedBlockType(block.type) &&
    widgetFactory.getWidgetDefinition(block.type) && widgetFactory.isSupported(block.type) &&
    typeof block.title === 'string' && block.layout &&
    [block.layout.x, block.layout.y, block.layout.width, block.layout.height].every(Number.isFinite) &&
    block.layout.width > 0 && block.layout.height > 0 &&
    (block.type === 'todo' ? Array.isArray(block.taskIds) && block.taskIds.every(id => taskIds.has(id))
      : typeof block.noteId === 'string' && noteIds.has(block.noteId)));
};

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates widget data structure and content
 */
export const validateWidget = (widget: any): ValidationResult => {
  const errors: ValidationError[] = [];

  // Check required fields
  if (!widget) {
    errors.push({
      field: 'widget',
      message: 'Widget data is required',
      code: 'REQUIRED',
    });
    return { isValid: false, errors };
  }

  if (!widget.id || typeof widget.id !== 'string') {
    errors.push({
      field: 'id',
      message: 'Widget ID must be a non-empty string',
      code: 'INVALID_TYPE',
    });
  }

  if (!widget.type || typeof widget.type !== 'string') {
    errors.push({
      field: 'type',
      message: 'Widget type must be a non-empty string',
      code: 'INVALID_TYPE',
    });
  }

  if (!widget.config || typeof widget.config !== 'object') {
    errors.push({
      field: 'config',
      message: 'Widget config must be an object',
      code: 'INVALID_TYPE',
    });
  }

  if (!widget.createdAt || !(widget.createdAt instanceof Date)) {
    errors.push({
      field: 'createdAt',
      message: 'Widget createdAt must be a Date object',
      code: 'INVALID_TYPE',
    });
  }

  if (!widget.updatedAt || !(widget.updatedAt instanceof Date)) {
    errors.push({
      field: 'updatedAt',
      message: 'Widget updatedAt must be a Date object',
      code: 'INVALID_TYPE',
    });
  }

  // Validate widget-specific content
  if (widget.type && widget.content) {
    const contentValidation = validateWidgetContent(widget.type, widget.content);
    errors.push(...contentValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates widget content based on widget type
 */
export const validateWidgetContent = (widgetType: string, content: any): ValidationResult => {
  const errors: ValidationError[] = [];

  switch (widgetType) {
    case 'clock':
      if (content.format && !['12h', '24h'].includes(content.format)) {
        errors.push({
          field: 'content.format',
          message: 'Clock format must be "12h" or "24h"',
          code: 'INVALID_VALUE',
        });
      }
      if (content.showDate !== undefined && typeof content.showDate !== 'boolean') {
        errors.push({
          field: 'content.showDate',
          message: 'Clock showDate must be a boolean',
          code: 'INVALID_TYPE',
        });
      }
      break;

    case 'todo':
      if (content.tasks && !Array.isArray(content.tasks)) {
        errors.push({
          field: 'content.tasks',
          message: 'Todo tasks must be an array',
          code: 'INVALID_TYPE',
        });
      } else if (content.tasks) {
        content.tasks.forEach((task: any, index: number) => {
          if (!task.id || typeof task.id !== 'string') {
            errors.push({
              field: `content.tasks[${index}].id`,
              message: 'Task ID must be a non-empty string',
              code: 'INVALID_TYPE',
            });
          }
          if (!task.text || typeof task.text !== 'string') {
            errors.push({
              field: `content.tasks[${index}].text`,
              message: 'Task text must be a non-empty string',
              code: 'INVALID_TYPE',
            });
          }
          if (typeof task.completed !== 'boolean') {
            errors.push({
              field: `content.tasks[${index}].completed`,
              message: 'Task completed must be a boolean',
              code: 'INVALID_TYPE',
            });
          }
        });
      }
      break;

    case 'sticky-note':
      if (content.content !== undefined && typeof content.content !== 'string') {
        errors.push({
          field: 'content.content',
          message: 'Sticky note content must be a string',
          code: 'INVALID_TYPE',
        });
      }
      if (content.color && (!content.color.name || !content.color.gradient)) {
        errors.push({
          field: 'content.color',
          message: 'Sticky note color must have name and gradient properties',
          code: 'INVALID_STRUCTURE',
        });
      }
      break;

    case 'pomodoro':
      if (content.workDuration !== undefined && (typeof content.workDuration !== 'number' || content.workDuration <= 0)) {
        errors.push({
          field: 'content.workDuration',
          message: 'Pomodoro work duration must be a positive number',
          code: 'INVALID_VALUE',
        });
      }
      if (content.breakDuration !== undefined && (typeof content.breakDuration !== 'number' || content.breakDuration <= 0)) {
        errors.push({
          field: 'content.breakDuration',
          message: 'Pomodoro break duration must be a positive number',
          code: 'INVALID_VALUE',
        });
      }
      if (content.isRunning !== undefined && typeof content.isRunning !== 'boolean') {
        errors.push({
          field: 'content.isRunning',
          message: 'Pomodoro isRunning must be a boolean',
          code: 'INVALID_TYPE',
        });
      }
      break;

    case 'kanban':
      if (content.columns && !Array.isArray(content.columns)) {
        errors.push({
          field: 'content.columns',
          message: 'Kanban columns must be an array',
          code: 'INVALID_TYPE',
        });
      } else if (content.columns) {
        content.columns.forEach((column: any, columnIndex: number) => {
          if (!column.id || typeof column.id !== 'string') {
            errors.push({
              field: `content.columns[${columnIndex}].id`,
              message: 'Column ID must be a non-empty string',
              code: 'INVALID_TYPE',
            });
          }
          if (!column.title || typeof column.title !== 'string') {
            errors.push({
              field: `content.columns[${columnIndex}].title`,
              message: 'Column title must be a non-empty string',
              code: 'INVALID_TYPE',
            });
          }
          if (column.tasks && !Array.isArray(column.tasks)) {
            errors.push({
              field: `content.columns[${columnIndex}].tasks`,
              message: 'Column tasks must be an array',
              code: 'INVALID_TYPE',
            });
          }
        });
      }
      if (content.searchQuery !== undefined && typeof content.searchQuery !== 'string') {
        errors.push({
          field: 'content.searchQuery',
          message: 'Search query must be a string',
          code: 'INVALID_TYPE',
        });
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates grid layout configuration
 */
export const validateGridLayout = (layout: any[]): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!Array.isArray(layout)) {
    errors.push({
      field: 'layout',
      message: 'Layout must be an array',
      code: 'INVALID_TYPE',
    });
    return { isValid: false, errors };
  }

  layout.forEach((item: any, index: number) => {
    if (!item.i || typeof item.i !== 'string') {
      errors.push({
        field: `layout[${index}].i`,
        message: 'Layout item ID must be a non-empty string',
        code: 'INVALID_TYPE',
      });
    }

    ['x', 'y', 'w', 'h'].forEach((prop) => {
      if (typeof item[prop] !== 'number' || item[prop] < 0) {
        errors.push({
          field: `layout[${index}].${prop}`,
          message: `Layout item ${prop} must be a non-negative number`,
          code: 'INVALID_VALUE',
        });
      }
    });

    // Validate optional properties
    if (item.minW !== undefined && (typeof item.minW !== 'number' || item.minW < 0)) {
      errors.push({
        field: `layout[${index}].minW`,
        message: 'Layout item minW must be a non-negative number',
        code: 'INVALID_VALUE',
      });
    }

    if (item.minH !== undefined && (typeof item.minH !== 'number' || item.minH < 0)) {
      errors.push({
        field: `layout[${index}].minH`,
        message: 'Layout item minH must be a non-negative number',
        code: 'INVALID_VALUE',
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates complete dashboard state
 */
export const validateDashboardState = (state: DashboardState | any): ValidationResult => {
  const errors: ValidationError[] = [];

  if (!state) {
    errors.push({
      field: 'state',
      message: 'Dashboard state is required',
      code: 'REQUIRED',
    });
    return { isValid: false, errors };
  }

  if (state.workspace !== undefined && !isValidWorkspace(state.workspace)) {
    errors.push({ field: 'workspace', message: 'Workspace data is invalid', code: 'INVALID_STRUCTURE' });
  } else if (state.workspace && state.widgets && typeof state.widgets === 'object') {
    for (const block of state.workspace.blocks) {
      const widget = state.widgets[block.id];
      if (!widget || widget.id !== block.id || widget.type !== block.type) {
        errors.push({ field: `workspace.blocks.${block.id}`, message: 'Workspace block has no matching widget', code: 'INVALID_STRUCTURE' });
      }
    }
  }

  // Validate layout
  if (state.layout) {
    const layoutValidation = validateGridLayout(state.layout);
    errors.push(...layoutValidation.errors);
  }

  // Validate widgets
  if (!state.widgets || typeof state.widgets !== 'object') {
    errors.push({
      field: 'widgets',
      message: 'Widgets must be an object',
      code: 'INVALID_TYPE',
    });
  } else {
    Object.entries(state.widgets).forEach(([id, widget]) => {
      const widgetValidation = validateWidget(widget);
      errors.push(...widgetValidation.errors.map(error => ({
        ...error,
        field: `widgets.${id}.${error.field}`,
      })));
    });
  }

  // Validate settings
  if (state.settings) {
    if (state.settings.theme && !['light', 'dark'].includes(state.settings.theme)) {
      errors.push({
        field: 'settings.theme',
        message: 'Theme must be "light" or "dark"',
        code: 'INVALID_VALUE',
      });
    }

    if (state.settings.gridCols !== undefined && (typeof state.settings.gridCols !== 'number' || state.settings.gridCols <= 0)) {
      errors.push({
        field: 'settings.gridCols',
        message: 'Grid columns must be a positive number',
        code: 'INVALID_VALUE',
      });
    }

    if (state.settings.gridRowHeight !== undefined && (typeof state.settings.gridRowHeight !== 'number' || state.settings.gridRowHeight <= 0)) {
      errors.push({
        field: 'settings.gridRowHeight',
        message: 'Grid row height must be a positive number',
        code: 'INVALID_VALUE',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitizes widget content to prevent XSS and other security issues
 */
export const sanitizeWidgetContent = (widgetType: string, content: any): any => {
  if (!content || typeof content !== 'object') {
    return content;
  }

  const sanitized = { ...content };

  // Sanitize string fields to prevent XSS
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };

  switch (widgetType) {
    case 'todo':
      if (sanitized.tasks && Array.isArray(sanitized.tasks)) {
        sanitized.tasks = sanitized.tasks.map((task: any) => ({
          ...task,
          text: sanitizeString(task.text),
        }));
      }
      break;

    case 'sticky-note':
      if (sanitized.content) {
        sanitized.content = sanitizeString(sanitized.content);
      }
      break;

    case 'kanban':
      if (sanitized.columns && Array.isArray(sanitized.columns)) {
        sanitized.columns = sanitized.columns.map((column: any) => ({
          ...column,
          title: sanitizeString(column.title),
          tasks: column.tasks ? column.tasks.map((task: any) => ({
            ...task,
            title: sanitizeString(task.title),
            description: sanitizeString(task.description),
            assignee: task.assignee ? {
              ...task.assignee,
              name: sanitizeString(task.assignee.name),
            } : task.assignee,
          })) : [],
        }));
      }
      if (sanitized.searchQuery) {
        sanitized.searchQuery = sanitizeString(sanitized.searchQuery);
      }
      if (sanitized.assigneeFilter) {
        sanitized.assigneeFilter = sanitizeString(sanitized.assigneeFilter);
      }
      break;
  }

  return sanitized;
};

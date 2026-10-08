import type { Workspace } from './workspace';

export type WidgetType = 'clock' | 'sticky-note' | 'todo' | 'pomodoro' | 'kanban' |
                         'music-player' | 'custom-wallpaper' | 'personal-image' | 'habit-tracker' | 'image-collector' | 'priority-matrix' | 'youtube-player' | 'calendar' | 'voice-text-notes';

export interface GridLayout {
  i: string; // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetConfig {
  title?: string;
  [key: string]: any;
}

export interface WidgetData {
  id: string;
  type: WidgetType;
  content: any;
  config: WidgetConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardSettings {
  theme: 'dark' | 'light';
  gridCols: number;
  gridRowHeight: number;
  // When true, widgets can be placed freely without automatic vertical compaction or collision prevention
  allowFreePlacement?: boolean;
}

export interface DashboardState {
  layout: GridLayout[];
  widgets: Record<string, WidgetData>;
  settings: DashboardSettings;
  workspace?: Workspace;
}

// Widget-specific data types
export interface TodoData {
  tasks: Task[];
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

export interface StickyNoteColor {
  name: string;
  gradient: string;
}

export interface StickyNoteData {
  content: string;
  color: StickyNoteColor;
}


export interface PomodoroData {
  timeRemaining: number;
  isRunning: boolean;
  mode: 'work' | 'break';
  colorTheme?: 'red' | 'green' | 'black' | 'yellow';
  workDuration: number;
  breakDuration: number;
}

export interface ClockData {
  format: '12h' | '24h';
  showDate: boolean;
  timeColor?: string;
  dateColor?: string;
  backgroundColor?: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  priority: 'normal' | 'urgent' | 'high';
  column: 'todo' | 'progress' | 'done';
  createdAt: Date;
}

export interface KanbanData {
  tasks: KanbanTask[];
}

// New productivity widget data types

export interface MusicStation {
  id: string;
  name: string;
  description: string;
  source: 'youtube' | 'soundcloud' | 'spotify' | 'local';
  streamUrl: string;
  thumbnail: string;
  category: 'lofi' | 'ambient' | 'jazz' | 'nature';
  isLive: boolean;
}

export interface SleepTimerConfig {
  enabled: boolean;
  duration: number; // minutes
  remaining: number;
}

export interface MusicPlayerData {
  currentStation: MusicStation | null;
  volume: number;
  isPlaying: boolean;
  isMinimized: boolean;
  sleepTimer: SleepTimerConfig;
  favoriteStations: string[];
}



export interface SavedImage {
  id: string;
  name: string;
  dataUrl: string; // Base64 encoded image
  thumbnail: string; // Compressed Base64 thumbnail
  fileSize: number;
  mimeType: string;
  createdAt: Date;
}

export interface ImageCollectorData {
  images: SavedImage[];
  maxImages: number; // Default: 20
  thumbnailSize: number; // Default: 150px
}

export interface PriorityMatrixData {
  tasks: PriorityMatrixTask[];
}

export interface PriorityMatrixTask {
  id: string;
  content: string;
  quadrant: 'do-first' | 'schedule' | 'delegate' | 'eliminate';
  createdAt: Date;
}

export interface YouTubePlayerData {
  videoId: string;
  isPlaying: boolean;
  volume: number;
}

export interface CalendarTask {
  id: string;
  content: string;
  type: 'normal' | 'emergency';
  date: string; // YYYY-MM-DD format
}

export interface CalendarData {
  currentDate: string; // YYYY-MM-DD format for current month view
  tasks: CalendarTask[];
}



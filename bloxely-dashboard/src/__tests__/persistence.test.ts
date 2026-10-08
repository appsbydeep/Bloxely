import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveDashboardState,
  loadDashboardState,
  clearDashboardState,
  isStorageAvailable,
  getStorageInfo
} from '../utils/persistence';
import type { DashboardState } from '../types/dashboard';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock console methods
const consoleMock = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
};

Object.defineProperty(console, 'log', { value: consoleMock.log });
Object.defineProperty(console, 'error', { value: consoleMock.error });
Object.defineProperty(console, 'warn', { value: consoleMock.warn });

describe('Persistence Utils', () => {
  const mockDashboardState: DashboardState = {
    layout: [
      { i: 'widget-1', x: 0, y: 0, w: 4, h: 3 }
    ],
    widgets: {
      'widget-1': {
        id: 'widget-1',
        type: 'clock',
        content: { format: '12h', showDate: true },
        config: { title: 'Clock' },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      }
    },
    settings: {
      theme: 'dark',
      gridCols: 12,
      gridRowHeight: 60
    }
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('saveDashboardState', () => {
    it('should save dashboard state successfully', () => {
      const result = saveDashboardState(mockDashboardState);
      
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'bloxely-dashboard-state',
        expect.stringContaining('"version":"1.0"')
      );
      expect(consoleMock.log).toHaveBeenCalledWith('Dashboard state saved successfully');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const result = saveDashboardState(mockDashboardState);
      
      expect(result).toBe(false);
      expect(consoleMock.error).toHaveBeenCalledWith(
        'Failed to save dashboard state:',
        expect.any(Error)
      );
    });

    it('should handle quota exceeded error', () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.name = 'QuotaExceededError';
      
      localStorageMock.setItem
        .mockImplementationOnce(() => { throw quotaError; })
        .mockImplementationOnce(() => {}); // Second call succeeds

      const result = saveDashboardState(mockDashboardState);
      
      expect(result).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('bloxely-dashboard-state');
      expect(consoleMock.warn).toHaveBeenCalledWith(
        'localStorage quota exceeded. Attempting to clear old data...'
      );
    });
  });

  describe('loadDashboardState', () => {
    it('should load dashboard state successfully', () => {
      // Save state first
      saveDashboardState(mockDashboardState);
      
      const result = loadDashboardState();
      
      expect(result).toBeTruthy();
      expect(result?.layout).toEqual(mockDashboardState.layout);
      expect(result?.widgets['widget-1'].id).toBe('widget-1');
      expect(result?.widgets['widget-1'].createdAt).toBeInstanceOf(Date);
      expect(consoleMock.log).toHaveBeenCalledWith('Dashboard state loaded successfully');
    });

    it('should return null when no saved state exists', () => {
      const result = loadDashboardState();
      
      expect(result).toBeNull();
      expect(consoleMock.log).toHaveBeenCalledWith('No saved dashboard state found');
    });

    it('should handle version mismatch', () => {
      const invalidData = {
        version: '0.9',
        timestamp: Date.now(),
        state: mockDashboardState
      };
      
      localStorageMock.setItem('bloxely-dashboard-state', JSON.stringify(invalidData));
      
      const result = loadDashboardState();
      
      expect(result).toBeNull();
      expect(consoleMock.warn).toHaveBeenCalledWith(
        'Storage version mismatch. Expected 1.0, got 0.9'
      );
    });

    it('should handle corrupted data', () => {
      localStorageMock.setItem('bloxely-dashboard-state', 'invalid json');
      
      const result = loadDashboardState();
      
      expect(result).toBeNull();
      expect(consoleMock.error).toHaveBeenCalledWith(
        'Failed to load dashboard state:',
        expect.any(Error)
      );
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('bloxely-dashboard-state');
      expect(localStorageMock.getItem('bloxely-dashboard-state')).toBe('invalid json');
    });

    it('should handle invalid state structure', () => {
      const invalidState = {
        version: '1.0',
        timestamp: Date.now(),
        state: { invalid: 'structure' }
      };
      
      localStorageMock.setItem('bloxely-dashboard-state', JSON.stringify(invalidState));
      
      const result = loadDashboardState();
      
      expect(result).toBeNull();
      expect(consoleMock.warn).toHaveBeenCalledWith(
        'Invalid state structure in localStorage'
      );
    });
  });

  describe('clearDashboardState', () => {
    it('should clear dashboard state successfully', () => {
      saveDashboardState(mockDashboardState);
      
      const result = clearDashboardState();
      
      expect(result).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('bloxely-dashboard-state');
      expect(consoleMock.log).toHaveBeenCalledWith('Dashboard state cleared successfully');
    });

    it('should handle clear errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Clear error');
      });

      const result = clearDashboardState();
      
      expect(result).toBe(false);
      expect(consoleMock.error).toHaveBeenCalledWith(
        'Failed to clear dashboard state:',
        expect.any(Error)
      );
    });
  });

  describe('isStorageAvailable', () => {
    it('should return true when localStorage is available', () => {
      const result = isStorageAvailable();
      
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('__storage_test__', 'test');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('__storage_test__');
    });

    it('should return false when localStorage throws error', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage not available');
      });

      const result = isStorageAvailable();
      
      expect(result).toBe(false);
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage info when data exists', () => {
      saveDashboardState(mockDashboardState);
      
      const info = getStorageInfo();
      
      expect(info.exists).toBe(true);
      expect(info.size).toBeGreaterThan(0);
      expect(info.sizeKB).toBeGreaterThan(0);
      expect(info.timestamp).toBeTypeOf('number');
    });

    it('should return empty info when no data exists', () => {
      const info = getStorageInfo();
      
      expect(info.exists).toBe(false);
      expect(info.size).toBe(0);
      expect(info.sizeKB).toBe(0);
      expect(info.timestamp).toBeNull();
    });

    it('should handle errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const info = getStorageInfo();
      
      expect(info.exists).toBe(false);
      expect(info.size).toBe(0);
      expect(consoleMock.error).toHaveBeenCalledWith(
        'Failed to get storage info:',
        expect.any(Error)
      );
    });
  });
});

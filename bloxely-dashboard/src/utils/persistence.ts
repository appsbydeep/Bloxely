import type { DashboardState } from '../types/dashboard';

const STORAGE_KEY = 'bloxely-dashboard-state';
const STORAGE_VERSION = '1.0';

export const hasStoredDashboardState = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

export interface StorageData {
  version: string;
  timestamp: number;
  state: DashboardState;
}

/**
 * Save dashboard state to localStorage with error handling
 */
export const saveDashboardState = (state: DashboardState, showNotification?: (type: 'success' | 'error', title: string, message?: string) => void): boolean => {
  try {
    const storageData: StorageData = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      state
    };
    
    const serializedData = JSON.stringify(storageData);
    localStorage.setItem(STORAGE_KEY, serializedData);
    
    console.log('Dashboard state saved successfully');
    return true;
  } catch (error) {
    console.error('Failed to save dashboard state:', error);
    
    // Handle quota exceeded error
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Attempting to clear old data...');
      showNotification?.('error', 'Storage Full', 'Clearing old data to make space...');
      
      try {
        localStorage.removeItem(STORAGE_KEY);
        const storageData: StorageData = {
          version: STORAGE_VERSION,
          timestamp: Date.now(),
          state
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
        console.log('Dashboard state saved after clearing old data');
        showNotification?.('success', 'Storage Cleared', 'Dashboard saved successfully after clearing old data.');
        return true;
      } catch (retryError) {
        console.error('Failed to save even after clearing:', retryError);
        showNotification?.('error', 'Save Failed', 'Unable to save dashboard even after clearing storage.');
      }
    } else {
      showNotification?.('error', 'Save Failed', 'Failed to save dashboard to local storage.');
    }
    
    return false;
  }
};

/**
 * Load dashboard state from localStorage with error handling and migration
 */
export const loadDashboardState = (): DashboardState | null => {
  try {
    const serializedData = localStorage.getItem(STORAGE_KEY);
    
    if (!serializedData) {
      console.log('No saved dashboard state found');
      return null;
    }
    
    const storageData: StorageData = JSON.parse(serializedData);
    
    // Version check and migration
    if (storageData.version !== STORAGE_VERSION) {
      console.warn(`Storage version mismatch. Expected ${STORAGE_VERSION}, got ${storageData.version}`);
      // For now, we'll just return null and let the app use defaults
      // In the future, we could implement migration logic here
      return null;
    }
    
    // Validate that we have a valid state structure
    if (!storageData.state || !storageData.state.layout || !storageData.state.widgets) {
      console.warn('Invalid state structure in localStorage');
      return null;
    }
    
    // Convert date strings back to Date objects for widgets
    const restoredState = {
      ...storageData.state,
      widgets: Object.fromEntries(
        Object.entries(storageData.state.widgets).map(([id, widget]) => [
          id,
          {
            ...widget,
            createdAt: new Date(widget.createdAt),
            updatedAt: new Date(widget.updatedAt)
          }
        ])
      )
    };
    
    console.log('Dashboard state loaded successfully');
    return restoredState;
  } catch (error) {
    console.error('Failed to load dashboard state:', error);
    
    // Preserve the original value for recovery instead of deleting it.
    return null;
  }
};

/**
 * Clear all saved dashboard data
 */
export const clearDashboardState = (): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Dashboard state cleared successfully');
    return true;
  } catch (error) {
    console.error('Failed to clear dashboard state:', error);
    return false;
  }
};

/**
 * Check if localStorage is available and working
 */
export const isStorageAvailable = (): boolean => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get storage usage information
 */
export const getStorageInfo = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const size = data ? new Blob([data]).size : 0;
    const sizeKB = Math.round(size / 1024 * 100) / 100;
    
    return {
      exists: !!data,
      size: size,
      sizeKB: sizeKB,
      timestamp: data ? JSON.parse(data).timestamp : null
    };
  } catch (error) {
    console.error('Failed to get storage info:', error);
    return {
      exists: false,
      size: 0,
      sizeKB: 0,
      timestamp: null
    };
  }
};

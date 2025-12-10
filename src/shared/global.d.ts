import { IPCChannels, DailyNote, AppSettings } from './types';

declare global {
  interface Window {
    electronAPI: {
      saveDailyNote: (note: DailyNote) => Promise<{ success: boolean; error?: string }>;
      loadDailyNote: (date: string) => Promise<string | null>;
      selectNotesFolder: () => Promise<string | null>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<void>;
      getVersion: () => Promise<string>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      moveWindow: (deltaX: number, deltaY: number) => Promise<void>;
      toggleWindow: () => Promise<void>;
    };
  }
}

export {};


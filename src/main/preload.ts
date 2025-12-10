import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannels, DailyNote, AppSettings } from './shared/types';

const electronAPI = {
  // Notes
  saveDailyNote: (note: DailyNote) => 
    ipcRenderer.invoke('save-daily-note', note),
  
  loadDailyNote: (date: string) => 
    ipcRenderer.invoke('load-daily-note', date),
  
  selectNotesFolder: () => 
    ipcRenderer.invoke('select-notes-folder'),

  // Settings
  getSettings: (): Promise<AppSettings> => 
    ipcRenderer.invoke('get-settings'),
  
  saveSettings: (settings: AppSettings) => 
    ipcRenderer.invoke('save-settings', settings),

  // App info
  getVersion: () => 
    ipcRenderer.invoke('get-version'),

  // Window controls
  minimizeWindow: () => 
    ipcRenderer.invoke('minimize-window'),
  
  maximizeWindow: () => 
    ipcRenderer.invoke('maximize-window'),
  
  closeWindow: () => 
    ipcRenderer.invoke('close-window'),
  
  moveWindow: (deltaX: number, deltaY: number) =>
    ipcRenderer.invoke('move-window', deltaX, deltaY),
  
  getWindowPosition: (): Promise<[number, number]> =>
    ipcRenderer.invoke('get-window-position'),
  
  setWindowPosition: (x: number, y: number) =>
    ipcRenderer.invoke('set-window-position', x, y),
  
  toggleWindow: () =>
    ipcRenderer.invoke('toggle-window'),

  // Microphone permissions
  checkMicrophonePermission: (): Promise<{ granted: boolean; status?: string }> =>
    ipcRenderer.invoke('check-microphone-permission'),
  
  requestMicrophonePermission: (): Promise<boolean> =>
    ipcRenderer.invoke('request-microphone-permission'),

  // Vosk model management
  selectVoskModelFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('select-vosk-model-folder'),
  
  validateVoskModel: (modelPath: string): Promise<boolean> =>
    ipcRenderer.invoke('validate-vosk-model', modelPath),

  downloadVoskModel: (language: string, modelSize?: 'small' | 'large'): Promise<{ success: boolean; modelPath?: string; error?: string; message?: string }> =>
    ipcRenderer.invoke('download-vosk-model', language, modelSize),

  onVoskModelDownloadProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('vosk-model-download-progress', (_event, progress) => callback(progress));
  },

  removeVoskModelDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('vosk-model-download-progress');
  },

  // Vosk speech recognition
  voskInitialize: (modelPath: string): Promise<boolean> =>
    ipcRenderer.invoke('vosk-initialize', modelPath),
  
  voskRecognize: (audioBuffer: ArrayBuffer): Promise<{ text: string; isFinal: boolean }> =>
    ipcRenderer.invoke('vosk-recognize', audioBuffer),
  
  voskGetFinalResult: (): Promise<string> =>
    ipcRenderer.invoke('vosk-get-final-result'),
  
  voskReset: (): Promise<void> =>
    ipcRenderer.invoke('vosk-reset'),
  
  voskCleanup: (): Promise<void> =>
    ipcRenderer.invoke('vosk-cleanup'),
  
  voskIsReady: (): Promise<boolean> =>
    ipcRenderer.invoke('vosk-is-ready')
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}


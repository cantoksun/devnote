export const DEFAULT_SETTINGS = {
  theme: 'dark' as const,
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  notesFolder: '',
  autoSaveNotes: true,
  language: 'tr' as const,
  selectedAI: 'openai',
  alwaysOnTop: false,
  speechRecognitionProvider: 'web-speech' as const,
  minimizeToTray: false,
  globalHotkey: ''
};

export const APP_VERSION = '1.0.0';

export const CURSOR_THEME_COLORS = {
  light: {
    background: '#ffffff',
    text: '#1a1a1a',
    border: '#e0e0e0',
    button: '#007acc',
    buttonHover: '#005a9e',
    input: '#f5f5f5'
  },
  dark: {
    background: '#1e1e1e',
    text: '#d4d4d4',
    border: '#3e3e3e',
    button: '#007acc',
    buttonHover: '#005a9e',
    input: '#252526'
  },
  cursor: {
    background: '#1e1e1e',
    text: '#d4d4d4',
    border: '#3e3e3e',
    button: '#007acc',
    buttonHover: '#005a9e',
    input: '#252526',
    accent: '#007acc'
  }
};


export const DEFAULT_SETTINGS = {
  theme: 'dark' as const,
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  notesFolder: '',
  autoSaveNotes: true,
  language: 'tr' as const,
  selectedAI: 'openai',
  openAIModel: 'gpt-3.5-turbo',
  claudeModel: 'claude-3-5-sonnet-20241022',
  geminiModel: 'gemini-pro',
  alwaysOnTop: false,
  minimizeToTray: false,
  speechRecognitionProvider: 'vosk' as const,
  // Vosk default settings
  voskEnabled: false,
  voskModelPath: '',
  voskModelLanguage: 'tr' as const,
  voskModelSize: 'small' as const
};

export const APP_VERSION = '1.0.0';

export const CURSOR_THEME_COLORS = {
  light: {
    background: '#ffffff',
    text: '#1a1a1a',
    border: '#e0e0e0',
    button: '#1a1a1a',
    buttonHover: '#2a2a2a',
    input: '#f5f5f5',
    accent: '#1a1a1a'
  },
  dark: {
    background: '#1e1e1e',
    text: '#d4d4d4',
    border: '#3e3e3e',
    button: '#d4d4d4',
    buttonHover: '#e4e4e4',
    input: '#252526',
    accent: '#d4d4d4'
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


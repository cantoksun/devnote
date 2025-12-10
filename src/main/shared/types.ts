export interface AppSettings {
  theme: 'light' | 'dark';
  fontSize: number;
  fontFamily: string;
  notesFolder: string;
  autoSaveNotes: boolean;
  language: 'tr' | 'en';
  selectedAI: string;
  openAIApiKey?: string;
  openAIModel?: string;
  claudeApiKey?: string;
  claudeModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  alwaysOnTop: boolean;
  speechRecognitionProvider?: 'web-speech' | 'vosk' | 'google-cloud' | 'azure';
  speechRecognitionApiKey?: string;
  minimizeToTray?: boolean;
  globalHotkey?: string;
  // Vosk settings
  voskEnabled?: boolean;
  voskModelPath?: string;
  voskModelLanguage?: 'tr' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi' | 'nl' | 'pl' | 'cs' | 'uk' | 'vi' | 'fa' | 'he';
  voskModelSize?: 'small' | 'large';
}

export interface AIProvider {
  id: string;
  name: string;
  processPrompt(prompt: string): Promise<string>;
}

export interface DailyNote {
  date: string;
  content: string;
}

export interface IPCChannels {
  'save-daily-note': (note: DailyNote) => Promise<{ success: boolean }>;
  'load-daily-note': (date: string) => Promise<string | null>;
  'select-notes-folder': () => Promise<string | null>;
  'get-settings': () => Promise<AppSettings>;
  'save-settings': (settings: AppSettings) => Promise<void>;
  'get-version': () => Promise<string>;
}


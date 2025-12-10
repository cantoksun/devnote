import { DailyNote } from '../../../shared/types';

export class NotesManager {
  private notesFolder: string;
  private autoSave: boolean;

  constructor(notesFolder: string = '', autoSave: boolean = true) {
    this.notesFolder = notesFolder;
    this.autoSave = autoSave;
  }

  async saveDailyNote(content: string): Promise<{ success: boolean; error?: string }> {
    if (!this.autoSave) {
      return { success: false, error: 'Auto-save is disabled' };
    }

    const date = new Date().toISOString().split('T')[0];
    const note: DailyNote = {
      date,
      content
    };

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.saveDailyNote(note);
        return result;
      }
      return { success: false, error: 'Electron API not available' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async loadDailyNote(date: string): Promise<string | null> {
    try {
      if (window.electronAPI) {
        return await window.electronAPI.loadDailyNote(date);
      }
      return null;
    } catch (error) {
      console.error('Error loading daily note:', error);
      return null;
    }
  }

  async selectNotesFolder(): Promise<string | null> {
    try {
      if (window.electronAPI) {
        const folder = await window.electronAPI.selectNotesFolder();
        if (folder) {
          this.notesFolder = folder;
        }
        return folder;
      }
      return null;
    } catch (error) {
      console.error('Error selecting notes folder:', error);
      return null;
    }
  }

  setNotesFolder(folder: string): void {
    this.notesFolder = folder;
  }

  setAutoSave(enabled: boolean): void {
    this.autoSave = enabled;
  }

  getNotesFolder(): string {
    return this.notesFolder;
  }

  getAutoSave(): boolean {
    return this.autoSave;
  }
}


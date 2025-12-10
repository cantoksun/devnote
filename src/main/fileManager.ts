import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DailyNote } from './shared/types';

export class FileManager {
  private notesDir: string;

  constructor(notesDir?: string) {
    this.notesDir = notesDir || path.join(app.getPath('userData'), 'notes');
    this.ensureNotesDirectory();
  }

  private ensureNotesDirectory(): void {
    if (!fs.existsSync(this.notesDir)) {
      fs.mkdirSync(this.notesDir, { recursive: true });
    }
  }

  saveDailyNote(note: DailyNote): { success: boolean; error?: string } {
    try {
      this.ensureNotesDirectory();
      const filePath = path.join(this.notesDir, `${note.date}.txt`);
      
      let existingContent = '';
      if (fs.existsSync(filePath)) {
        existingContent = fs.readFileSync(filePath, 'utf-8');
      }

      const separator = existingContent ? '\n\n---\n\n' : '';
      const newContent = existingContent 
        ? `${existingContent}${separator}${note.content}`
        : note.content;

      fs.writeFileSync(filePath, newContent, 'utf-8');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  loadDailyNote(date: string): string | null {
    try {
      const filePath = path.join(this.notesDir, `${date}.txt`);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      return null;
    } catch (error) {
      console.error('Error loading daily note:', error);
      return null;
    }
  }

  setNotesDirectory(dir: string): void {
    this.notesDir = dir;
    this.ensureNotesDirectory();
  }

  getNotesDirectory(): string {
    return this.notesDir;
  }

  deleteDailyNote(date: string): boolean {
    try {
      const filePath = path.join(this.notesDir, `${date}.txt`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting daily note:', error);
      return false;
    }
  }
}


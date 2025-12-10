import { useState, useEffect } from 'react';
import { AppSettings } from '../../shared/types';

// Renderer process için default settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  notesFolder: '',
  autoSaveNotes: true,
  language: 'tr',
  selectedAI: 'openai',
  alwaysOnTop: false
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // window.electronAPI'nin yüklenmesini bekle
      if (typeof window !== 'undefined' && window.electronAPI) {
        const loadedSettings = await window.electronAPI.getSettings();
        setSettings(loadedSettings);
      } else {
        // electronAPI henüz yüklenmemişse, bir süre bekle ve tekrar dene
        setTimeout(() => {
          if (window.electronAPI) {
            loadSettings();
          } else {
            setLoading(false);
          }
        }, 100);
        return;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveSettings(newSettings);
        setSettings(newSettings);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    return await saveSettings(newSettings);
  };

  return {
    settings,
    loading,
    saveSettings,
    updateSetting,
    reloadSettings: loadSettings
  };
}


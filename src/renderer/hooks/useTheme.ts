import { useEffect } from 'react';
import { CURSOR_THEME_COLORS } from '../config';
import { AppSettings } from '../../shared/types';

export function useTheme(settings: AppSettings) {
  useEffect(() => {
    const root = document.documentElement;
    const theme = settings.theme || 'dark';
    const colors = CURSOR_THEME_COLORS[theme] || CURSOR_THEME_COLORS.dark;

    // CSS değişkenlerini ayarla
    root.style.setProperty('--bg-color', colors.background);
    root.style.setProperty('--text-color', colors.text);
    root.style.setProperty('--border-color', colors.border);
    root.style.setProperty('--button-color', colors.button);
    root.style.setProperty('--button-hover-color', colors.buttonHover);
    root.style.setProperty('--input-color', colors.input);
    root.style.setProperty('--accent-color', colors.accent || colors.button);

    // Body class'ını güncelle ve arka planı şeffaf yap
    document.body.className = `theme-${theme}`;
    document.body.style.backgroundColor = 'transparent';
    root.style.backgroundColor = 'transparent';
  }, [settings.theme]);
}


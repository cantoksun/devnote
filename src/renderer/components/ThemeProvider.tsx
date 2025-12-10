import React from 'react';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../hooks/useTheme';
import './ThemeProvider.css';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { settings, loading } = useSettings();
  useTheme(settings);

  if (loading) {
    return (
      <div className="theme-provider" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: settings.fontFamily,
        backgroundColor: 'transparent'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="theme-provider" style={{
      fontFamily: settings.fontFamily,
      backgroundColor: 'transparent',
      width: '100%',
      height: '100%'
    }}>
      {children}
    </div>
  );
};


import { loadThemeMode, saveThemeMode } from '@/utils/themeStorage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme mode on mount
  useEffect(() => {
    async function loadSavedTheme() {
      const savedThemeMode = await loadThemeMode();
      if (savedThemeMode) {
        setThemeModeState(savedThemeMode);
      }
      setIsLoaded(true);
    }
    loadSavedTheme();
  }, []);

  useEffect(() => {
    if (themeMode === 'system') {
      setTheme(systemColorScheme ?? 'light');
    } else {
      setTheme(themeMode);
    }
  }, [themeMode, systemColorScheme]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await saveThemeMode(mode);
  };

  const value: ThemeContextType = {
    theme,
    themeMode,
    setThemeMode,
    isSystemTheme: themeMode === 'system',
  };

  return (
    <ThemeContext.Provider value={value}>
      {isLoaded ? children : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
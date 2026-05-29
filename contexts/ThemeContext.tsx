import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

type ThemeMode = 'dark' | 'light';
export type FontSizeMode = 'small' | 'medium' | 'large';

interface ThemeContextType {
  theme: typeof Colors.dark;
  mode: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
  fontSize: FontSizeMode;
  changeFontSize: (size: FontSizeMode) => Promise<void>;
  fontSizeMultiplier: number;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [fontSize, setFontSizeState] = useState<FontSizeMode>('medium');

  useEffect(() => {
    AsyncStorage.getItem('themeMode').then((saved) => {
      if (saved === 'light' || saved === 'dark') setMode(saved);
    });
    AsyncStorage.getItem('fontSize').then((saved) => {
      if (saved === 'small' || saved === 'medium' || saved === 'large') {
        setFontSizeState(saved);
      }
    });
  }, []);

  const toggleTheme = async () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    await AsyncStorage.setItem('themeMode', next);
  };

  const changeFontSize = async (size: FontSizeMode) => {
    setFontSizeState(size);
    await AsyncStorage.setItem('fontSize', size);
  };

  const theme = Colors[mode];

  const fontSizeMultiplier = 
    fontSize === 'small' ? 0.85 :
    fontSize === 'large' ? 1.2 : 1.0;

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        mode, 
        toggleTheme, 
        isDark: mode === 'dark', 
        fontSize, 
        changeFontSize, 
        fontSizeMultiplier 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

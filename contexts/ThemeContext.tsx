import { createContext } from 'react';
import type { Mode } from '../types';

interface ThemeContextType {
  mode: Mode;
  toggleMode: () => void;
  colorTheme: string;
  setColorTheme: (themeName: string) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleMode: () => {},
  colorTheme: 'default',
  setColorTheme: () => {},
});
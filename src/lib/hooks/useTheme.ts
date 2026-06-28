import { useEffect } from 'react';
import { useSettings } from './useSettings';
import type { ThemeMode } from '@/types';

/**
 * Applies the theme class to <html> based on user preference.
 * Supports "light", "dark", and "system" (follows OS preference).
 */
export function useTheme(): void {
  const { settings, loading } = useSettings();

  useEffect(() => {
    if (loading) return; // Don't apply theme until settings are loaded

    const root = document.documentElement;

    function applyTheme(theme: ThemeMode): void {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent): void =>
        applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }

    applyTheme(settings.theme);
  }, [settings.theme, loading]);
}

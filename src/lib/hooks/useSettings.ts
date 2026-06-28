import { useState, useEffect, useCallback } from 'react';
import {
  getSettings,
  updateSettings,
  onSettingsChange,
  DEFAULT_SETTINGS,
} from '@/lib/storage/settings';
import type { AppSettings } from '@/types';

interface UseSettingsResult {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  loading: boolean;
}

/**
 * React hook for reading/writing extension settings with live updates.
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });

    const unsub = onSettingsChange((newSettings) => {
      setSettings(newSettings);
    });

    return unsub;
  }, []);

  const update = useCallback(
    async (partial: Partial<AppSettings>): Promise<AppSettings> => {
      const updated = await updateSettings(partial);
      setSettings(updated);
      return updated;
    },
    []
  );

  return { settings, update, loading };
}

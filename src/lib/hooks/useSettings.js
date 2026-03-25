import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings, onSettingsChange, DEFAULT_SETTINGS } from '@/lib/storage/settings';

/**
 * React hook for reading/writing extension settings with live updates.
 */
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
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

  const update = useCallback(async (partial) => {
    const updated = await updateSettings(partial);
    setSettings(updated);
    return updated;
  }, []);

  return { settings, update, loading };
}

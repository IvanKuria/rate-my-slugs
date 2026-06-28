import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trash2, Check } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { AppSettings, ClearCacheMessage } from '@/types';

interface DataSettingsProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

export default function DataSettings({
  settings,
  onUpdate,
}: DataSettingsProps) {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const message: ClearCacheMessage = { action: 'clearCache' };
      await chrome.runtime.sendMessage(message);
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    } catch (err) {
      logger.error('Failed to clear cache:', err);
    }
    setClearing(false);
  };

  return (
    <div className="space-y-0">
      {/* Cache duration */}
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium">Cache Duration</p>
          <p className="text-xs text-muted-foreground">
            How long to store professor data before refreshing
          </p>
        </div>
        <select
          value={settings.cacheDurationDays}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onUpdate({ cacheDurationDays: Number(e.target.value) })
          }
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value={1}>1 day</option>
          <option value={3}>3 days</option>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>

      <Separator />

      {/* Max reviews */}
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium">Max Reviews</p>
          <p className="text-xs text-muted-foreground">
            Maximum number of reviews to load per professor
          </p>
        </div>
        <select
          value={settings.maxReviews}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            onUpdate({ maxReviews: Number(e.target.value) })
          }
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      <Separator />

      {/* Clear cache */}
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium">Clear Cache</p>
          <p className="text-xs text-muted-foreground">
            Remove all cached professor data
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearCache}
          disabled={clearing || cleared}
          className="gap-2"
        >
          {cleared ? (
            <>
              <Check className="h-4 w-4 text-rating-excellent" />
              Cleared
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              {clearing ? 'Clearing...' : 'Clear'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

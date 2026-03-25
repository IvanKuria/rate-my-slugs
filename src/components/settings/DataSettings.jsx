import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trash2, Check } from 'lucide-react';

export default function DataSettings({ settings, onUpdate }) {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await chrome.runtime.sendMessage({ action: 'clearCache' });
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    } catch (err) {
      console.error('Failed to clear cache:', err);
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
          onChange={(e) => onUpdate({ cacheDurationDays: Number(e.target.value) })}
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
          onChange={(e) => onUpdate({ maxReviews: Number(e.target.value) })}
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

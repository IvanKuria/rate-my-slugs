import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { AppSettings, EnabledPages } from '@/types';

interface BehaviorSettingsProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

const pageItems: { key: keyof EnabledPages; label: string }[] = [
  { key: 'search', label: 'Class Search Results' },
  { key: 'shoppingCart', label: 'Shopping Cart' },
  { key: 'enrolledClasses', label: 'Enrolled Classes' },
];

export default function BehaviorSettings({
  settings,
  onUpdate,
}: BehaviorSettingsProps) {
  return (
    <div className="space-y-0">
      {/* Auto-open */}
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium">Auto-open Side Panel</p>
          <p className="text-xs text-muted-foreground">
            Automatically open the side panel when professor data loads
          </p>
        </div>
        <Switch
          checked={settings.autoOpen}
          onCheckedChange={(checked) => onUpdate({ autoOpen: checked })}
        />
      </div>

      <Separator />

      {/* Page enables */}
      <div className="py-3">
        <p className="text-sm font-medium mb-3">Enabled Pages</p>
        <div className="space-y-3">
          {pageItems.map((page) => (
            <div key={page.key} className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{page.label}</p>
              <Switch
                checked={settings.enabledPages[page.key]}
                onCheckedChange={(checked) =>
                  onUpdate({
                    // Nested partial update; the storage layer deep-merges it.
                    enabledPages: {
                      [page.key]: checked,
                    } as Partial<EnabledPages> as EnabledPages,
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

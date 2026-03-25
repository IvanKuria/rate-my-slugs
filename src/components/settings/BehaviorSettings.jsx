import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export default function BehaviorSettings({ settings, onUpdate }) {
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
          {[
            { key: 'search', label: 'Class Search Results' },
            { key: 'shoppingCart', label: 'Shopping Cart' },
            { key: 'enrolledClasses', label: 'Enrolled Classes' },
          ].map((page) => (
            <div key={page.key} className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{page.label}</p>
              <Switch
                checked={settings.enabledPages[page.key]}
                onCheckedChange={(checked) =>
                  onUpdate({ enabledPages: { [page.key]: checked } })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

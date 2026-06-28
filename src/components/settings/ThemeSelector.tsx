import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppSettings, ThemeMode } from '@/types';

interface ThemeSelectorProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

const themes: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function ThemeSelector({
  settings,
  onUpdate,
}: ThemeSelectorProps) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Theme</label>
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        {themes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onUpdate({ theme: value })}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
              settings.theme === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

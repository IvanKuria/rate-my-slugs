import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { AppSettings, SettingsSections } from '@/types';

interface SectionTogglesProps {
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

const sectionItems: {
  key: keyof SettingsSections;
  label: string;
  description: string;
}[] = [
  {
    key: 'campusInfo',
    label: 'Campus Directory Info',
    description: 'Photo, department, contact details',
  },
  {
    key: 'rmpRatings',
    label: 'RateMyProfessors Ratings',
    description: 'Quality, difficulty, tags',
  },
  {
    key: 'gradeDistribution',
    label: 'Grade Distribution',
    description: 'Historical grade charts',
  },
  {
    key: 'reviews',
    label: 'Student Reviews',
    description: 'Review carousel with filters',
  },
  {
    key: 'tags',
    label: 'Rating Tags',
    description: 'Top professor tags from RMP',
  },
];

export default function SectionToggles({
  settings,
  onUpdate,
}: SectionTogglesProps) {
  const handleToggle = (key: keyof SettingsSections) => {
    onUpdate({
      // Nested partial update; the storage layer deep-merges it.
      sections: {
        [key]: !settings.sections[key],
      } as Partial<SettingsSections> as SettingsSections,
    });
  };

  return (
    <div className="space-y-0">
      {sectionItems.map((item, i) => (
        <div key={item.key}>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
            <Switch
              checked={settings.sections[item.key]}
              onCheckedChange={() => handleToggle(item.key)}
            />
          </div>
          {i < sectionItems.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}

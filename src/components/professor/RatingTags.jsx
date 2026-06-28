import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Horizontal wrapped list of rating tag badges.
 * Each tag displays its name and optional count.
 */
export default function RatingTags({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {tags.map((tag, i) => {
        const label = typeof tag === 'string' ? tag : tag?.tagName || tag?.name;
        const count = typeof tag === 'object' ? tag?.tagCount : null;
        if (!label) return null;

        return (
          <Badge
            key={i}
            variant="secondary"
            className={cn(
              'text-[11px] font-medium px-2.5 py-1 rounded-lg',
              'bg-secondary/50 text-secondary-foreground',
              'hover:bg-secondary/70 transition-colors cursor-default'
            )}
          >
            {label}
            {count != null && (
              <span className="ml-1 opacity-60">({count})</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
}

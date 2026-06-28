import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fadeSlideIn } from '@/lib/animations';
import { formatDate } from '@/lib/colors';
import type { RmpReview } from '@/types';

interface Props {
  review: RmpReview | null | undefined;
}

/**
 * Single review card displaying class name, date, comment, and stat badges.
 */
export default function ReviewItem({ review }: Props) {
  if (!review) return null;

  const {
    className: courseName,
    createdAt,
    comment,
    helpfulRating,
    clarityRating,
    difficultyRating,
    wouldTakeAgain,
  } = review;

  return (
    <motion.div
      initial={fadeSlideIn.initial}
      animate={fadeSlideIn.animate}
      transition={fadeSlideIn.transition}
    >
      <Card className="rounded-xl border bg-card/50 shadow-sm py-0 gap-0 overflow-hidden">
        <CardContent className="px-4 py-3.5">
          {/* Meta: class + date */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {courseName && (
              <span className="text-sm font-semibold text-foreground truncate">
                {courseName}
              </span>
            )}
            {createdAt && (
              <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatDate(createdAt)}
              </span>
            )}
          </div>

          {/* Comment */}
          <p className="text-sm text-foreground/90 leading-relaxed mb-3">
            {comment || 'No written review provided.'}
          </p>

          {/* Stat badges */}
          <div className="flex flex-wrap gap-1.5">
            {typeof helpfulRating === 'number' && (
              <StatBadge label="Helpful" value={helpfulRating.toFixed(1)} />
            )}
            {typeof clarityRating === 'number' && (
              <StatBadge label="Clarity" value={clarityRating.toFixed(1)} />
            )}
            {typeof difficultyRating === 'number' && (
              <StatBadge
                label="Difficulty"
                value={difficultyRating.toFixed(1)}
              />
            )}
            {typeof wouldTakeAgain === 'boolean' && (
              <StatBadge
                label="Take again"
                value={wouldTakeAgain ? 'Yes' : 'No'}
                positive={wouldTakeAgain}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface StatBadgeProps {
  label: string;
  value: string;
  positive?: boolean;
}

function StatBadge({ label, value, positive }: StatBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px] font-medium px-2 py-0.5 rounded-md gap-1',
        positive === true &&
          'border-green-500/30 text-green-700 dark:text-green-400',
        positive === false && 'border-red-500/30 text-red-700 dark:text-red-400'
      )}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </Badge>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fadeSlideIn } from '@/lib/animations';

/**
 * Professor identity header: avatar, name, department and division badges.
 */
export default function ProfessorHeader({
  name,
  department,
  division,
  photoSrc,
}) {
  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const showDivision =
    division &&
    department &&
    division.trim().toLowerCase() !== department.trim().toLowerCase();

  return (
    <motion.div
      className="flex items-center gap-3.5 px-1"
      initial={fadeSlideIn.initial}
      animate={fadeSlideIn.animate}
      transition={fadeSlideIn.transition}
    >
      <Avatar className="size-28 shadow-md ring-2 ring-background">
        {photoSrc ? (
          <AvatarImage src={photoSrc} alt={`Photo of ${name}`} />
        ) : null}
        <AvatarFallback className="text-base font-semibold bg-muted">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1.5 min-w-0">
        <h3 className="text-base font-semibold leading-tight tracking-tight truncate">
          {name}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          {department && (
            <Badge
              variant="secondary"
              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/60"
            >
              {department}
            </Badge>
          )}
          {showDivision && (
            <Badge
              variant="outline"
              className="text-[11px] font-medium px-2 py-0.5 rounded-md"
            >
              {division}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

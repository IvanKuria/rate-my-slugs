/**
 * Shared animation constants for framer-motion.
 */

import type { Transition, Variants } from 'framer-motion';

export const springs: Record<'gentle' | 'snappy' | 'bouncy', Transition> = {
  gentle: { type: 'spring', damping: 25, stiffness: 200 },
  snappy: { type: 'spring', damping: 30, stiffness: 400 },
  bouncy: { type: 'spring', damping: 15, stiffness: 300 },
};

export const stagger: { container: Variants; item: Variants } = {
  container: {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  },
};

export const fadeSlideIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring', damping: 25, stiffness: 300 } as Transition,
};

export const professorSwitch = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: { type: 'spring', damping: 25 } as Transition,
};

/**
 * Global type augmentations.
 */

import type { Root } from 'react-dom/client';

declare global {
  interface HTMLElement {
    /** React root stashed on a mount element by mountHelper for reuse. */
    __rmsRoot?: Root;
  }
}

export {};

/**
 * Dev-gated logger. Keeps console noise out of production builds; in dev
 * (import.meta.env.DEV) it forwards to the console.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  error(...args: unknown[]): void {
    if (isDev) console.error(...args);
  },
  warn(...args: unknown[]): void {
    if (isDev) console.warn(...args);
  },
};

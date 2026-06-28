/**
 * Shapes of the bundled JSON data files in public/data.
 */

/** Abbreviated "Last,F." name -> a value containing `uid=...` or a bare uid. */
export type ProfUidsMap = Record<string, string>;

/** Full professor name -> free-text research description. */
export type ResearchTopicsMap = Record<string, string>;

/** Professor name -> list of course strings. */
export type ClassesMap = Record<string, string[]>;

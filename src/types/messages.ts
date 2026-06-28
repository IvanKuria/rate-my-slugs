/**
 * The extension message protocol: a discriminated union over `action`, with a
 * paired response type per route. Source of truth: the onMessage router in
 * src/entrypoints/background and the senders in content/sidepanel.
 */

import type { ProfessorBundle, ProfessorData } from './professor';

export interface FetchProfessorDataMessage {
  action: 'fetchProfessorData';
  ID: string | null;
  name: string;
  rateMyProfSchoolId?: string;
}

export interface ShowProfessorMessage {
  action: 'showProfessor';
  data: ProfessorData;
}

export interface DisplayProfessorMessage {
  action: 'displayProfessor';
  data: ProfessorData;
}

export interface PanelReadyMessage {
  action: 'panelReady';
  tabId?: number;
}

export interface ClearCacheMessage {
  action: 'clearCache';
}

export type ExtensionMessage =
  | FetchProfessorDataMessage
  | ShowProfessorMessage
  | DisplayProfessorMessage
  | PanelReadyMessage
  | ClearCacheMessage;

export type FetchProfessorDataResponse = ProfessorBundle | { error: string };

export type ShowProfessorResponse =
  { status: 'success'; pushed: boolean } | { status: 'error'; error: string };

export type PanelReadyResponse =
  | { status: 'success'; data: ProfessorData | null }
  | { status: 'error'; error: string; data: null };

export type ClearCacheResponse =
  { status: 'success'; cleared: number } | { status: 'error'; error: string };

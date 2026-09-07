export const EntryType = {
  ARCHIVE: 'ARCHIVE',
  DIRECTORY: 'DIRECTORY',
} as const;
export type EntryType = (typeof EntryType)[keyof typeof EntryType];

export const MatchStatus = {
  PENDING: 'PENDING',
  FLAGGED: 'FLAGGED',
  ACCEPTED: 'ACCEPTED',
  MANUAL: 'MANUAL',
  REJECTED: 'REJECTED',
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const ScanStatus = {
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

export const STEAM_PROVIDER_NAME = 'steam';
export const IGDB_PROVIDER_NAME = 'igdb';

/** Statuses eligible for re-matching during scans and retry-match runs. */
export const RE_MATCHABLE_STATUSES: MatchStatus[] = [
  MatchStatus.PENDING,
  MatchStatus.FLAGGED,
  MatchStatus.REJECTED,
];

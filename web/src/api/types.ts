export type MatchStatus = 'PENDING' | 'FLAGGED' | 'ACCEPTED' | 'MANUAL' | 'REJECTED';

export type EntryType = 'ARCHIVE' | 'DIRECTORY';

export type ScanStatus = 'RUNNING' | 'DONE' | 'FAILED';

export type ScanPhase = 'start' | 'candidate' | 'matched' | 'failed' | 'done';

export interface Game {
  id: string;
  entryPath: string;
  entryType: EntryType;
  entryName: string;
  sizeBytes: number;
  steamAppId: number | null;
  title: string | null;
  releaseYear: number | null;
  description: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  coverUrl: string | null;
  headerUrl: string | null;
  matchStatus: MatchStatus;
  matchScore: number | null;
  matchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameListResult {
  items: Game[];
  total: number;
}

export interface GameUpdateInput {
  title?: string | null;
  releaseYear?: number | null;
  description?: string | null;
  developers?: string[];
  publishers?: string[];
  genres?: string[];
}

export interface ScanRun {
  id: string;
  rootPath: string;
  startedAt: string;
  finishedAt: string | null;
  found: number;
  added: number;
  updated: number;
  failed: number;
  status: ScanStatus;
  errors: string[];
}

export interface ScannerStatus {
  running: ScanRun | null;
  latest: ScanRun | null;
  isRunning: boolean;
}

export interface ScanProgressEvent {
  scanRunId: string;
  phase: ScanPhase;
  found: number;
  added: number;
  updated: number;
  failed: number;
  currentEntry?: string;
  message?: string;
}

export interface SearchResult {
  remoteId: string;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  score?: number;
}

export interface MetadataSearchResponse {
  gameId: string;
  results: SearchResult[];
}

export interface ApiErrorEnvelope {
  statusCode: number;
  code: string;
  error: string;
  message: string;
}
export type EntryType = 'ARCHIVE' | 'DIRECTORY';

export type ScanStatus = 'RUNNING' | 'DONE' | 'FAILED';

export type ScanPhase = 'start' | 'candidate' | 'matched' | 'failed' | 'done';

export type SortKey =
  | 'title-asc'
  | 'title-desc'
  | 'newest'
  | 'oldest'
  | 'largest'
  | 'smallest';

export interface SteamDeckCompatItem {
  displayType: number;
  locToken: string;
}

export interface Game {
  id: string;
  entryPath: string;
  entryType: EntryType;
  entryName: string;
  sizeBytes: number;
  steamAppId: number | null;
  title: string | null;
  displayName: string;
  releaseYear: number | null;
  description: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  coverUrl: string | null;
  headerUrl: string | null;
  screenshots?: { url: string; thumbnailUrl: string }[];
  videos?: { url: string; thumbnailUrl: string; name?: string; hlsUrl?: string }[];
  steamDeckCategory?: number | null;
  steamDeckItems?: SteamDeckCompatItem[];
  createdAt: string;
  updatedAt: string;
  ageRating?: string | null;
  metacriticScore?: number | null;
  releaseDate?: string | null;
}

export interface GameListResult {
  items: Game[];
  total: number;
}

export interface GenresResult {
  genres: string[];
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
  providerName: string;
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

export interface JobState {
  running: boolean;
  processed: number;
  failed: number;
}

export interface RefreshJobResponse {
  running: boolean;
  state?: JobState;
  started?: boolean;
}

export interface RetryMatchResponse {
  running: boolean;
  state?: JobState;
  started?: boolean;
}
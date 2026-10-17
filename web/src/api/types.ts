type EntryType = 'ARCHIVE' | 'DIRECTORY';

type ScanStatus = 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

type ScanPhase = 'start' | 'candidate' | 'matched' | 'failed' | 'done';

export type SortKey =
  | 'title-asc'
  | 'title-desc'
  | 'newest'
  | 'oldest'
  | 'largest'
  | 'smallest';

interface SteamDeckCompatItem {
  displayType: number;
  locToken: string;
}

export interface Game {
  id: string;
  entryPath: string;
  entryType: EntryType;
  entryName: string;
  originalEntryName: string | null;
  releaseVersion: string | null;
  releaseDlcs: string[];
  releaseGroup: string | null;
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

interface RepackSettingConstraints {
  min?: number;
  max?: number;
  maxLength?: number;
  protocol?: string;
}

export interface RepackSettings {
  enabled: boolean;
  baseUrl: string;
  intervalHours: number;
  auditEnabled: boolean;
  auditIntervalHours: number;
  fullImportComplete: boolean;
  defaults: {
    enabled: boolean;
    baseUrl: string;
    intervalHours: number;
    auditEnabled: boolean;
    auditIntervalHours: number;
  };
  constraints: {
    baseUrl?: RepackSettingConstraints;
    intervalHours?: RepackSettingConstraints;
    auditIntervalHours?: RepackSettingConstraints;
  };
}

export type RepackCatalogSettings = RepackSettings;

interface RepackDownloadOption {
  label: string;
  url: string;
}

interface RepackPostSummary {
  id: string;
  title: string;
  sourceUrl: string;
  postKind: 'GAME' | 'UPDATE' | 'DLC';
  publishedAt: string | null;
  firstSeenAt: string;
}

export interface RepackMatchCandidate {
  providerName: string;
  remoteId: string;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  score: number;
}

export interface RepackCatalogGame {
  id: string;
  title: string;
  normalizedTitle: string;
  matchStatus: 'PENDING' | 'MATCHED' | 'REVIEW' | 'REJECTED';
  matchScore: number | null;
  updatedAt: string;
  latestPostAt: string | null;
  providerName: string | null;
  providerRemoteId: string | null;
  posts: RepackPostSummary[];
}

export interface RepackCatalogGameDetail extends RepackCatalogGame {
  matchCandidates: RepackMatchCandidate[];
  tags: string[];
  metadataSnapshot: {
    remoteId: string;
    title: string;
    releaseYear?: number;
    description?: string;
    developers: string[];
    publishers: string[];
    genres: string[];
    coverUrl?: string;
    headerUrl?: string;
    heroUrl?: string;
    logoUrl?: string;
    screenshots?: { url: string; thumbnailUrl: string }[];
    videos?: { url: string; thumbnailUrl: string; name?: string; hlsUrl?: string }[];
    steamDeckCompat?: { category: number; items: Array<{ displayType: number; locToken: string }> };
  } | null;
  posts: Array<RepackPostSummary & {
    tags: string[];
    details: Record<string, string>;
    downloadOptions: RepackDownloadOption[];
  }>;
}

export interface RepackJobStatus {
  running: boolean;
  phase: string;
  processed: number;
  skipped: number;
  failed: number;
  total: number;
  startedAt: string | null;
}

export interface GameRenamePreview {
  id: string;
  oldName: string;
  newName: string | null;
  status: 'ready' | 'unchanged' | 'conflict' | 'unavailable' | 'renamed' | 'failed';
  message?: string;
}

export interface GameRenameResult {
  id: string;
  oldPath: string;
  newPath: string | null;
  status: 'renamed' | 'skipped' | 'failed';
  message?: string;
}

export interface NamingSettings {
  defaultFormat: string;
  tags: string[];
  customFormat: string | null;
}

export interface GenresResult {
  genres: string[];
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
  runningRun: ScanRun | null;
  latest: ScanRun | null;
  isRunning: boolean;
  emptyReason: 'never-scanned' | 'manually-cleared' | null;
}

export interface ScanProgressEvent {
  scanRunId: string;
  phase: ScanPhase;
  stage?: 'scan' | 'metadata' | 'artwork' | 'done';
  total?: number;
  completed?: number;
  found: number;
  added: number;
  updated: number;
  failed: number;
  currentEntry?: string;
  message?: string;
}

export interface ApiErrorEnvelope {
  statusCode: number;
  code: string;
  error: string;
  message: string;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  collapsed: boolean;
  sortOrder: number;
  parentId: string | null;
  priority: '' | '!' | '!!' | '!!!';
  color: 'indigo' | 'violet' | 'teal' | 'amber' | 'rose' | null;
  createdAt: string;
  updatedAt: string;
}

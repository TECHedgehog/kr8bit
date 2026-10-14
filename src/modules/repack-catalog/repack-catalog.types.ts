export type RepackPostKind = 'GAME' | 'UPDATE' | 'DLC';
export type RepackMatchStatus = 'PENDING' | 'MATCHED' | 'REVIEW' | 'REJECTED';

export interface RepackDownloadOption {
  label: string;
  url: string;
}

export interface RepackPostInput {
  source: string;
  sourceUrl: string;
  title: string;
  gameTitle: string;
  normalizedTitle: string;
  publishedAt?: Date;
  details: Record<string, string>;
  tags: string[];
  downloadOptions: RepackDownloadOption[];
  postKind: RepackPostKind;
  contentHash: string;
}

export interface RepackSource {
  readonly name: string;
  discoverPostUrls(options: { fullArchive: boolean; signal?: AbortSignal }): Promise<string[]>;
  fetchPost(url: string, signal?: AbortSignal): Promise<RepackPostInput | null>;
}

export interface RepackMatchCandidate {
  providerName: string;
  remoteId: string;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  score: number;
}

export interface RepackMetadataSnapshot {
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
  steamDeckCompat?: {
    category: number;
    items: Array<{ displayType: number; locToken: string }>;
  };
}

export interface RepackCatalogQuery {
  offset: number;
  limit: number;
  query?: string;
}

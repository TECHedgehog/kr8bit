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
  normalizedTitle: string;
  publishedAt?: Date;
  contentText: string;
  details: Record<string, string>;
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

export interface RepackCatalogQuery {
  offset: number;
  limit: number;
  query?: string;
}

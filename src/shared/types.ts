export interface SearchResult {
  providerName: string;
  remoteId: string;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  score?: number;
}

export interface GameMetadata {
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
}

export interface MetadataProvider {
  readonly name: string;
  search(query: string): Promise<SearchResult[]>;
  getGame(remoteId: string): Promise<GameMetadata | null>;
}
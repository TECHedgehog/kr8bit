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
}

export interface MetadataProvider {
  readonly name: string;
  search(query: string): Promise<SearchResult[]>;
  getGame(remoteId: string): Promise<GameMetadata | null>;
}
export interface SearchResult {
  providerName: string;
  remoteId: string;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  score?: number;
}

export interface SteamDeckCompatItem {
  displayType: number;
  locToken: string;
}

export interface SteamDeckCompatMetadata {
  category: number;
  items: SteamDeckCompatItem[];
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
  steamDeckCompat?: SteamDeckCompatMetadata;
}

export interface MetadataProvider {
  readonly name: string;
  search(query: string): Promise<SearchResult[]>;
  getGame(remoteId: string): Promise<GameMetadata | null>;
}
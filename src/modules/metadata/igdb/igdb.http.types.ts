export interface IgdbTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface IgdbImage {
  id: number;
  url: string;
  image_id?: string;
}

export interface IgdbGenre {
  id: number;
  name: string;
}

export interface IgdbCompanyRef {
  id: number;
  name: string;
}

export interface IgdbInvolvedCompany {
  id: number;
  company: IgdbCompanyRef;
  developer: boolean;
  publisher: boolean;
}

export interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  storyline?: string;
  first_release_date?: number;
  genres?: IgdbGenre[];
  involved_companies?: IgdbInvolvedCompany[];
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
}

export const IGDB_IMAGE_SIZE_COVER = 't_1080p';
export const IGDB_IMAGE_SIZE_HEADER = 't_1080p';

export function normalizeIgdbImageUrl(raw: string | undefined, size: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const withProto = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  return withProto.replace(/\/t_[^/]+\//, `/${size}/`);
}
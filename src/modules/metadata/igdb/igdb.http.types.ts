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

export interface IgdbAlternativeName {
  id: number;
  name: string;
}

export interface IgdbGenre {
  id: number;
  name: string;
}

export interface IgdbTheme {
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
  themes?: IgdbTheme[];
  involved_companies?: IgdbInvolvedCompany[];
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  alternative_names?: IgdbAlternativeName[];
}

export const IGDB_IMAGE_SIZE_COVER = 't_1080p';
export const IGDB_IMAGE_SIZE_HEADER = 't_1080p';
export const IGDB_IMAGE_SIZE_SCREENSHOT_THUMB = 't_screenshot_med';
export const IGDB_IMAGE_SIZE_SCREENSHOT_FULL = 't_screenshot_huge';

export function normalizeIgdbImageUrl(raw: string | undefined, size: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const withProto = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  return withProto.replace(/\/t_[^/]+\//, `/${size}/`);
}
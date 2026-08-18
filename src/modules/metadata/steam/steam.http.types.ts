export const STEAM_API_BASE = 'https://api.steampowered.com';
export const STEAM_STORE_BASE = 'https://store.steampowered.com';
export const STEAM_CDN_BASE = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

export interface SteamAppListEntry {
  appid: number;
  name: string;
}

export interface SteamAppListResponse {
  applist: {
    apps: SteamAppListEntry[];
  };
}

export interface SteamStoreSearchItem {
  type: string;
  name: string;
  id: number;
  tiny_image?: string;
  price?: { currency: string; initial: number; final: number };
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
}

export interface SteamStoreSearchResponse {
  total: number;
  items: SteamStoreSearchItem[];
}

export interface SteamAppDetailsData {
  steam_appid: number;
  name: string;
  type?: string;
  release_date?: { date?: string; coming_soon?: boolean };
  developers?: string[];
  publishers?: string[];
  genres?: { id: string; description: string }[];
  short_description?: string;
  header_image?: string;
  capsule_image?: string;
  capsule_imagev5?: string;
  library_capsule?: string;
  library_capsule_2x?: string;
  screenshots?: SteamScreenshot[];
  movies?: SteamMovie[];
}

export interface SteamScreenshot {
  id: number;
  path_thumbnail: string;
  path_full: string;
}

export interface SteamMovie {
  id: number;
  name: string;
  thumbnail: string;
  hls_h264?: string;
  dash_h264?: string;
  dash_av1?: string;
  mp4?: { max?: string; "480"?: string };
  webm?: { max?: string; "480"?: string };
}

export interface SteamAppDetailsResponse {
  [appid: string]: {
    success: boolean;
    data?: SteamAppDetailsData;
  };
}

export interface SteamDeckCompatibilityItem {
  display_type: number;
  loc_token: string;
}

export interface SteamDeckCompatibility {
  appid: number;
  resolved_category: number;
  resolved_items: SteamDeckCompatibilityItem[];
}

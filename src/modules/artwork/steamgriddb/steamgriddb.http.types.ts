export interface SteamGridDbAuthor {
  name: string;
  steam64: string;
  avatar: string;
}

export interface SteamGridDbImage {
  id: number;
  score: number;
  style: string;
  url: string;
  thumb: string;
  tags: string[];
  author: SteamGridDbAuthor;
  language: string;
  notes: string | null;
  width: number;
  height: number;
  upvotes: number;
  downvotes: number;
}

export interface SteamGridDbGame {
  id: number;
  name: string;
  types: string[];
  verified: boolean;
  release_date: number;
}

export interface SteamGridDbImageResponse {
  success: boolean;
  data: SteamGridDbImage[];
  errors?: string[];
}

export interface SteamGridDbGameResponse {
  success: boolean;
  data: SteamGridDbGame;
  errors?: string[];
}

export interface SteamGridDbImageQuery {
  styles?: string[];
  dimensions?: string[];
  mimes?: string[];
  types?: string[];
  nsfw?: string;
  humor?: string;
  epilepsy?: string;
  oneoftag?: string;
  page?: number;
}

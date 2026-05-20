import json
import logging
import os
import time
from typing import Optional

import httpx

from app.config import settings

IGDB_TOKEN_CACHE_PATH = "data/igdb_token.json"

_token_cache: dict = {}
_cached_credentials: dict = {}
_last_token_error: str = ""

logger = logging.getLogger(__name__)


def invalidate_igdb_token():
    global _token_cache, _cached_credentials
    _token_cache = {}
    _cached_credentials = {}
    if os.path.exists(IGDB_TOKEN_CACHE_PATH):
        try:
            os.remove(IGDB_TOKEN_CACHE_PATH)
        except OSError:
            pass


async def _get_igdb_token() -> str:
    global _token_cache, _cached_credentials, _last_token_error
    _last_token_error = ""

    client_id = settings.twitch_client_id
    client_secret = settings.twitch_client_secret

    if not client_id or not client_secret:
        _last_token_error = "Client ID and Secret are required"
        return ""

    now = time.time()

    if _token_cache.get("access_token") and _token_cache.get("expires_at", 0) > now:
        if _cached_credentials.get("client_id") == client_id and _cached_credentials.get("client_secret") == client_secret:
            return _token_cache["access_token"]

    if os.path.exists(IGDB_TOKEN_CACHE_PATH):
        try:
            with open(IGDB_TOKEN_CACHE_PATH) as f:
                cached = json.load(f)
            if (cached.get("expires_at", 0) > now
                    and cached.get("client_id") == client_id
                    and cached.get("client_secret") == client_secret):
                _token_cache = cached
                _cached_credentials = {"client_id": client_id, "client_secret": client_secret}
                return cached["access_token"]
        except Exception:
            pass

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "client_credentials",
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            token = data["access_token"]
            expires_in = data.get("expires_in", 86400)
            _token_cache = {
                "access_token": token,
                "expires_at": now + expires_in - 300,
                "client_id": client_id,
                "client_secret": client_secret,
            }
            _cached_credentials = {"client_id": client_id, "client_secret": client_secret}
            os.makedirs("data", exist_ok=True)
            with open(IGDB_TOKEN_CACHE_PATH, "w") as f:
                json.dump(_token_cache, f)
            return token
        except httpx.HTTPStatusError as e:
            error_detail = ""
            try:
                error_detail = e.response.text
            except Exception:
                error_detail = str(e)
            _last_token_error = f"Twitch API error: {error_detail}"
            logger.warning(f"IGDB token fetch failed: {error_detail}")
            return ""
        except Exception as e:
            _last_token_error = f"Connection error: {str(e)}"
            logger.warning(f"IGDB token fetch error: {e}")
            return ""


async def search_igdb(query: str, client: httpx.AsyncClient | None = None) -> list[dict]:
    token = await _get_igdb_token()
    if not token:
        return []

    client_id = settings.twitch_client_id

    headers = {
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
    }

    body = f'search "{query}"; fields name,cover.url,first_release_date,genres.name,platforms.slug,alternative_names.name; limit 10;'

    if client is None:
        async with httpx.AsyncClient() as c:
            return await search_igdb(query, c)

    try:
        resp = await client.post(
            "https://api.igdb.com/v4/games",
            content=body,
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning(f"IGDB search error for query={query}: {e}")
        return []


async def get_igdb_details(igdb_id: int, client: httpx.AsyncClient | None = None) -> Optional[dict]:
    token = await _get_igdb_token()
    if not token:
        return None

    client_id = settings.twitch_client_id

    headers = {
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
    }

    fields = (
        "name,summary,storyline,cover.url,artworks.url,screenshots.url,"
        "videos.video_id,videos.name,"
        "genres.name,genres.slug,platforms.name,platforms.slug,"
        "first_release_date,involved_companies.company.name,"
        "involved_companies.publisher,involved_companies.developer,"
        "websites.url,websites.category,external_games.uid,external_games.category,"
        "url,rating,rating_count,alternative_names.name"
    )
    body = f"fields {fields}; where id = {igdb_id};"

    if client is None:
        async with httpx.AsyncClient() as c:
            return await get_igdb_details(igdb_id, c)

    try:
        resp = await client.post(
            "https://api.igdb.com/v4/games",
            content=body,
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if data and len(data) > 0:
            return data[0]
    except Exception as e:
        logger.warning(f"IGDB details error for id={igdb_id}: {e}")
    return None


def _igdb_image(url: str, size: str = "t_thumb") -> str:
    if not url:
        return ""
    full_url = url
    if full_url.startswith("//"):
        full_url = "https:" + full_url
    return full_url.replace("t_thumb", size) if "t_thumb" in full_url else full_url


def parse_igdb_meta(data: dict) -> dict:
    cover_url = ""
    if data.get("cover") and isinstance(data["cover"], dict):
        cover_url = _igdb_image(data["cover"].get("url", ""), "t_cover_big")

    screenshots = []
    for i, ss in enumerate(data.get("screenshots", [])):
        if isinstance(ss, dict):
            screenshots.append({
                "thumbnail_url": _igdb_image(ss.get("url", ""), "t_thumb"),
                "full_url": _igdb_image(ss.get("url", ""), "t_1080p"),
                "index_order": i,
            })

    artworks = []
    for i, art in enumerate(data.get("artworks", [])):
        if isinstance(art, dict):
            artworks.append(_igdb_image(art.get("url", ""), "t_1080p"))

    videos = []
    for i, vid in enumerate(data.get("videos", [])):
        if isinstance(vid, dict):
            video_id = vid.get("video_id", "")
            videos.append({
                "name": vid.get("name", ""),
                "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else "",
                "mp4_url": f"https://www.youtube.com/watch?v={video_id}" if video_id else "",
                "webm_url": "",
                "dash_url": "",
                "hls_url": "",
                "is_highlight": i == 0,
                "index_order": i,
            })

    genres = []
    for g in data.get("genres", []):
        if isinstance(g, dict):
            genres.append({
                "igdb_genre_id": g.get("id", 0),
                "name": g.get("name", ""),
                "slug": g.get("slug", ""),
            })

    platforms = {"windows": False, "mac": False, "linux": False}
    for p in data.get("platforms", []):
        if isinstance(p, dict):
            slug = p.get("slug", "").lower()
            if slug in ("win", "windows", "pc"):
                platforms["windows"] = True
            elif slug in ("mac", "macos"):
                platforms["mac"] = True
            elif slug == "linux":
                platforms["linux"] = True

    companies_dev = []
    companies_pub = []
    for ic in data.get("involved_companies", []):
        if isinstance(ic, dict) and ic.get("company"):
            company_name = ic["company"].get("name", "") if isinstance(ic["company"], dict) else str(ic["company"])
            if ic.get("developer"):
                companies_dev.append(company_name)
            if ic.get("publisher"):
                companies_pub.append(company_name)

    website = ""
    steam_app_id = None

    # Primary: external_games with category 1 = Steam
    for eg in data.get("external_games", []):
        if isinstance(eg, dict) and eg.get("category") == 1:
            try:
                steam_app_id = int(eg.get("uid", ""))
                break
            except (ValueError, TypeError):
                pass

    # Fallback: websites category 13 = Steam store link
    if not steam_app_id:
        for w in data.get("websites", []):
            if isinstance(w, dict):
                url = w.get("url", "")
                if w.get("category") == 1:
                    website = url
                elif w.get("category") == 13 and url:
                    import re
                    m = re.search(r"store\.steampowered\.com/app/(\d+)", url)
                    if m:
                        steam_app_id = int(m.group(1))

    release_date = ""
    if data.get("first_release_date"):
        from datetime import datetime, timezone
        release_date = datetime.fromtimestamp(data["first_release_date"], tz=timezone.utc).strftime("%Y-%m-%d")

    header_image = cover_url
    background_image = ""
    if artworks:
        background_image = artworks[0]
    elif cover_url:
        background_image = cover_url

    description = data.get("summary", "") or ""
    description_full = data.get("storyline", "") or data.get("summary", "") or ""

    companies_str = ", ".join(set(companies_dev + companies_pub))

    return {
        "igdb_id": data.get("id"),
        "igdb_name": data.get("name", ""),
        "description": description[:1000],
        "description_full": description_full[:5000],
        "header_image": header_image,
        "capsule_image": cover_url,
        "background_image": background_image,
        "metacritic_score": None,
        "igdb_rating": data.get("rating"),
        "igdb_rating_count": data.get("rating_count"),
        "release_date_steam": release_date,
        "website": website,
        "steam_app_id": steam_app_id,
        "platforms_windows": platforms["windows"],
        "platforms_mac": platforms["mac"],
        "platforms_linux": platforms["linux"],
        "companies": companies_str,
        "screenshots": screenshots,
        "videos": videos,
        "genres": genres,
        "system_requirements": [],
    }


async def igdb_is_configured() -> bool:
    return bool(settings.twitch_client_id and settings.twitch_client_secret)


def get_last_igdb_error() -> str:
    return _last_token_error

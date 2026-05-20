import httpx
import asyncio
from typing import Optional

from app.config import settings

STEAMGRID_BASE_URL = "https://www.steamgriddb.com/api/v2"


class SteamGridDBClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.steamgriddb_api_key
        self._client: httpx.AsyncClient | None = None
        self._rate_limit = asyncio.Semaphore(5)
        self._delay = 0.1

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            self._client = httpx.AsyncClient(
                base_url=STEAMGRID_BASE_URL,
                headers=headers,
                timeout=30,
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _get(self, path: str, **kwargs) -> dict | None:
        async with self._rate_limit:
            client = await self._get_client()
            try:
                resp = await client.get(path, **kwargs)
                resp.raise_for_status()
                return resp.json()
            except Exception:
                return None
            finally:
                await asyncio.sleep(self._delay)

    async def search_games(self, term: str) -> list[dict]:
        data = await self._get("/games/search", params={"term": term})
        if not data or "data" not in data:
            return []
        return data["data"]

    async def get_game_grids(
        self,
        game_id: int,
        dimensions: str = "600x900,460x215",
        styles: str = "static,animated",
    ) -> list[dict]:
        data = await self._get(
            f"/games/{game_id}/grids",
            params={
                "dimensions": dimensions,
                "styles": styles,
                "nsfw": "any",
                "humor": "any",
            },
        )
        if not data or "data" not in data:
            return []
        return data["data"]

    async def get_game_heroes(
        self,
        game_id: int,
        styles: str = "static,animated",
    ) -> list[dict]:
        data = await self._get(
            f"/games/{game_id}/heroes",
            params={
                "styles": styles,
                "nsfw": "any",
                "humor": "any",
            },
        )
        if not data or "data" not in data:
            return []
        return data["data"]

    async def get_game_logos(
        self,
        game_id: int,
        styles: str = "static,animated",
    ) -> list[dict]:
        data = await self._get(
            f"/games/{game_id}/logos",
            params={
                "styles": styles,
                "nsfw": "any",
                "humor": "any",
            },
        )
        if not data or "data" not in data:
            return []
        return data["data"]

    async def get_game_icons(
        self,
        game_id: int,
        styles: str = "static,animated",
    ) -> list[dict]:
        data = await self._get(
            f"/games/{game_id}/icons",
            params={
                "styles": styles,
                "nsfw": "any",
                "humor": "any",
            },
        )
        if not data or "data" not in data:
            return []
        return data["data"]

    def pick_best_grid(self, grids: list[dict]) -> dict | None:
        return self._pick_best(grids, prefer_styles=["static"], prefer_nsfw=False, prefer_humor=False)

    def pick_best_hero(self, heroes: list[dict]) -> dict | None:
        return self._pick_best(heroes, prefer_styles=["static"], prefer_nsfw=False, prefer_humor=False)

    def pick_best_logo(self, logos: list[dict]) -> dict | None:
        return self._pick_best(logos, prefer_styles=["static"], prefer_nsfw=False, prefer_humor=False)

    def pick_best_icon(self, icons: list[dict]) -> dict | None:
        return self._pick_best(icons, prefer_styles=["static"], prefer_nsfw=False, prefer_humor=False)

    def _pick_best(
        self,
        images: list[dict],
        prefer_styles: list[str],
        prefer_nsfw: bool,
        prefer_humor: bool,
    ) -> dict | None:
        if not images:
            return None

        def score(img: dict) -> tuple:
            style_match = 0 if img.get("style") in prefer_styles else 1
            nsfw_match = 0 if img.get("nsfw", False) == prefer_nsfw else 1
            humor_match = 0 if img.get("humor", False) == prefer_humor else 1
            return (style_match, nsfw_match, humor_match)

        sorted_images = sorted(images, key=score)
        return sorted_images[0]


async def search_and_get_images(
    game_name: str,
    steam_app_id: int | None = None,
) -> dict | None:
    client = SteamGridDBClient()
    try:
        results = await client.search_games(game_name)
        if not results:
            return None

        sgdb_game = results[0]
        sgdb_id = sgdb_game["id"]

        grids = await client.get_game_grids(sgdb_id)
        heroes = await client.get_game_heroes(sgdb_id)
        logos = await client.get_game_logos(sgdb_id)
        icons = await client.get_game_icons(sgdb_id)

        return {
            "sgdb_id": sgdb_id,
            "sgdb_name": sgdb_game.get("name"),
            "grid": client.pick_best_grid(grids),
            "hero": client.pick_best_hero(heroes),
            "logo": client.pick_best_logo(logos),
            "icon": client.pick_best_icon(icons),
            "all_grids": grids,
            "all_heroes": heroes,
            "all_logos": logos,
            "all_icons": icons,
        }
    finally:
        await client.close()
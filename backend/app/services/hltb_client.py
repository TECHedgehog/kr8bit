import logging
import time
import httpx
from thefuzz import fuzz

from app.config import settings

logger = logging.getLogger(__name__)


def _hltb_init_url() -> str:
    return f"https://howlongtobeat.com/api/bleed/init?t={int(time.time() * 1000)}"


async def _init_hltb_auth(client: httpx.AsyncClient) -> dict | None:
    try:
        resp = await client.get(
            _hltb_init_url(),
            timeout=15,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": "https://howlongtobeat.com/",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "token": data["token"],
            "hpKey": data["hpKey"],
            "hpVal": data["hpVal"],
        }
    except Exception as e:
        logger.warning(f"HLTB auth init failed: {e}")
        return None


async def _search_hltb(
    title: str,
    auth: dict,
    client: httpx.AsyncClient,
) -> list[dict]:
    search_terms = title.split()
    if not search_terms:
        return []

    hp_key = auth["hpKey"]
    hp_val = auth["hpVal"]

    body = {
        "searchType": "games",
        "searchTerms": search_terms,
        "searchPage": 1,
        "size": 20,
        "searchOptions": {
            "games": {
                "userId": 0,
                "platform": "",
                "sortCategory": "popular",
                "rangeCategory": "main",
                "rangeTime": {"min": 0, "max": 0},
                "gameplay": {"perspective": "", "flow": "", "genre": "", "difficulty": ""},
                "rangeYear": {"max": "", "min": ""},
                "modifier": "",
            },
            "users": {"sortCategory": "postcount"},
            "lists": {"sortCategory": "follows"},
            "filter": "",
            "sort": 0,
            "randomizer": 0,
        },
        "useCache": True,
        hp_key: hp_val,
    }

    try:
        resp = await client.post(
            "https://howlongtobeat.com/api/bleed",
            json=body,
            timeout=15,
            headers={
                "Content-Type": "application/json",
                "x-auth-token": auth["token"],
                "x-hp-key": hp_key,
                "x-hp-val": hp_val,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://howlongtobeat.com",
                "Referer": "https://howlongtobeat.com/",
            },
        )
        resp.raise_for_status()
        result = resp.json()
        return result.get("data", [])
    except Exception as e:
        logger.warning(f"HLTB search failed for '{title}': {e}")
        return []


async def fetch_hltb_data(title: str, client: httpx.AsyncClient) -> dict | None:
    """Search HowLongToBeat by title and return best match."""
    auth = await _init_hltb_auth(client)
    if not auth:
        return None

    results = await _search_hltb(title, auth, client)
    if not results:
        return None

    best = None
    best_score = 0
    for r in results:
        name = r.get("game_name", "")
        score = fuzz.token_sort_ratio(title.lower(), name.lower())
        if score > best_score:
            best_score = score
            best = r

    if best_score < 60:
        return None

    def _secs_to_mins(val):
        try:
            return round(int(val) / 60, 1)
        except (TypeError, ValueError):
            return None

    hltb_id = best.get("game_id")
    return {
        "hltb_game_id": hltb_id,
        "game_name": best.get("game_name", ""),
        "time_main": _secs_to_mins(best.get("comp_main")),
        "time_plus": _secs_to_mins(best.get("comp_plus")),
        "time_100": _secs_to_mins(best.get("comp_100")),
        "time_all": _secs_to_mins(best.get("comp_all")),
        "count_main": best.get("comp_main_count"),
        "count_plus": best.get("comp_plus_count"),
        "count_100": best.get("comp_100_count"),
        "count_all": best.get("comp_all_count"),
    }

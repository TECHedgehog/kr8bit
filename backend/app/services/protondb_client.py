import httpx
import logging

logger = logging.getLogger(__name__)

PROTONDB_SUMMARY_URL = "https://www.protondb.com/api/v1/reports/summaries/{appid}.json"


def _map_deck_tier(raw: str) -> str:
    mapping = {
        "verified": "verified",
        "playable": "playable",
        "unsupported": "unsupported",
        "unknown": "unknown",
    }
    return mapping.get(raw, "unknown")


async def fetch_protondb_data(steam_app_id: int, client: httpx.AsyncClient) -> dict | None:
    """Fetch ProtonDB summary for a Steam app ID."""
    url = PROTONDB_SUMMARY_URL.format(appid=steam_app_id)
    try:
        resp = await client.get(url, timeout=15)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning(f"ProtonDB fetch failed for {steam_app_id}: {e}")
        return None

    # v1 API response schema
    tier = data.get("tier", "")
    confidence = data.get("confidence", "")
    score = data.get("score")
    total = data.get("total", 0)

    # Steam Deck status from ProtonDB tier mapping
    deck_tier = "unknown"
    if tier in ("platinum", "gold"):
        deck_tier = "playable"
    elif tier == "native":
        deck_tier = "verified"

    return {
        "steam_app_id": steam_app_id,
        "deck_tier": deck_tier,
        "proton_tier": tier,
        "confidence": confidence,
        "score": score,
        "total_reports": total,
    }

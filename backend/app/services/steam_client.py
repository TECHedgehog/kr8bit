import httpx

STEAM_APP_DETAILS_URL = "https://store.steampowered.com/api/appdetails"


async def get_app_details(app_id: int, client: httpx.AsyncClient | None = None) -> dict | None:
    if client is None:
        async with httpx.AsyncClient() as c:
            return await get_app_details(app_id, c)

    try:
        resp = await client.get(
            STEAM_APP_DETAILS_URL,
            params={"appids": app_id, "l": "english", "cc": "US"},
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
    except Exception:
        return None

    if result and str(app_id) in result and result[str(app_id)].get("success"):
        return result[str(app_id)]["data"]
    return None


def extract_steam_deck_status(data: dict) -> str:
    """Extract Steam Deck verification status from appdetails categories."""
    categories = data.get("categories", [])
    if not categories:
        return ""

    for cat in categories:
        desc = cat.get("description", "").lower()
        if "verified" in desc and "deck" in desc:
            return "verified"
        if "playable" in desc and "deck" in desc:
            return "playable"
        if "unsupported" in desc and "deck" in desc:
            return "unsupported"

    return ""


def parse_steam_meta(data: dict) -> dict:
    screenshots = []
    for i, ss in enumerate(data.get("screenshots", [])):
        screenshots.append({
            "thumbnail_url": ss.get("path_thumbnail", ""),
            "full_url": ss.get("path_full", ""),
            "index_order": i,
        })

    videos = []
    for i, mv in enumerate(data.get("movies", [])):
        videos.append({
            "name": mv.get("name", ""),
            "thumbnail_url": mv.get("thumbnail", ""),
            "mp4_url": mv.get("mp4", {}).get("max", "") if isinstance(mv.get("mp4"), dict) else "",
            "webm_url": mv.get("webm", {}).get("max", "") if isinstance(mv.get("webm"), dict) else "",
            "dash_url": mv.get("dash_h264", ""),
            "hls_url": mv.get("hls_h264", ""),
            "is_highlight": mv.get("highlight", False),
            "index_order": i,
        })

    genres = []
    for g in data.get("genres", []):
        genres.append({
            "name": g.get("description", ""),
            "slug": g.get("id", "").lower(),
        })

    categories = []
    for c in data.get("categories", []):
        categories.append({
            "steam_category_id": c.get("id", 0),
            "name": c.get("description", ""),
        })

    reqs = []
    for req_type in ("minimum", "recommended"):
        section = data.get("pc_requirements", {}).get(req_type, "")
        if section:
            parsed = _parse_requirements(section)
            parsed["req_type"] = req_type
            reqs.append(parsed)

    platforms = data.get("platforms", {})
    recommendations = data.get("recommendations", {})

    return {
        "steam_name": data.get("name", ""),
        "description": data.get("short_description", ""),
        "description_full": data.get("detailed_description", ""),
        "header_image": data.get("header_image", ""),
        "capsule_image": data.get("capsule_imagev5", data.get("capsule_image", "")),
        "background_image": data.get("background", ""),
        "metacritic_score": data.get("metacritic", {}).get("score"),
        "steam_rating_percent": None,
        "steam_rating_count": recommendations.get("total"),
        "release_date_steam": data.get("release_date", {}).get("date", ""),
        "website": data.get("website", ""),
        "platforms_windows": platforms.get("windows", False),
        "platforms_mac": platforms.get("mac", False),
        "platforms_linux": platforms.get("linux", False),
        "screenshots": screenshots,
        "videos": videos,
        "genres": genres,
        "categories": categories,
        "system_requirements": reqs,
        "steam_deck_status": extract_steam_deck_status(data),
    }


def _parse_requirements(html_section: str) -> dict:
    import re
    req = {"os": "", "processor": "", "memory": "", "graphics": "", "directx": "", "storage": "", "notes": ""}

    labels = {
        "os": r"OS[:\s]*([^<]*)",
        "processor": r"Processor[:\s]*([^<]*)",
        "memory": r"Memory[:\s]*([^<]*)",
        "graphics": r"Graphics[:\s]*([^<]*)",
        "directx": r"DirectX[:\s]*([^<]*)",
        "storage": r"Storage[:\s]*([^<]*)",
        "notes": r"Additional Notes[:\s]*([^<]*)",
    }

    for key, pattern in labels.items():
        m = re.search(pattern, html_section, re.IGNORECASE)
        if m:
            val = re.sub(r"<[^>]+>", "", m.group(1)).strip()
            req[key] = val[:200]

    return req

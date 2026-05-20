import html
import re
from bs4 import BeautifulSoup, Tag
from typing import Optional


def parse_game_post(post: dict) -> dict:
    raw_title: str = html.unescape(post.get("title", {}).get("rendered", ""))
    raw_content: str = post.get("content", {}).get("rendered", "")
    slug: str = post.get("slug", "")
    date_gmt: str = post.get("date_gmt", "") or post.get("date", "")

    # Unescape HTML entities in content too
    content = html.unescape(raw_content)

    soup = BeautifulSoup(content, "lxml")

    # Extract structured title info
    title_meta = extract_title_meta(raw_title)

    result = {
        "title": title_meta["base_name"],
        "slug": slug,
        "content_html": raw_content,
        "content_text": soup.get_text(separator=" ", strip=True),
        "date_published": date_gmt,
        "title_original": raw_title,
        "fitgirl_version": title_meta["version"],
        "edition": title_meta["edition"],
        "dlc_info": title_meta["dlc_info"],
        "companies": "",
        "languages": "",
        "original_size": "",
        "repack_size": "",
        "selective_download": "",
        "image_url": "",
        "magnet_links": [],
        "torrent_files": [],
        "download_mirrors": [],
    }

    result["original_size"] = _extract_original_size(soup)
    result["repack_size"] = _extract_repack_size(soup)
    if _is_empty_size(result["repack_size"]):
        result["repack_size"] = _extract_size_from_repack_features(soup.get_text())
    result["selective_download"] = _extract_selective_download(soup)
    result["companies"] = _extract_companies(soup)
    result["languages"] = _extract_languages(soup)
    result["image_url"] = _extract_image(soup)
    result["magnet_links"] = _extract_magnet_links(soup)
    result["torrent_files"] = _extract_torrent_urls(soup)
    result["download_mirrors"] = _extract_direct_links(soup)

    return result


# ---------------------------------------------------------------------------
# Title parsing helpers
# ---------------------------------------------------------------------------

_EDITION_NAMES = (
    r"Deluxe|Complete|Definitive|Ultimate|Gold|Digital Deluxe|Premium|Collector|"
    r"Game of the Year|GOTY|Enhanced|Supporter|Anniversary|Standard|Special|"
    r"Platinum|Legendary|Master|Champion|Royal|Shadow|Nightmare|Silver|Bronze"
)

_EDITION_PATTERN = re.compile(
    r"(?:\s*[-–—:,]\s*|\s+)(?:"
    + _EDITION_NAMES
    + r")\s*(?:Edition|Bundle|Package|Collection|Set)?\b",
    re.IGNORECASE,
)

_VERSION_PATTERNS = [
    # v1.402, v2024.03.15, v1.0+
    re.compile(r"\bv(?:\d{4}[.\-/])?\d+(?:[.\-_]\d+)*(?:\+|[a-z])?\b", re.IGNORECASE),
    # Build 89496 or Build 1311.23
    re.compile(r"\bBuild\s+\d+(?:\.\d+)*\b", re.IGNORECASE),
    # Update v2
    re.compile(r"\bUpdate\s+(?:v?)?\d+(?:[.]\d+)*\b", re.IGNORECASE),
]

_DLC_PATTERNS = [
    re.compile(r"\+\s*\d+\s*(?:DLCs?|Bonus(?:es)?|Soundtrack|OST)s?", re.IGNORECASE),
    re.compile(r"\d+\s*DLCs?\s*(?:/\s*Bonuses)?", re.IGNORECASE),
    re.compile(r"\+\s*(?:DLCs?|OSTs?)\s*(?:Pack|Bundle|Content)?\b", re.IGNORECASE),
    re.compile(r"\+\s*Bonus\s+(?:Content|OST|Soundtrack)", re.IGNORECASE),
    re.compile(r"\bIn-Game\s+Editor\s*DLC\b", re.IGNORECASE),
]

_NOISE_PATTERNS = [
    re.compile(r"\[HV\]", re.IGNORECASE),
    re.compile(r"\[Selective\s+Download\]", re.IGNORECASE),
    re.compile(r"\*\s*$"),
    re.compile(r"\b(?:from\s+[\d.]+\s*[GT]B)\b", re.IGNORECASE),
]


def extract_title_meta(raw_title: str) -> dict:
    """
    Break down a repack title into structured parts.

    Returns {"base_name": str, "version": str, "edition": str, "dlc_info": str}
    """
    title = raw_title.strip()
    title = html.unescape(title)

    # Step 1: extract DLC info
    dlc_info = ""
    for pat in _DLC_PATTERNS:
        m = pat.search(title)
        if m:
            dlc_info = m.group(0).strip()
            title = title[: m.start()] + title[m.end() :]
            break

    # Step 2: extract edition
    edition = ""
    m = _EDITION_PATTERN.search(title)
    if m:
        edition = m.group(0).strip(" -–—:,\t")
        title = title[: m.start()] + title[m.end() :]

    # Step 3: extract version
    version = ""
    for pat in _VERSION_PATTERNS:
        m = pat.search(title)
        if m:
            version = m.group(0).strip()
            # Remove the version from the title
            title = title[: m.start()] + title[m.end() :]
            break

    # Step 4: strip noise tags
    for pat in _NOISE_PATTERNS:
        title = pat.sub("", title)

    # Step 5: clean up separators and whitespace
    title = re.sub(r"[–\u2013\u2014]", " ", title)
    title = re.sub(r"\s*&amp;\s*", " & ", title)
    title = re.sub(r"\s*&\s*", " & ", title)
    title = re.sub(r"\s*[-+:]\s*$", "", title)
    title = re.sub(r"^[,:\-\s]+", "", title)
    title = re.sub(r"[,:\-\s]+$", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"\s*[-+,]\s*$", "", title).strip()

    return {
        "base_name": title,
        "version": version,
        "edition": edition,
        "dlc_info": dlc_info,
    }


# ---------------------------------------------------------------------------
# Content parsing helpers
# ---------------------------------------------------------------------------

def _extract_original_size(soup: BeautifulSoup) -> str:
    """Extract original size from structured HTML, returning only size values."""
    size = _find_size_in_soup(soup, "Original Size")
    if size:
        return size
    # Fallback: regex on text
    text = soup.get_text()
    m = re.search(
        r"Original\s*Size[\s:]*([\d.]+\s*[GTMK]B)", text, re.IGNORECASE
    )
    if m:
        return _clean_size(m.group(1))
    return ""


def _is_empty_size(s: str) -> bool:
    """True if size is empty or just a unit with no number."""
    if not s:
        return True
    return not bool(re.search(r"\d", s))


def _extract_size_from_repack_features(text: str) -> str:
    """
    Fallback: extract repack size from 'Repack Features' section text.
    Looks for patterns like 'compressed from X to Y GB' where the normal
    size field is empty/unit-only.
    """
    patterns = [
        r"compressed\s+from\s+[\d.,]+(?:\s*[GTMK]B)?\s+to\s+([\d.,]+\s*[GTMK]B)",
        r"compressed\s+from\s+[\d.,]+(?:\s*[GTMK]B)?\s+to\s+([\d.,]+\s*[-–—]\s*[\d.,]+\s*[GTMK]B)",
        r"smaller\s*archive\s*size[,\s]*\([^)]*\)\s*([\d.,]+\s*[GTMK]B)",
        r"archive\s*size[,\s]*\([^)]*\)\s*([\d.,]+\s*[GTMK]B)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            raw = m.group(1).strip()
            cleaned = _clean_size_only(raw)
            if cleaned and re.search(r"\d", cleaned):
                return cleaned
    return ""


def _clean_size_only(raw: str) -> str:
    """Extract a size value from raw text without using a full regex parse.

    Unlike _clean_size, this preserves ranges (e.g. '3-4 GB') because
    the calling context already captures the correct value.
    """
    clean = re.sub(r"<[^>]+>", "", raw)
    sizes = re.findall(r"[\d.,–—\-]+\s*[GTMK]B", clean, re.IGNORECASE)
    if sizes:
        return sizes[0]
    clean = re.sub(r"\s*\([^)]*\)", "", clean)
    clean = re.sub(r"\s*\[[^\]]*\]", "", clean)
    return clean.strip()[:30]


def _extract_repack_size(soup: BeautifulSoup) -> str:
    """Extract repack size, handling multi-part and range formats."""
    size = _find_size_in_soup(soup, "Repack Size")
    if size:
        return size
    # Fallback: regex on text
    text = soup.get_text()
    # Try "from X GB" format first
    m = re.search(
        r"Repack\s*Size[\s:]*(?:from\s+)?([\d.]+\s*[GTMK]B.*?)(?:\n|$)",
        text,
        re.IGNORECASE,
    )
    if m:
        return _clean_size(m.group(1))
    # Fallback: extract from "Repack Features" section if normal fields are empty
    features_text = _extract_repack_features_text(text)
    if features_text:
        extracted = _extract_size_from_repack_features(features_text)
        if extracted:
            return extracted
    return ""


def _extract_repack_features_text(text: str) -> str:
    """Extract the Repack Features section from full page text."""
    m = re.search(r"Repack\s+Features[\s:*]*(.*?)(?:\n\n|\Z)", text, re.IGNORECASE | re.DOTALL)
    if m:
        return m.group(1)[:2000]
    return ""


def _find_size_in_soup(soup: BeautifulSoup, label: str) -> str:
    """
    Look for a <strong> or <b> tag containing the label, then grab
    the size value from the sibling text.
    """
    for tag in soup.find_all(["strong", "b", "p"]):
        text = tag.get_text(strip=True)
        if label.lower() in text.lower():
            # The size often follows the label in the same element
            full = text
            m = re.search(
                rf"{re.escape(label)}[\s:]*(.+)", full, re.IGNORECASE
            )
            if m:
                raw = m.group(1).strip()
                return _clean_size(raw)
            # Or the size may be in the next sibling
            nxt = tag.next_sibling
            if nxt and isinstance(nxt, str):
                return _clean_size(nxt.strip())
    return ""


def _clean_size(raw: str) -> str:
    """Remove HTML remnants and notes, keep only size values."""
    # Strip HTML tags if any leaked in
    clean = re.sub(r"<[^>]+>", "", raw)
    # Extract all size patterns (e.g. "4.2 GB", "from 2.1 GB / 2.4 GB")
    sizes = re.findall(r"(?:from\s+)?[\d.]+\s*[GTMK]B(?:\s*/\s*[\d.]+\s*[GTMK]B)?", clean, re.IGNORECASE)
    if sizes:
        return sizes[0]
    # Fallback: take up to 30 chars, strip notes in parentheses
    clean = re.sub(r"\s*\([^)]*\)", "", clean)
    clean = re.sub(r"\s*\[[^\]]*\]", "", clean)
    clean = clean.strip()[:30]
    return clean


def _extract_selective_download(soup: BeautifulSoup) -> str:
    text = soup.get_text()
    if re.search(r"\[Selective Download\]", text, re.IGNORECASE):
        return "Yes"
    m = re.search(r"Selective Download[\s:]*(.+?)(?:\n|<br)", text, re.IGNORECASE)
    if m:
        return re.sub(r"<[^>]+>", "", m.group(1)).strip()[:50]
    return ""


def _extract_companies(soup: BeautifulSoup) -> str:
    text = soup.get_text()
    m = re.search(r"Companies[\s:]*(.+?)(?:\n|<br)", text, re.IGNORECASE)
    if m:
        return re.sub(r"<[^>]+>", "", m.group(1)).strip()[:300]
    return ""


def _extract_languages(soup: BeautifulSoup) -> str:
    text = soup.get_text()
    m = re.search(r"Languages[\s:]*(.+?)(?:\n|<br)", text, re.IGNORECASE)
    if m:
        return re.sub(r"<[^>]+>", "", m.group(1)).strip()[:200]
    return ""


def _extract_image(soup: BeautifulSoup) -> str:
    img = soup.find("img", class_="alignleft")
    if img and img.get("src"):
        return img["src"]
    img = soup.find("img")
    if img and img.get("src"):
        return img["src"]
    return ""


def _extract_magnet_links(soup: BeautifulSoup) -> list[dict]:
    magnets = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = html.unescape(a["href"])
        if href.startswith("magnet:?xt=urn:btih:"):
            if href not in seen:
                seen.add(href)
                info_hash = ""
                ih = re.search(r"urn:btih:([A-Fa-f0-9]+)", href)
                if ih:
                    info_hash = ih.group(1).upper()
                magnets.append({
                    "magnet_uri": href,
                    "info_hash": info_hash,
                    "source": "fitgirl",
                })
    # Fallback: search raw HTML
    if not magnets:
        raw_html = str(soup)
        for m in re.finditer(
            r'magnet:\?xt=urn:btih:([A-Fa-f0-9]+)[^"\'\s<>]*', raw_html
        ):
            href = html.unescape(m.group(0))
            if href not in seen:
                seen.add(href)
                info_hash = m.group(1).upper()
                magnets.append({
                    "magnet_uri": href,
                    "info_hash": info_hash,
                    "source": "fitgirl",
                })
    return magnets


def _extract_torrent_urls(soup: BeautifulSoup) -> list[dict]:
    torrents = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = html.unescape(a["href"])
        text = a.get_text(strip=True).lower()

        is_torrent_page = any(
            s in href for s in ["1337x.to", "rutor.info", "tapochek.net", "rutracker"]
        )
        is_magnet = href.startswith("magnet:")
        is_torrent_file = href.endswith(".torrent")

        if is_torrent_page and not is_magnet:
            if href not in seen:
                seen.add(href)
                source = (
                    "1337x"
                    if "1337x" in href
                    else "rutor"
                    if "rutor" in href
                    else "tapochek"
                    if "tapochek" in href
                    else "other"
                )
                torrents.append({"torrent_url": href, "source": source})
        elif is_torrent_file:
            if href not in seen:
                seen.add(href)
                torrents.append({"torrent_url": href, "source": "direct"})
    return torrents


def _extract_direct_links(soup: BeautifulSoup) -> list[dict]:
    mirrors = []
    seen = set()

    MIRROR_PATTERNS = {
        "https://datanodes.to/": "datanodes",
        "https://fuckingfast.co/": "fuckingfast",
        "https://fuckingfast.cc/": "fuckingfast",
        "https://mega.nz/": "mega",
        "https://1fichier.com/": "1fichier",
        "https://www.1fichier.com/": "1fichier",
        "https://gofile.io/": "gofile",
        "https://pixeldrain.com/": "pixeldrain",
        "https://krakenfiles.com/": "krakenfiles",
    }

    for a in soup.find_all("a", href=True):
        href = html.unescape(a["href"])
        text = a.get_text(strip=True)
        for prefix, mtype in MIRROR_PATTERNS.items():
            if href.startswith(prefix):
                if href not in seen:
                    seen.add(href)
                    mirrors.append({"url": href, "mirror_type": mtype, "filename": text})
                break
        else:
            if "paste.fitgirl-repacks.site" in href and "Filehoster" in text:
                if href not in seen:
                    seen.add(href)
                    mtype = "multi" if "MultiUpload" in text else "filehoster"
                    mirrors.append({"url": href, "mirror_type": mtype, "filename": ""})

    return mirrors

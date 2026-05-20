import html
import re
from thefuzz import fuzz

_EDITION_NAMES = (
    r"Deluxe|Complete|Definitive|Ultimate|Gold|Digital Deluxe|Premium|Collector|"
    r"Game of the Year|GOTY|Enhanced|Supporter|Anniversary|Annoversary|Standard|Special"
)

_REPACK_NOISE = re.compile(
    r"\[HV\]|\[Selective Download\]|\[[^\]]*Repack[^\]]*\]",
    re.IGNORECASE,
)

_MS_STORE_RE = re.compile(
    r"\s*\(.*?\)\s*MS\s+Store\b",
    re.IGNORECASE,
)

def clean_title(raw_title: str) -> str:
    title = raw_title.strip()

    title = html.unescape(title)

    title = _REPACK_NOISE.sub("", title)

    title = re.sub(r"\*", "", title)

    title = re.sub(r"\s*/\s*Bonuses\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*/\s*(?:Release|Update|Patch)\b[^/,]*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*/\s*\(.*?\)\s*", "", title)
    title = re.sub(r"\s*/\s*v\d+[\d.\-]*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*/\s*\d+(?:\.\d+)*", "", title)
    title = re.sub(r"\s*/\s*(?:Online|Offline|GOG|Steam|MS\s*Store)\b[^,/]*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*/\s*&?\s*[^,\s/+]*$", "", title)
    title = re.sub(r"\s*/\s*(?:Data\s+Pack|Update\s+v?\d+\.[\d.]+)\b", "", title, flags=re.IGNORECASE)

    title = re.sub(r"\+\s*Windows\s+\d+\s+Fix\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*Win\d+\s+Fix\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*HotFix\b", "", title, flags=re.IGNORECASE)

    title = re.sub(r"\s*\(partial\)\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(Release\)\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(Release\s*,[^)]*\)", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(Denuvoless\)\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(Re-release\)\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(Legacy\)\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\([^)]*(?:Update|Patch|Fix|Build|Beta|Alpha|Early\s*Access)\w*\)\s*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(\s*[A-Za-z0-9]{5,}\s*\)\s*", "", title)
    title = re.sub(r"\s*\([^)]*,[^)]*\)\s*", "", title)

    title = re.sub(r"\s*\(\s*(?:Proper\s+)?Crack\s*\)\s*", "", title, flags=re.IGNORECASE)

    title = _MS_STORE_RE.sub("", title)

    title = re.sub(r"[,\s]*\bv\d+[\d.\-]*\w*(?:\s*\([^)]*\))?", "", title, flags=re.IGNORECASE)
    title = re.sub(r"[,\s]*\bv[A-Za-z]?[\d.\-]+[\d.\w]*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\bBuild\s+\d+", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\bBuild\s+[A-Za-z]*\d+[\d.\-]*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*#\d+\b", "", title)
    title = re.sub(r"[,\s]*-[dD]\.?\s*[\d.]+", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(\s*[\d.]+\s*\)", "", title)
    title = re.sub(r"\s*\.\d+\w*$", "", title)

    title = re.sub(r",?\s*\d{4,}\s*$", "", title)

    title = re.sub(r"\+\s*\d+\s*Bonus\s+Soundtracks?\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*\d+\s*DLCs?\s*/\s*Bonuses?", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*\d+\s*(?:DLCs?|Bonus(?:es)?|Soundtracks?|OSTs?)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\d+\s*DLCs?\s*/\s*Bonuses?", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\d+\s*DLCs?\s*\+[^,]*", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*\d+\s*(?:DLC|OST|Bonus)s?", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*(?:All\s+)?(?:DLCs?|Offline\s+DLCs?)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*(?:Bonus\s+)?(?:Content|OST|Soundtracks?)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*Expansion\s+(?:DLCs?|OSTs?|Soundtracks?)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*Music\s*&?\s*Art\s+Pack\s+DLC\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*\w+\s+Pack\s+DLC\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\bDLCs?\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\bIn-Game\s+Editor\s+DLC\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+(?:\s*\d+)+\s*(?:DLC|OST|Bonus)", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\b(?:from\s+[\d.]+\s*[GT]B)", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*(?:Pre-?order\s+)?(?:Bonus\s+)?(?:Wallpapers?|Soundtracks?|OSTs?)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*Multiplayer\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*Online\s+Co-?op\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*(?:Online|Offline)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*HD\s+Textures?\s+Pack\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*\w+\s+(?:Map|Visual\s+Book|Emulator)\s+DLC\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\b\d+Pack\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*\d+\s+Switch\s+Emulators\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\+\s*(?:Unlocker|Upgrade|Reclaim\s+the\s+Honor|Bonus\s+Content)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\bPACK\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"(?<=[a-z])\s*PACK\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*-\s*b\d+\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*,\s*\.r\d+\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*-\s*[a-z]$", "", title)
    title = re.sub(r",?\s*\+\s*All\s+(?:DLCs?|Offline\s+DLCs?)\s*$", "", title, flags=re.IGNORECASE)
    title = re.sub(r",?\s*\+\s*\d*\s*Bonuses?\s*$", "", title, flags=re.IGNORECASE)

    title = re.sub(r"\bwith\s+[^,/+]*?\bBundle\b", "", title, flags=re.IGNORECASE)

    title = re.sub(r"(?:\s*[,–:]+\s*|\s+)(?:" + _EDITION_NAMES + r")\s*(?:Edition|Bundle|Package|Upgrade)?\b", "", title, flags=re.IGNORECASE)

    title = re.sub(r"\s+&amp;\s+", " & ", title)
    title = re.sub(r"\s+&\s+", " & ", title)
    title = re.sub(r"[–\u2013\u2014]", " ", title)

    title = re.sub(r"\s*\+\s*$", "", title)
    title = re.sub(r"\s*[,]\s*$", "", title)
    title = re.sub(r"^[,:\-\s]+", "", title)
    title = re.sub(r"[,:\-\s]+$", "", title)
    title = re.sub(r"(?:\s*[-+]\s*)+$", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"\s*[,]\s*$", "", title)
    title = re.sub(r"\s+[+\-]\s*$", "", title)
    title = re.sub(r",[,\s]*$", "", title)
    title = re.sub(r"\s*,\s*\(\s*[A-Za-z0-9]+\s*\)\s*$", "", title)

    return title.strip()


def make_search_variants(clean: str) -> list[str]:
    variants = [clean]
    lower = clean.lower()

    alt = re.sub(r"\s*&\s*", " and ", lower)
    if alt != lower:
        variants.append(alt)

    alt = re.sub(r"\s+and\s+", " & ", lower)
    if alt != lower:
        variants.append(alt)

    roman_map = {" i ": " 1 ", " ii ": " 2 ", " iii ": " 3 ", " iv ": " 4 ", " v ": " 5 "}
    for roman, arabic in roman_map.items():
        if roman in f" {lower} ":
            alt2 = f" {lower} ".replace(roman, arabic).strip()
            variants.append(alt2)
            break

    numeral_map = {" 1 ": " i ", " 2 ": " ii ", " 3 ": " iii ", " 4 ": " iv ", " 5 ": " v "}
    for arabic, roman in numeral_map.items():
        if arabic in f" {lower} ":
            alt3 = f" {lower} ".replace(arabic, roman).strip()
            variants.append(alt3)
            break

    striped = re.sub(r"\s*:\s*", " - ", clean)
    if striped != clean:
        variants.append(striped)

    colon_parts = re.split(r"\s*:\s*", clean, maxsplit=1)
    if len(colon_parts) > 1:
        variants.append(colon_parts[0].strip())

    bare = re.sub(r"\s*\(.*?\)", "", clean)
    bare = re.sub(r"\s*/.*", "", bare)
    bare = re.sub(r"\s*\+.*", "", bare)
    bare = re.sub(r"\s*,.*", "", bare)
    bare = bare.strip()
    if bare != clean and len(bare) > 2:
        variants.append(bare)

    return variants


def extract_base_name(raw_title: str) -> str:
    """Extract base game name from a repack title (alias for clean_title)."""
    return clean_title(raw_title)


def verify_igdb_match(clean: str, igdb_result: dict, threshold: int = 60) -> bool:
    igdb_name = igdb_result.get("name", "")
    if not igdb_name:
        return False

    score = fuzz.token_sort_ratio(clean.lower(), igdb_name.lower())
    if score >= threshold:
        return True

    alt_names = igdb_result.get("alternative_names", [])
    if isinstance(alt_names, list):
        for alt in alt_names:
            alt_name = alt if isinstance(alt, str) else alt.get("name", "") if isinstance(alt, dict) else ""
            if alt_name and fuzz.token_sort_ratio(clean.lower(), alt_name.lower()) >= threshold:
                return True

    clean_words = set(re.findall(r"[a-z0-9]+", clean.lower()))
    igdb_words = set(re.findall(r"[a-z0-9]+", igdb_name.lower()))
    if clean_words and igdb_words and clean_words.issubset(igdb_words):
        return True

    return False

from fastapi import APIRouter

from app.config import settings
from app.services.igdb_client import (
    _get_igdb_token,
    get_last_igdb_error,
)

router = APIRouter()


@router.post("/settings/igdb-test")
async def test_igdb_connection():
    client_id = settings.twitch_client_id
    client_secret = settings.twitch_client_secret
    if not client_id or not client_secret:
        return {"connected": False, "error": "TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables are required"}
    token = await _get_igdb_token()
    if not token:
        return {"connected": False, "error": get_last_igdb_error() or "Failed to obtain Twitch access token"}
    return {"connected": True}

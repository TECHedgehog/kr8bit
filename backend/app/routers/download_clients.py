from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.database import get_db
from app.models import DownloadClient
from app.schemas import (
    DownloadClientCreate,
    DownloadClientOut,
    DownloadClientUpdate,
    DownloadClientTestRequest,
    AggregateDownloadStatusOut,
)
from app.services.download_client import (
    get_all_clients,
    get_client_row,
    test_client_connection,
    test_connection_raw,
    add_magnet_to_client,
    get_client_status,
    get_aggregate_status,
    sync_client_torrents_with_db,
    get_sync_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/download-clients/test-connection")
async def test_new_connection(req: DownloadClientTestRequest):
    """Test a connection with raw params (before saving)."""
    connected, error = test_connection_raw(
        req.client_type, req.host, req.username, req.password
    )
    result = {"connected": connected}
    if not connected and error:
        result["error"] = error
    return result


@router.get("/download-clients", response_model=list[DownloadClientOut])
async def list_download_clients(db: AsyncSession = Depends(get_db)):
    rows = await get_all_clients(db)
    return [
        DownloadClientOut(
            id=r.id,
            name=r.name,
            client_type=r.client_type,
            host=r.host,
            username=r.username,
            is_enabled=r.is_enabled,
            is_default=r.is_default,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/download-clients", response_model=DownloadClientOut)
async def create_download_client(
    req: DownloadClientCreate, db: AsyncSession = Depends(get_db)
):
    try:
        if req.is_default:
            result = await db.execute(
                select(DownloadClient).where(DownloadClient.is_default == True)
            )
            for d in result.scalars().all():
                d.is_default = False

        client = DownloadClient(
            name=req.name,
            client_type=req.client_type,
            host=req.host,
            username=req.username,
            password=req.password,
            is_enabled=req.is_enabled,
            is_default=req.is_default,
        )
        db.add(client)
        await db.commit()
        await db.refresh(client)

        return DownloadClientOut(
            id=client.id,
            name=client.name,
            client_type=client.client_type,
            host=client.host,
            username=client.username,
            is_enabled=client.is_enabled,
            is_default=client.is_default,
            created_at=client.created_at,
            updated_at=client.updated_at,
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create download client: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/download-clients/{client_id}", response_model=DownloadClientOut)
async def update_download_client(
    client_id: int, req: DownloadClientUpdate, db: AsyncSession = Depends(get_db)
):
    try:
        client = await get_client_row(db, client_id)
        if client is None:
            raise HTTPException(status_code=404, detail="Download client not found")

        if req.name is not None:
            client.name = req.name
        if req.client_type is not None:
            client.client_type = req.client_type
        if req.host is not None:
            client.host = req.host
        if req.username is not None:
            client.username = req.username
        if req.password is not None:
            client.password = req.password
        if req.is_enabled is not None:
            client.is_enabled = req.is_enabled
        if req.is_default is not None:
            if req.is_default:
                result = await db.execute(
                    select(DownloadClient).where(DownloadClient.is_default == True)
                )
                for d in result.scalars().all():
                    d.is_default = False
            client.is_default = req.is_default

        await db.commit()
        await db.refresh(client)

        return DownloadClientOut(
            id=client.id,
            name=client.name,
            client_type=client.client_type,
            host=client.host,
            username=client.username,
            is_enabled=client.is_enabled,
            is_default=client.is_default,
            created_at=client.created_at,
            updated_at=client.updated_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to update download client {client_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/download-clients/{client_id}")
async def delete_download_client(client_id: int, db: AsyncSession = Depends(get_db)):
    try:
        client = await get_client_row(db, client_id)
        if client is None:
            raise HTTPException(status_code=404, detail="Download client not found")
        await db.delete(client)
        await db.commit()
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete download client {client_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/download-clients/{client_id}/test")
async def test_download_client_connection(
    client_id: int, db: AsyncSession = Depends(get_db)
):
    client = await get_client_row(db, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Download client not found")

    connected, error = await test_client_connection(db, client_id)
    result = {
        "connected": connected,
        "client_id": client_id,
        "name": client.name,
        "client_type": client.client_type,
    }
    if not connected and error:
        result["error"] = error
    return result


@router.post("/download-clients/{client_id}/add-magnet")
async def add_magnet_to_download_client(
    client_id: int,
    magnet_uri: str = Query(...),
    save_path: str = Query("", max_length=500),
    db: AsyncSession = Depends(get_db),
):
    if not magnet_uri.startswith("magnet:"):
        raise HTTPException(status_code=400, detail="Invalid magnet URI")

    client = await get_client_row(db, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Download client not found")
    if not client.is_enabled:
        raise HTTPException(status_code=400, detail="Download client is disabled")

    result = await add_magnet_to_client(db, client_id, magnet_uri, save_path)
    return {"status": "added" if result else "failed", "result": result}


@router.get("/download-clients/status", response_model=AggregateDownloadStatusOut)
async def download_clients_status(db: AsyncSession = Depends(get_db)):
    return await get_aggregate_status(db)


@router.post("/download-clients/{client_id}/sync")
async def sync_download_client(client_id: int, db: AsyncSession = Depends(get_db)):
    client = await get_client_row(db, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Download client not found")
    if not client.is_enabled:
        raise HTTPException(status_code=400, detail="Download client is disabled")

    updated = await sync_client_torrents_with_db(db, client_id)
    return {"updated": updated}


@router.get("/download-clients/sync-summary")
async def download_clients_sync_summary(db: AsyncSession = Depends(get_db)):
    return await get_sync_summary(db)

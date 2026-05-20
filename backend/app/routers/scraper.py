from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Game, ScrapeLog
from app.schemas import ScrapeStatusOut
from app.services.scraper import scrape_all, reset_scrape

router = APIRouter()


@router.get("/scraper/status", response_model=ScrapeStatusOut)
async def get_scraper_status(db: AsyncSession = Depends(get_db)):
    last = await db.execute(
        select(ScrapeLog).order_by(desc(ScrapeLog.run_date)).limit(1)
    )
    last_log = last.scalar_one_or_none()
    total = (await db.execute(select(func.count(Game.id)))).scalar() or 0

    return ScrapeStatusOut(
        is_running=False,
        last_run=last_log.run_date if last_log else None,
        last_status=last_log.status if last_log else None,
        last_pages=last_log.pages_scraped if last_log else None,
        total_games=total,
    )


@router.post("/scraper/run")
async def trigger_scrape(db: AsyncSession = Depends(get_db)):
    result = await scrape_all(db)
    return {"status": "completed", **result}


@router.post("/scraper/full")
async def trigger_full_scrape(db: AsyncSession = Depends(get_db)):
    result = await scrape_all(db)
    return {"status": "completed", **result}


@router.delete("/scraper/reset")
async def reset_scrape_data(
    confirm: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Pass ?confirm=true to confirm deletion of all scraped data",
        )
    result = await reset_scrape(db)
    return result


@router.post("/scraper/rebuild-fts")
async def rebuild_fts_index(db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM games_fts"))
    await db.execute(text("""
        INSERT INTO games_fts(rowid, title, title_clean, content_text, description, companies)
        SELECT id, COALESCE(title,''), COALESCE(title_clean,''), COALESCE(content_text,''), COALESCE(description,''), COALESCE(description,''), COALESCE(companies,'')
        FROM games
    """))
    await db.commit()
    count = (await db.execute(text("SELECT COUNT(*) FROM games_fts"))).scalar()
    return {"status": "completed", "fts_rows": count}
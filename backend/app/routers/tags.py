from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Tag
from app.schemas import TagOut

router = APIRouter()


@router.get("/tags", response_model=list[TagOut])
async def list_tags(
    search: str = Query("", max_length=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Tag).order_by(Tag.name)
    if search:
        query = query.where(Tag.name.ilike(f"%{search}%"))
    result = await db.execute(query)
    tags = result.scalars().all()
    return [TagOut.model_validate(t) for t in tags]

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Category
from app.schemas import CategoryOut

router = APIRouter()


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category)
        .where(Category.wp_category_id.in_(settings.game_category_ids))
        .order_by(Category.name)
    )
    categories = result.scalars().all()
    return [CategoryOut.model_validate(c) for c in categories]

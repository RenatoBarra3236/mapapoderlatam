from fastapi import APIRouter, HTTPException
from controllers.flags_controller import detect_flags

router = APIRouter()


@router.get("/{case_id}")
async def flags(case_id: str, lang: str = "es"):
    try:
        return {"flags": detect_flags(case_id, lang)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

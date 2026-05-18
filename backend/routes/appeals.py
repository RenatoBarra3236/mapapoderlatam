from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from controllers.appeals_controller import submit_appeal

router = APIRouter()


class AppealRequest(BaseModel):
    request_type: str = Field(..., description="access|rectification|cancellation|opposition|portability|blocking|human_review")
    relation: str = Field(..., description="subject|legal_rep|affected_company|other")
    name: str = Field(..., min_length=1, max_length=200)
    contact: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=1, max_length=4000)
    lang: str = Field(default="es")


@router.post("/{case_id}")
async def appeal(case_id: str, body: AppealRequest):
    try:
        return submit_appeal(case_id, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"appeal failed: {e}")

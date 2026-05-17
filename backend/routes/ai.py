from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from controllers.ai_controller import generate_summary_and_flags, chat_about_case

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "ai"
    text: str


class ChatRequest(BaseModel):
    question: str
    lang: str = "es"
    history: list[ChatMessage] | None = None


@router.get("/summary/{case_id}")
async def summary(case_id: str, lang: str = "es"):
    try:
        return await generate_summary_and_flags(case_id, lang)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI summary failed: {e}")


@router.post("/chat/{case_id}")
async def chat(case_id: str, body: ChatRequest):
    try:
        answer = await chat_about_case(
            case_id,
            body.question,
            body.lang,
            history=[m.model_dump() for m in body.history] if body.history else None,
        )
        return {"answer": answer}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat failed: {e}")

from uuid import uuid4

from fastapi import APIRouter

from .config import get_settings
from .schemas import DocumentAnalyzeResponse, HealthResponse
from .services.demo_data import build_demo_response


router = APIRouter()
SESSION_STORE: dict[str, dict] = {}


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(ok=True, service="spinout-engine-api", env=settings.APP_ENV)


@router.post("/demo/analyze", response_model=DocumentAnalyzeResponse)
async def demo_analyze() -> DocumentAnalyzeResponse:
    session_id = str(uuid4())
    response = build_demo_response(session_id)
    SESSION_STORE[session_id] = response.model_dump(mode="json", by_alias=True)
    return response


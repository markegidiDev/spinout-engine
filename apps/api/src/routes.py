from __future__ import annotations

import hashlib
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from .config import get_settings
from .schemas import (
    AgentTrace,
    DocumentAnalyzeResponse,
    HealthResponse,
    InvestorAnswerRequest,
    InvestorAnswerResponse,
    InvestorMode,
    InvestorQuestionRequest,
    InvestorQuestionResponse,
    VentureMemo,
)
from .services.demo_data import build_demo_response
from .services.document_parser import (
    DocumentParsingError,
    DocumentValidationError,
    extract_text,
    read_upload_bytes,
    safe_filename,
)
from .services.elevenlabs_service import ElevenLabsService
from .services.openai_service import AIProviderError, OpenAIService
from .services.orchestrator import analyze_document
from .services.storage_service import StorageService


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
    response.documentId = "demo"
    response.filename = "demo-report"
    for item in response.evidence:
        item.sessionId = session_id
        item.documentId = response.documentId
        item.filename = response.filename
    SESSION_STORE[session_id] = response.model_dump(mode="json", by_alias=True)
    return response


@router.post("/documents/analyze", response_model=DocumentAnalyzeResponse)
async def analyze_uploaded_document(file: UploadFile = File(...)) -> DocumentAnalyzeResponse:
    settings = get_settings()
    session_id = str(uuid4())
    storage = StorageService(settings)
    storage_traces: list[AgentTrace] = []

    try:
        data = await read_upload_bytes(file, settings.max_upload_bytes)
        text = extract_text(file.filename, data, file.content_type)
    except DocumentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DocumentParsingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    upload_key = None
    filename = safe_filename(file.filename)
    document_id = hashlib.sha256(data).hexdigest()
    if storage.is_configured():
        upload_key = f"uploads/{session_id}/{uuid4()}-{filename}"
        try:
            storage.upload_bytes(
                key=upload_key,
                data=data,
                content_type=file.content_type or "application/octet-stream",
            )
            storage_traces.append(
                AgentTrace(
                    agent="Storage",
                    status="ok",
                    summary="Uploaded original document to private S3 object storage.",
                )
            )
        except Exception:
            storage_traces.append(
                AgentTrace(
                    agent="Storage",
                    status="fallback",
                    summary="Could not upload original document; continuing without persisted upload.",
                )
            )

    try:
        response = analyze_document(
            session_id=session_id,
            document_id=document_id,
            document_text=text,
            filename=filename,
            settings=settings,
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    response.agentTraces.extend(storage_traces)
    output_keys = _save_outputs_if_configured(response=response, storage=storage)

    session_payload = response.model_dump(mode="json", by_alias=True)
    session_payload["objects"] = {"upload": upload_key, **output_keys}
    SESSION_STORE[session_id] = session_payload
    return response


@router.post("/investor/question", response_model=InvestorQuestionResponse)
async def investor_question(request: InvestorQuestionRequest) -> InvestorQuestionResponse:
    settings = get_settings()
    persona = _persona_for_mode(request.mode)
    question = _generate_investor_question(
        memo=request.memo,
        mode=request.mode,
        persona=persona,
        settings=settings,
    )
    session = SESSION_STORE.setdefault(request.sessionId, {"sessionId": request.sessionId})
    asked = session.setdefault("investorQuestionsAsked", [])
    question_number = len(asked) + 1
    asked.append({"mode": request.mode, "question": question})

    audio_payload = ElevenLabsService(
        settings=settings,
        storage=StorageService(settings),
    ).generate_investor_audio(
        text=question,
        session_id=request.sessionId,
        question_number=question_number,
    )
    return InvestorQuestionResponse(
        question=question,
        investorPersona=persona,
        **audio_payload,
    )


@router.post("/investor/answer", response_model=InvestorAnswerResponse)
async def investor_answer(request: InvestorAnswerRequest) -> InvestorAnswerResponse:
    settings = get_settings()
    response = _evaluate_investor_answer(request=request, settings=settings)
    session = SESSION_STORE.setdefault(request.sessionId, {"sessionId": request.sessionId})
    session.setdefault("investorAnswers", []).append(response.model_dump(mode="json"))
    return response


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    session = SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _save_outputs_if_configured(
    *,
    response: DocumentAnalyzeResponse,
    storage: StorageService,
) -> dict[str, str | None]:
    output_keys: dict[str, str | None] = {"memoJson": None, "memoMarkdown": None}
    if not storage.is_configured():
        return output_keys

    json_key = f"outputs/{response.sessionId}/memo.json"
    markdown_key = f"outputs/{response.sessionId}/memo.md"
    try:
        storage.upload_bytes(
            key=json_key,
            data=response.memo.model_dump_json(by_alias=True, indent=2).encode("utf-8"),
            content_type="application/json",
        )
        storage.upload_bytes(
            key=markdown_key,
            data=_memo_to_markdown(response.memo).encode("utf-8"),
            content_type="text/markdown; charset=utf-8",
        )
        response.agentTraces.append(
            AgentTrace(
                agent="Storage",
                status="ok",
                summary="Saved memo JSON and Markdown outputs to private S3 object storage.",
            )
        )
        output_keys = {"memoJson": json_key, "memoMarkdown": markdown_key}
    except Exception:
        response.agentTraces.append(
            AgentTrace(
                agent="Storage",
                status="fallback",
                summary="Could not save memo outputs; returning API response only.",
            )
        )
    return output_keys


def _generate_investor_question(
    *,
    memo: VentureMemo,
    mode: InvestorMode,
    persona: str,
    settings,
) -> str:
    fallback = _fallback_question(memo=memo, mode=mode)
    openai = OpenAIService(settings)
    if not openai.is_configured():
        return fallback

    try:
        payload = openai.complete_json(
            system=(
                "You are a generic synthetic investor persona. Never impersonate a real investor. "
                "Ask one sharp, concise question."
            ),
            user=(
                f"Persona: {persona}\nMode: {mode}\n"
                f"Memo: {memo.model_dump_json(by_alias=True)}\n"
                "Return JSON: {\"question\": \"string\"}."
            ),
            model=settings.OPENAI_MODEL_FAST,
        )
        question = str(payload.get("question") or "").strip()
        return question or fallback
    except AIProviderError:
        return fallback


def _evaluate_investor_answer(
    *,
    request: InvestorAnswerRequest,
    settings,
) -> InvestorAnswerResponse:
    fallback = _fallback_answer(request)
    openai = OpenAIService(settings)
    if not openai.is_configured():
        return fallback

    try:
        payload = openai.complete_json(
            system=(
                "You are an investor pitch coach. Score the founder answer strictly but helpfully. "
                "Use the memo as context and do not invent evidence."
            ),
            user=(
                "Return JSON with keys: score, critique, missingEvidence, improvedAnswer, "
                "nextQuestionHint.\n\n"
                f"Question: {request.question}\n"
                f"Founder answer: {request.answer}\n"
                f"Memo: {request.memo.model_dump_json(by_alias=True)}"
            ),
            model=settings.OPENAI_MODEL_FAST,
        )
        return InvestorAnswerResponse.model_validate(payload)
    except (AIProviderError, ValueError):
        return fallback


def _fallback_question(*, memo: VentureMemo, mode: InvestorMode) -> str:
    if memo.investorQuestions:
        if mode == "technical_vc" and len(memo.investorQuestions) >= 4:
            return memo.investorQuestions[3]
        if mode == "customer_angel" and len(memo.investorQuestions) >= 2:
            return memo.investorQuestions[1]
        return memo.investorQuestions[0]
    return "What is the single riskiest assumption in this company idea, and how will you test it first?"


def _fallback_answer(request: InvestorAnswerRequest) -> InvestorAnswerResponse:
    answer_length = len(request.answer.strip())
    evidence_mentions = sum(
        1
        for phrase in ("customer", "pilot", "data", "revenue", "cost", "metric", "evidence")
        if phrase in request.answer.lower()
    )
    score = max(35, min(82, 45 + evidence_mentions * 8 + min(answer_length // 120, 4) * 5))
    return InvestorAnswerResponse(
        score=score,
        critique=(
            "The answer is directionally useful, but it needs sharper proof, a measurable buyer pain, "
            "and a clear next experiment."
        ),
        missingEvidence=[
            "Customer validation tied to a named buyer persona.",
            "A quantified success metric for the next pilot.",
        ],
        improvedAnswer=(
            f"{request.answer.strip()} The next step is to validate this with a focused pilot, "
            "measure the economic impact, and use those results to decide whether the wedge is strong enough."
        ),
        nextQuestionHint="Be ready to quantify willingness to pay and explain why now is the right timing.",
    )


def _persona_for_mode(mode: InvestorMode) -> str:
    personas = {
        "skeptical_vc": "Skeptical VC focused on market size, urgency, defensibility, and fundraising risk.",
        "technical_vc": "Technical VC focused on novelty, implementation risk, data quality, and reproducibility.",
        "customer_angel": "Customer-operator angel focused on workflow pain, buying process, and practical adoption.",
    }
    return personas[mode]


def _memo_to_markdown(memo: VentureMemo) -> str:
    competitors = "\n".join(
        f"- {item.name}: {item.differentiation}" for item in memo.competitors
    )
    risks = "\n".join(
        f"- {item.risk} ({item.severity}): {item.mitigation}" for item in memo.risks
    )
    questions = "\n".join(f"- {question}" for question in memo.investorQuestions)
    missing = "\n".join(f"- {item}" for item in memo.missingEvidence)
    return (
        f"# {memo.title}\n\n"
        f"## One-line Company\n{memo.oneLineCompany}\n\n"
        f"## Problem\n{memo.problem}\n\n"
        f"## Target Customer\n{memo.targetCustomer}\n\n"
        f"## Initial Wedge\n{memo.initialWedge}\n\n"
        f"## Why Now\n{memo.whyNow}\n\n"
        f"## Technical Novelty\n{memo.technicalNovelty}\n\n"
        f"## Technical Moat\n{memo.technicalMoat}\n\n"
        f"## Product Concept\n{memo.productConcept}\n\n"
        f"## Business Model\n{memo.businessModel}\n\n"
        f"## Competitors\n{competitors}\n\n"
        f"## Risks\n{risks}\n\n"
        f"## Missing Evidence\n{missing}\n\n"
        f"## Investor Questions\n{questions}\n\n"
        f"## 60-second Pitch\n{memo.pitch60s}\n\n"
        f"Confidence: {memo.confidence}/100\n"
    )

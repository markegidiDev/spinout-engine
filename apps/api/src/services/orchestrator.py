from __future__ import annotations

import json
import re
import time
from typing import Any

from pydantic import ValidationError

from src.config import Settings
from src.schemas import AgentResult, AgentTrace, DocumentAnalyzeResponse, EvidenceItem, VentureMemo
from src.services.demo_data import build_demo_response
from src.services.gemini_service import GeminiProviderError, GeminiService
from src.services.openai_service import AIProviderError, OpenAIService


SPECIALIST_SYSTEM = (
    "You are a concise venture analyst. Use only the supplied excerpts. "
    "Separate evidence from inference. Do not invent citations or market facts."
)


def analyze_document(
    *,
    session_id: str,
    document_id: str,
    document_text: str,
    filename: str,
    settings: Settings,
) -> DocumentAnalyzeResponse:
    evidence = build_evidence(
        document_text,
        session_id=session_id,
        document_id=document_id,
        filename=filename,
    )
    openai = OpenAIService(settings)

    if not openai.is_configured():
        return _demo_fallback(
            session_id=session_id,
            evidence=evidence,
            reason="OpenAI is not configured",
            settings=settings,
        )

    try:
        paper = paper_intake_agent(openai=openai, evidence=evidence)
        technical = technical_novelty_agent(openai=openai, evidence=evidence)
        market = market_wedge_agent(openai=openai, evidence=evidence)
        competitors = competitor_risk_agent(openai=openai, evidence=evidence)
        synthesis = synthesis_critic_agent(
            openai=openai,
            filename=filename,
            evidence=evidence,
            agent_outputs={
                "paperIntake": paper.data,
                "technicalNovelty": technical.data,
                "marketWedge": market.data,
                "competitorRisk": competitors.data,
            },
        )
    except Exception as exc:
        return _demo_fallback(
            session_id=session_id,
            evidence=evidence,
            reason=f"OpenAI analysis failed: {exc.__class__.__name__}",
            settings=settings,
        )

    response = DocumentAnalyzeResponse(
        sessionId=session_id,
        documentId=document_id,
        filename=filename,
        memo=synthesis.data["memo"],
        evidence=evidence,
        agentTraces=[
            paper.trace,
            technical.trace,
            market.trace,
            competitors.trace,
            synthesis.trace,
        ],
    )
    _apply_gemini_review(response=response, settings=settings)
    return response


def paper_intake_agent(*, openai: OpenAIService, evidence: list[EvidenceItem]) -> AgentResult:
    return _run_specialist_agent(
        openai=openai,
        agent_name="Paper Intake Agent",
        prompt=(
            "Extract paper title, field, core technology, key claims, supporting snippets, "
            "and limitations explicitly mentioned. Return keys: paperTitle, field, "
            "coreTechnology, keyClaims, supportingSnippets, explicitLimitations."
        ),
        evidence=evidence,
    )


def technical_novelty_agent(*, openai: OpenAIService, evidence: list[EvidenceItem]) -> AgentResult:
    return _run_specialist_agent(
        openai=openai,
        agent_name="Technical Novelty Agent",
        prompt=(
            "Extract what is technically new, possible technical moat, implementation "
            "difficulty, technical limitations, and what is still unproven. Return keys: "
            "technicalNovelty, possibleMoat, implementationDifficulty, limitations, unprovenClaims."
        ),
        evidence=evidence,
    )


def market_wedge_agent(*, openai: OpenAIService, evidence: list[EvidenceItem]) -> AgentResult:
    return _run_specialist_agent(
        openai=openai,
        agent_name="Market Wedge Agent",
        prompt=(
            "Infer a venture wedge from the technology. Extract first target customer, "
            "painful use case, buyer persona, why they would pay, and narrow initial wedge. "
            "Return keys: firstTargetCustomer, painfulUseCase, buyerPersona, whyPay, narrowWedge."
        ),
        evidence=evidence,
    )


def competitor_risk_agent(*, openai: OpenAIService, evidence: list[EvidenceItem]) -> AgentResult:
    return _run_specialist_agent(
        openai=openai,
        agent_name="Competitor Risk Agent",
        prompt=(
            "Extract direct and indirect alternatives, business risks, technical risks, "
            "go-to-market risks, and regulatory or data risks if relevant. Return keys: "
            "alternatives, businessRisks, technicalRisks, goToMarketRisks, regulatoryDataRisks."
        ),
        evidence=evidence,
    )


def synthesis_critic_agent(
    *,
    openai: OpenAIService,
    filename: str,
    evidence: list[EvidenceItem],
    agent_outputs: dict[str, Any],
) -> AgentResult:
    start = time.perf_counter()
    memo_shape = {
        "title": "string",
        "oneLineCompany": "string",
        "problem": "string",
        "targetCustomer": "string",
        "initialWedge": "string",
        "whyNow": "string",
        "technicalNovelty": "string",
        "technicalMoat": "string",
        "productConcept": "string",
        "businessModel": "string",
        "competitors": [
            {"name": "string", "whyRelevant": "string", "differentiation": "string"}
        ],
        "milestones": {"30days": ["string"], "60days": ["string"], "90days": ["string"]},
        "risks": [{"risk": "string", "severity": "low|medium|high", "mitigation": "string"}],
        "missingEvidence": ["string"],
        "investorQuestions": ["string"],
        "pitch60s": "string",
        "confidence": 0,
    }
    user = (
        "Synthesize a venture-ready paper-to-company memo. Remove contradictions, "
        "label weak claims as missing evidence, generate exactly 5 investor questions, "
        "and set confidence as an integer from 0 to 100.\n\n"
        f"Filename: {filename}\n"
        f"Required JSON shape: {json.dumps(memo_shape)}\n\n"
        f"Evidence excerpts: {_evidence_json(evidence)}\n\n"
        f"Specialist agent outputs: {json.dumps(agent_outputs, ensure_ascii=False)}"
    )
    raw = openai.complete_json(
        system=(
            "You are the Synthesis Critic Agent. Create a conservative venture memo "
            "from supplied agent outputs and evidence only."
        ),
        user=user,
        model=openai.settings.OPENAI_MODEL_STRONG,
    )
    memo = _validate_memo(raw)
    elapsed = int((time.perf_counter() - start) * 1000)
    return AgentResult(
        data={"memo": memo},
        trace=AgentTrace(
            agent="Synthesis Critic Agent",
            status="ok",
            summary="Merged specialist outputs into a VentureMemo schema.",
            model=openai.settings.OPENAI_MODEL_STRONG,
            latencyMs=elapsed,
        ),
    )


def build_evidence(
    document_text: str,
    *,
    session_id: str,
    document_id: str,
    filename: str,
) -> list[EvidenceItem]:
    sections = _extract_named_sections(document_text)
    evidence: list[EvidenceItem] = []

    for section_name in ("abstract", "introduction", "conclusion", "discussion"):
        if sections.get(section_name):
            evidence.append(
                EvidenceItem(
                    source=section_name,
                    excerpt=_trim_excerpt(sections[section_name], 1800),
                    sessionId=session_id,
                    documentId=document_id,
                    filename=filename,
                )
            )

    if not evidence:
        evidence.append(
            EvidenceItem(
                source="document:start",
                excerpt=_trim_excerpt(document_text, 1800),
                sessionId=session_id,
                documentId=document_id,
                filename=filename,
            )
        )

    keyword_chunks = _keyword_chunks(document_text)
    for index, chunk in enumerate(keyword_chunks[:4], start=1):
        evidence.append(
            EvidenceItem(
                source=f"document:relevant-{index}",
                excerpt=chunk,
                sessionId=session_id,
                documentId=document_id,
                filename=filename,
            )
        )

    tail = document_text[-2200:]
    if tail and all(item.excerpt != _trim_excerpt(tail, 1400) for item in evidence):
        evidence.append(
            EvidenceItem(
                source="document:end",
                excerpt=_trim_excerpt(tail, 1400),
                sessionId=session_id,
                documentId=document_id,
                filename=filename,
            )
        )

    return evidence[:8]


def _apply_gemini_review(*, response: DocumentAnalyzeResponse, settings: Settings) -> None:
    gemini = GeminiService(settings)
    if not gemini.is_configured():
        return

    start = time.perf_counter()
    try:
        review = gemini.review_memo(memo=response.memo, evidence=response.evidence)
        flags = _as_string_list(review.get("hallucinationFlags"))
        missing = _as_string_list(review.get("missingEvidence"))
        response.memo.missingEvidence = _dedupe(response.memo.missingEvidence + flags + missing)
        summary = str(review.get("review") or "Reviewed memo for weak claims and missing proof.")
        status = "ok"
    except GeminiProviderError as exc:
        summary = f"{exc}; continuing with OpenAI memo."
        status = "fallback"

    response.agentTraces.append(
        AgentTrace(
            agent="Gemini Reviewer",
            status=status,
            summary=_trim_excerpt(summary, 260),
            model=settings.GEMINI_MODEL,
            latencyMs=int((time.perf_counter() - start) * 1000),
        )
    )


def _run_specialist_agent(
    *,
    openai: OpenAIService,
    agent_name: str,
    prompt: str,
    evidence: list[EvidenceItem],
) -> AgentResult:
    start = time.perf_counter()
    data = openai.complete_json(
        system=SPECIALIST_SYSTEM,
        user=f"{prompt}\n\nEvidence excerpts: {_evidence_json(evidence)}",
        model=openai.settings.OPENAI_MODEL_FAST,
    )
    elapsed = int((time.perf_counter() - start) * 1000)
    return AgentResult(
        data=data,
        trace=AgentTrace(
            agent=agent_name,
            status="ok",
            summary=_agent_summary(data),
            model=openai.settings.OPENAI_MODEL_FAST,
            latencyMs=elapsed,
        ),
    )


def _validate_memo(data: dict[str, Any]) -> VentureMemo:
    candidate = dict(data)
    if "confidence" in candidate and isinstance(candidate["confidence"], float):
        candidate["confidence"] = int(round(candidate["confidence"] * 100 if candidate["confidence"] <= 1 else candidate["confidence"]))
    try:
        return VentureMemo.model_validate(candidate)
    except ValidationError as exc:
        raise AIProviderError("Synthesis output did not match VentureMemo schema") from exc


def _demo_fallback(
    *,
    session_id: str,
    evidence: list[EvidenceItem],
    reason: str,
    settings: Settings,
) -> DocumentAnalyzeResponse:
    if settings.is_production or not settings.ENABLE_DEMO_FIXTURES:
        raise AIProviderError(reason)

    response = build_demo_response(session_id)
    response.documentId = evidence[0].documentId if evidence else "demo"
    response.filename = evidence[0].filename if evidence else "demo-report"
    response.evidence = evidence or response.evidence
    response.agentTraces.append(
        AgentTrace(
            agent="OpenAI Fallback",
            status="fallback",
            summary=f"{reason}; returned local demo memo.",
            model=None,
            latencyMs=0,
        )
    )
    return response


def _extract_named_sections(text: str) -> dict[str, str]:
    heading_pattern = re.compile(
        r"(?im)^\s*(abstract|introduction|background|methods?|results?|discussion|conclusion)\s*:?\s*$"
    )
    matches = list(heading_pattern.finditer(text))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        name = match.group(1).lower()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[name] = text[start:end].strip()
    return sections


def _keyword_chunks(text: str) -> list[str]:
    paragraphs = [paragraph.strip() for paragraph in re.split(r"\n{2,}", text) if paragraph.strip()]
    keywords = re.compile(
        r"\b(novel|latency|accuracy|prototype|experiment|result|limitation|customer|market|risk|deploy|edge|model)\b",
        flags=re.IGNORECASE,
    )
    chunks = [_trim_excerpt(paragraph, 1200) for paragraph in paragraphs if keywords.search(paragraph)]
    return _dedupe(chunks)


def _trim_excerpt(text: str, limit: int) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rsplit(" ", 1)[0] + "..."


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        key = value[:180].lower()
        if key not in seen:
            seen.add(key)
            unique.append(value)
    return unique


def _as_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return [str(value)]


def _evidence_json(evidence: list[EvidenceItem]) -> str:
    return json.dumps([item.model_dump() for item in evidence], ensure_ascii=False)


def _agent_summary(data: dict[str, Any]) -> str:
    keys = ", ".join(list(data.keys())[:5])
    return f"Extracted structured fields: {keys or 'none'}."

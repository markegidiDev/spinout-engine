from __future__ import annotations

import json
import re
import time
from typing import Any

from pydantic import ValidationError

from src.config import Settings
from src.schemas import AgentResult, AgentTrace, DocumentAnalyzeResponse, EvidenceItem, EvidenceSection, VentureMemo
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
    evidence_sections = build_evidence_sections(
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
            evidence_sections=evidence_sections,
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
        evidence_sections = evidence_section_summary_agent(
            openai=openai,
            sections=evidence_sections,
        )
    except Exception as exc:
        return _demo_fallback(
            session_id=session_id,
            evidence=evidence,
            evidence_sections=evidence_sections,
            reason=f"OpenAI analysis failed: {exc.__class__.__name__}",
            settings=settings,
        )

    response = DocumentAnalyzeResponse(
        sessionId=session_id,
        documentId=document_id,
        filename=filename,
        memo=synthesis.data["memo"],
        evidence=evidence,
        evidenceSections=evidence_sections,
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


def evidence_section_summary_agent(
    *,
    openai: OpenAIService,
    sections: list[EvidenceSection],
) -> list[EvidenceSection]:
    if not sections:
        return sections

    requested = [
        {
            "kind": section.kind,
            "title": section.title,
            "sourceLabel": section.sourceLabel,
            "source": section.source[:2200],
        }
        for section in sections
    ]
    try:
        raw = openai.complete_json(
            system=(
                "You summarize official source excerpts from an uploaded research document. "
                "Use only the supplied source text. Do not add outside facts. "
                "Write 3 to 5 clear sentences per section for a non-technical product demo audience."
            ),
            user=(
                "Return JSON with key evidenceSections. Each item must include kind and summary. "
                "Keep exactly these kinds: abstract, technology, evidence, limitations.\n\n"
                f"Sections: {json.dumps(requested, ensure_ascii=False)}"
            ),
            model=openai.settings.OPENAI_MODEL_STRONG,
        )
    except Exception:
        return sections
    summaries = {
        str(item.get("kind")): str(item.get("summary") or "").strip()
        for item in raw.get("evidenceSections", [])
        if isinstance(item, dict)
    }
    output: list[EvidenceSection] = []
    for section in sections:
        summary = summaries.get(section.kind) or _fallback_section_summary(section.source)
        output.append(section.model_copy(update={"summary": summary}))
    return output


def build_evidence(
    document_text: str,
    *,
    session_id: str,
    document_id: str,
    filename: str,
) -> list[EvidenceItem]:
    document_text = _normalize_document_text(document_text)
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
                excerpt=_trim_excerpt(_without_references(document_text), 1800),
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

    return evidence[:8]


def build_evidence_sections(
    document_text: str,
    *,
    session_id: str,
    document_id: str,
    filename: str,
) -> list[EvidenceSection]:
    document_text = _normalize_document_text(document_text)
    sections = _extract_named_sections(document_text)
    body_text = _without_references(document_text)

    specs = [
        (
            "abstract",
            "Abstract excerpt",
            "Abstract",
            _first_available(
                sections.get("abstract"),
                _extract_inline_section(document_text, "abstract", ("keywords", "1. introduction", "introduction")),
                _trim_excerpt(body_text, 1600),
            ),
        ),
        (
            "technology",
            "Technology excerpt",
            "Technology / methods",
            _best_keyword_chunk(
                body_text,
                r"\b(creatine|technology|mechanism|metabolism|method|synthesis|transport|store|cellular|phosphocreatine|supplementation)\b",
            ),
        ),
        (
            "evidence",
            "Evidence excerpt",
            "Evidence / results",
            _best_keyword_chunk(
                body_text,
                r"\b(evidence|study|studies|result|results|reported|shown|demonstrated|benefit|performance|trial|clinical|crossref|pubmed)\b",
            ),
        ),
        (
            "limitations",
            "Limitations excerpt",
            "Limitations / discussion",
            _first_available(
                sections.get("discussion"),
                sections.get("conclusion"),
                _best_keyword_chunk(
                    body_text,
                    r"\b(limitation|limitations|however|future work|unclear|risk|adverse|conflicting|insufficient|unknown|more research)\b",
                ),
            ),
        ),
    ]

    evidence_sections: list[EvidenceSection] = []
    seen: set[str] = set()
    for kind, title, source_label, source in specs:
        clean_source = _trim_excerpt(source, 1800)
        key = clean_source[:220].lower()
        if key in seen:
            clean_source = _trim_excerpt(_alternate_chunk(body_text, seen), 1800)
            key = clean_source[:220].lower()
        seen.add(key)
        evidence_sections.append(
            EvidenceSection(
                kind=kind,
                title=title,
                summary=_fallback_section_summary(clean_source),
                source=clean_source,
                sourceLabel=source_label,
                sessionId=session_id,
                documentId=document_id,
                filename=filename,
            )
        )
    return evidence_sections


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
    evidence_sections: list[EvidenceSection],
    reason: str,
    settings: Settings,
) -> DocumentAnalyzeResponse:
    if settings.is_production or not settings.ENABLE_DEMO_FIXTURES:
        raise AIProviderError(reason)

    response = build_demo_response(session_id)
    response.documentId = evidence[0].documentId if evidence else "demo"
    response.filename = evidence[0].filename if evidence else "demo-report"
    response.evidence = evidence or response.evidence
    response.evidenceSections = evidence_sections or response.evidenceSections
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


def _clean_source_text(text: str) -> str:
    cleaned = re.sub(r"(?:/gid\d{5})+/?", " ", text or "")
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", cleaned)
    cleaned = cleaned.replace("ﬁ", "fi").replace("ﬂ", "fl")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _normalize_document_text(text: str) -> str:
    cleaned = re.sub(r"(?:/gid\d{5})+/?", " ", text or "")
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", cleaned)
    cleaned = cleaned.replace("ﬁ", "fi").replace("ﬂ", "fl")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in cleaned.splitlines()]
    return "\n".join(line for line in lines if line)


def _without_references(text: str) -> str:
    match = re.search(r"\b(references|bibliography)\b", text, flags=re.IGNORECASE)
    if not match:
        return text
    head = text[: match.start()].strip()
    return head or text


def _first_available(*values: str | None) -> str:
    for value in values:
        clean = _clean_source_text(value or "")
        if len(clean) >= 80:
            return clean
    return _clean_source_text(next((value for value in values if value), "") or "")


def _extract_inline_section(text: str, start_label: str, end_labels: tuple[str, ...]) -> str:
    start = re.search(rf"\b{re.escape(start_label)}\s*:\s*", text, flags=re.IGNORECASE)
    if not start:
        return ""
    tail = text[start.end() :]
    end_indexes = []
    for label in end_labels:
        match = re.search(rf"\b{re.escape(label)}\b\s*:?", tail, flags=re.IGNORECASE)
        if match:
            end_indexes.append(match.start())
    end = min(end_indexes) if end_indexes else min(len(tail), 2200)
    return tail[:end].strip()


def _keyword_chunks(text: str) -> list[str]:
    paragraphs = [paragraph.strip() for paragraph in re.split(r"\n{2,}", text) if paragraph.strip()]
    keywords = re.compile(
        r"\b(novel|latency|accuracy|prototype|experiment|result|limitation|customer|market|risk|deploy|edge|model)\b",
        flags=re.IGNORECASE,
    )
    chunks = [_trim_excerpt(paragraph, 1200) for paragraph in paragraphs if keywords.search(paragraph)]
    return _dedupe(chunks)


def _best_keyword_chunk(text: str, pattern: str) -> str:
    paragraphs = _candidate_paragraphs(text)
    keywords = re.compile(pattern, flags=re.IGNORECASE)
    matches = [paragraph for paragraph in paragraphs if keywords.search(paragraph)]
    if matches:
        return max(matches, key=lambda paragraph: min(len(paragraph), 1800))
    return paragraphs[0] if paragraphs else text[:1800]


def _alternate_chunk(text: str, seen: set[str]) -> str:
    for paragraph in _candidate_paragraphs(text):
        key = paragraph[:220].lower()
        if key not in seen:
            return paragraph
    return text[:1800]


def _candidate_paragraphs(text: str) -> list[str]:
    chunks = [chunk.strip() for chunk in re.split(r"\n{2,}|(?<=\.)\s+(?=[A-Z])", text) if chunk.strip()]
    output: list[str] = []
    for chunk in chunks:
        clean = _clean_source_text(chunk)
        if len(clean) < 120:
            continue
        if _looks_like_reference(clean):
            continue
        output.append(_trim_excerpt(clean, 1800))
    return _dedupe(output)


def _looks_like_reference(text: str) -> bool:
    citation_count = len(re.findall(r"\b\d{4}\b|\[(?:CrossRef|PubMed)\]", text))
    author_list = len(re.findall(r"\b[A-Z][a-z]+,\s+[A-Z]\.", text))
    return citation_count >= 4 or author_list >= 5


def _trim_excerpt(text: str, limit: int) -> str:
    compact = _clean_source_text(text)
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rsplit(" ", 1)[0] + "..."


def _fallback_section_summary(source: str) -> str:
    clean = _trim_excerpt(source, 620)
    if not clean:
        return "No reliable source text was extracted for this section."
    return clean


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

from typing import Any, Literal

from pydantic import BaseModel, Field


Severity = Literal["low", "medium", "high"]
InvestorMode = Literal["skeptical_vc", "technical_vc", "customer_angel"]


class Competitor(BaseModel):
    name: str
    whyRelevant: str
    differentiation: str


class Milestones(BaseModel):
    days30: list[str] = Field(default_factory=list, alias="30days")
    days60: list[str] = Field(default_factory=list, alias="60days")
    days90: list[str] = Field(default_factory=list, alias="90days")


class Risk(BaseModel):
    risk: str
    severity: Severity
    mitigation: str


class VentureMemo(BaseModel):
    title: str
    oneLineCompany: str
    problem: str
    targetCustomer: str
    initialWedge: str
    whyNow: str
    technicalNovelty: str
    technicalMoat: str
    productConcept: str
    businessModel: str
    competitors: list[Competitor] = Field(default_factory=list)
    milestones: Milestones
    risks: list[Risk] = Field(default_factory=list)
    missingEvidence: list[str] = Field(default_factory=list)
    investorQuestions: list[str] = Field(default_factory=list)
    pitch60s: str
    confidence: int = Field(ge=0, le=100)


class EvidenceItem(BaseModel):
    source: str
    excerpt: str


class AgentTrace(BaseModel):
    agent: str
    status: str
    summary: str
    model: str | None = None
    latencyMs: int | None = None


class DocumentAnalyzeResponse(BaseModel):
    sessionId: str
    memo: VentureMemo
    evidence: list[EvidenceItem] = Field(default_factory=list)
    agentTraces: list[AgentTrace] = Field(default_factory=list)


class InvestorQuestionRequest(BaseModel):
    sessionId: str
    memo: VentureMemo
    mode: InvestorMode = "skeptical_vc"


class InvestorQuestionResponse(BaseModel):
    question: str
    investorPersona: str
    audioUrl: str | None = None
    audioBase64: str | None = None
    audioObjectKey: str | None = None


class InvestorAnswerRequest(BaseModel):
    sessionId: str
    question: str
    answer: str
    memo: VentureMemo


class InvestorAnswerResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    critique: str
    missingEvidence: list[str] = Field(default_factory=list)
    improvedAnswer: str
    nextQuestionHint: str


class HealthResponse(BaseModel):
    ok: bool
    service: str
    env: str


class AgentResult(BaseModel):
    data: dict[str, Any]
    trace: AgentTrace


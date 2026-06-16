from __future__ import annotations

from copy import deepcopy
from typing import Any


PLAN_ORDER = ["free", "starter", "team", "studio", "enterprise"]

PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "free": {
        "key": "free",
        "name": "Free",
        "price": "$0",
        "audience": "For testing the concept.",
        "highlighted": False,
        "quotas": {
            "analysesTotal": 2,
            "analysesPerMonth": 0,
            "seats": 1,
            "projects": 0,
            "storageDays": 0,
        },
        "features": [
            "document_analysis",
            "memo_preview",
            "readiness_snapshot",
            "demo_investor_questions",
        ],
    },
    "starter": {
        "key": "starter",
        "name": "Starter",
        "price": "$39/mo",
        "audience": "For solo founders, PhD students, and early spinout teams.",
        "highlighted": False,
        "quotas": {
            "analysesTotal": None,
            "analysesPerMonth": 25,
            "seats": 1,
            "projects": 25,
            "storageDays": 365,
        },
        "features": [
            "document_analysis",
            "full_memo",
            "readiness_risk_breakdown",
            "investor_room_text",
            "markdown_export",
            "saved_history",
            "basic_competitor_prompts",
        ],
    },
    "team": {
        "key": "team",
        "name": "Team",
        "price": "$149/mo",
        "audience": "For labs, startup teams, and accelerator cohorts.",
        "highlighted": True,
        "quotas": {
            "analysesTotal": None,
            "analysesPerMonth": 100,
            "seats": 3,
            "projects": 100,
            "storageDays": 365,
        },
        "features": [
            "multi_document_analysis",
            "pdf_export",
            "shared_workspace",
            "investor_personas",
            "competitor_wedge_deep_dive",
            "milestone_roadmap",
            "priority_processing",
        ],
    },
    "studio": {
        "key": "studio",
        "name": "Premium / Studio",
        "price": "$499/mo",
        "audience": "For tech-transfer offices, venture studios, and sponsor reviews.",
        "highlighted": False,
        "quotas": {
            "analysesTotal": None,
            "analysesPerMonth": 500,
            "seats": 10,
            "projects": 500,
            "storageDays": 730,
        },
        "features": [
            "portfolio_dashboard",
            "compare_opportunities",
            "custom_scoring_rubric",
            "sponsor_ready_reports",
            "audio_investor_room",
            "portfolio_review_export",
        ],
    },
    "enterprise": {
        "key": "enterprise",
        "name": "Enterprise",
        "price": "Custom",
        "audience": "For universities, research institutes, and corporate R&D.",
        "highlighted": False,
        "quotas": {
            "analysesTotal": None,
            "analysesPerMonth": None,
            "seats": None,
            "projects": None,
            "storageDays": None,
        },
        "features": [
            "sso",
            "dedicated_workspace",
            "custom_templates",
            "custom_retention",
            "priority_support",
            "custom_volume",
        ],
    },
}

FEATURE_LABELS = {
    "document_analysis": "Document analysis",
    "memo_preview": "Memo preview",
    "readiness_snapshot": "Readiness snapshot",
    "demo_investor_questions": "Demo investor questions",
    "full_memo": "Full venture memo",
    "readiness_risk_breakdown": "Readiness score with risk breakdown",
    "investor_room_text": "Text Investor Room",
    "markdown_export": "Markdown export",
    "saved_history": "Saved project history",
    "basic_competitor_prompts": "Basic competitor prompts",
    "multi_document_analysis": "Multi-document project analysis",
    "pdf_export": "PDF export",
    "shared_workspace": "Shared workspace",
    "investor_personas": "Investor personas",
    "competitor_wedge_deep_dive": "Competitor and wedge deep-dive",
    "milestone_roadmap": "Milestone roadmap",
    "priority_processing": "Priority processing",
    "portfolio_dashboard": "Portfolio dashboard",
    "compare_opportunities": "Compare spinout opportunities",
    "custom_scoring_rubric": "Custom scoring rubric",
    "sponsor_ready_reports": "Sponsor-ready PDF reports",
    "audio_investor_room": "Audio-enabled Investor Room",
    "portfolio_review_export": "Exportable portfolio review summaries",
    "sso": "SSO",
    "dedicated_workspace": "Dedicated workspace",
    "custom_templates": "Custom report templates",
    "custom_retention": "Custom retention",
    "priority_support": "Priority support",
    "custom_volume": "Custom analysis volume",
}


def normalize_plan(plan: str | None) -> str:
    plan_key = str(plan or "free").strip().lower()
    return plan_key if plan_key in PLAN_CATALOG else "free"


def plan_rank(plan: str | None) -> int:
    return PLAN_ORDER.index(normalize_plan(plan))


def inherited_feature_set(plan: str | None) -> set[str]:
    rank = plan_rank(plan)
    features: set[str] = set()
    for plan_key in PLAN_ORDER[: rank + 1]:
        features.update(PLAN_CATALOG[plan_key]["features"])
    return features


def inherited_quotas(plan: str | None) -> dict[str, Any]:
    quotas: dict[str, Any] = {}
    for plan_key in PLAN_ORDER[: plan_rank(plan) + 1]:
        quotas.update(PLAN_CATALOG[plan_key]["quotas"])
    return quotas


def effective_account(account: dict[str, Any] | None) -> dict[str, Any]:
    source = dict(account or {})
    plan = normalize_plan(source.get("plan"))
    features = inherited_feature_set(plan)
    raw_features = source.get("features")
    if isinstance(raw_features, dict):
        for key, enabled in raw_features.items():
            if enabled:
                features.add(key)
            else:
                features.discard(key)
    elif isinstance(raw_features, list):
        features.update(str(item) for item in raw_features)

    quotas = inherited_quotas(plan)
    if isinstance(source.get("quotas"), dict):
        quotas.update(source["quotas"])

    usage = source.get("usage") if isinstance(source.get("usage"), dict) else {}
    return {
        **source,
        "plan": plan,
        "status": source.get("status") or "active",
        "features": sorted(features),
        "quotas": quotas,
        "usage": usage,
    }


def plan_payload(plan: str) -> dict[str, Any]:
    catalog_plan = deepcopy(PLAN_CATALOG[plan])
    catalog_plan["features"] = sorted(inherited_feature_set(plan))
    catalog_plan["featureLabels"] = [
        {"key": key, "label": FEATURE_LABELS.get(key, key.replace("_", " ").title())}
        for key in catalog_plan["features"]
    ]
    return catalog_plan


def plans_payload() -> dict[str, Any]:
    return {
        "order": PLAN_ORDER,
        "plans": {plan: plan_payload(plan) for plan in PLAN_ORDER},
        "featureLabels": FEATURE_LABELS,
    }


def required_plan_for_feature(feature: str) -> str:
    for plan in PLAN_ORDER:
        if feature in inherited_feature_set(plan):
            return plan
    return "enterprise"


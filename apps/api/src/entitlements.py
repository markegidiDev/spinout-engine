from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder

from .auth import AuthContext
from .plans import PLAN_ORDER, effective_account, required_plan_for_feature


def require_feature(ctx: AuthContext, feature: str) -> None:
    if has_feature(ctx.account, feature):
        return
    required_plan = required_plan_for_feature(feature)
    raise HTTPException(
        status_code=403,
        detail={
            "code": "feature_locked",
            "message": f"{feature_label(feature)} is available on {plan_label(required_plan)}.",
            "feature": feature,
            "requiredPlan": required_plan,
        },
    )


def require_quota(ctx: AuthContext, quota: str) -> None:
    if quota != "analyses":
        return

    account = effective_account(ctx.account)
    quotas = account.get("quotas") or {}
    usage = normalized_usage(account)
    total_limit = quotas.get("analysesTotal")
    monthly_limit = quotas.get("analysesPerMonth")

    if total_limit is not None and int(total_limit) > 0:
        total_used = int(usage.get("analysesTotalUsed") or 0)
        if total_used >= int(total_limit):
            raise_quota_exceeded(ctx.account.get("plan"), "analyses", "starter")
        return

    if monthly_limit is None:
        return

    monthly_used = int(usage.get("analysesUsed") or 0)
    if monthly_used >= int(monthly_limit):
        raise_quota_exceeded(ctx.account.get("plan"), "analyses", next_plan(ctx.account.get("plan")))


def increment_usage(ctx: AuthContext, usage: str) -> None:
    if usage != "analyses":
        return

    period = current_period()
    current_usage = normalized_usage(ctx.account)
    next_monthly = int(current_usage.get("analysesUsed") or 0) + 1
    next_total = int(current_usage.get("analysesTotalUsed") or 0) + 1
    ctx.account.setdefault("usage", {})
    ctx.account["usage"].update(
        {
            "period": period,
            "analysesUsed": next_monthly,
            "analysesTotalUsed": next_total,
        }
    )

    update_payload: dict[str, Any] = {
        "usage.period": period,
        "usage.analysesUsed": _increment_value(1, next_monthly),
        "usage.analysesTotalUsed": _increment_value(1, next_total),
    }
    if current_usage.get("_resetMonthly"):
        update_payload["usage.analysesUsed"] = 1

    try:
        ctx.account_ref.update(update_payload)
    except Exception:
        # Usage should not hide a successful analysis; the next request still
        # uses the in-memory update for this response cycle.
        return


def has_feature(account: dict[str, Any], feature: str) -> bool:
    effective = effective_account(account)
    return feature in set(effective.get("features") or [])


def account_payload(ctx: AuthContext) -> dict[str, Any]:
    account = effective_account(ctx.account)
    usage = normalized_usage(account)
    usage.pop("_resetMonthly", None)
    return {
        "user": {
            "id": ctx.user_id,
            "email": ctx.email,
            "role": ctx.role,
        },
        "account": {
            "id": ctx.account_id,
            "plan": account.get("plan"),
            "status": account.get("status"),
            "features": account.get("features") or [],
            "quotas": account.get("quotas") or {},
            "usage": usage,
        },
    }


def save_session_if_allowed(ctx: AuthContext, session_payload: dict[str, Any]) -> None:
    if not has_feature(ctx.account, "saved_history"):
        return
    try:
        ctx.account_ref.collection("sessions").document(session_payload["sessionId"]).set(
            jsonable_encoder(session_payload)
        )
    except Exception:
        return


def list_saved_sessions(ctx: AuthContext, limit: int = 20) -> list[dict[str, Any]]:
    require_feature(ctx, "saved_history")
    try:
        docs = (
            ctx.account_ref.collection("sessions")
            .order_by("createdAt", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]
    except Exception:
        return []


def normalized_usage(account: dict[str, Any]) -> dict[str, Any]:
    usage = dict(account.get("usage") or {})
    if usage.get("period") != current_period():
        usage["period"] = current_period()
        usage["analysesUsed"] = 0
        usage["_resetMonthly"] = True
    usage.setdefault("analysesUsed", 0)
    usage.setdefault("analysesTotalUsed", 0)
    return usage


def current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def raise_quota_exceeded(plan: str | None, feature: str, required_plan: str) -> None:
    raise HTTPException(
        status_code=402,
        detail={
            "code": "quota_exceeded",
            "message": f"You have reached your {feature_label(feature)} limit.",
            "feature": feature,
            "requiredPlan": required_plan,
            "currentPlan": plan or "free",
        },
    )


def next_plan(plan: str | None) -> str:
    current = str(plan or "free").lower()
    if current not in PLAN_ORDER:
        return "starter"
    index = min(PLAN_ORDER.index(current) + 1, len(PLAN_ORDER) - 1)
    return PLAN_ORDER[index]


def plan_label(plan: str) -> str:
    return "Premium / Studio" if plan == "studio" else plan.title()


def feature_label(feature: str) -> str:
    return feature.replace("_", " ").title()


def _increment_value(amount: int, fallback_value: int):
    try:
        from google.cloud import firestore

        return firestore.Increment(amount)
    except Exception:
        return fallback_value

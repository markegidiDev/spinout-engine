from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .config import Settings
from .plans import effective_account


ACTIVE_ACCOUNT_STATUSES = {"active", "trialing"}


@dataclass
class AuthContext:
    user_id: str
    email: str
    account_id: str
    role: str
    account: dict[str, Any]
    account_ref: Any
    db: Any


def auth_error(status_code: int, code: str, message: str, **extra: Any) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
            **{key: value for key, value in extra.items() if value is not None},
        },
    )


def authenticate_request(authorization: str | None, settings: Settings) -> AuthContext:
    token = _bearer_token(authorization)
    firebase_auth, firestore = _firebase_modules()
    app = _firebase_app(settings)

    try:
        decoded = firebase_auth.verify_id_token(token, app=app)
    except HTTPException:
        raise
    except Exception as exc:
        raise auth_error(401, "auth_required", "Your session could not be verified.") from exc

    user_id = str(decoded.get("uid") or decoded.get("user_id") or "")
    if not user_id:
        raise auth_error(401, "auth_required", "Your session is missing a user id.")

    db = firestore.client(app=app)
    email = str(decoded.get("email") or "")
    account_id = str(decoded.get("accountId") or decoded.get("account_id") or "")
    role = str(decoded.get("role") or "")

    user_data: dict[str, Any] = {}
    if not account_id or not role:
        try:
            user_doc = db.collection("users").document(user_id).get()
            user_data = user_doc.to_dict() or {}
        except Exception as exc:
            raise auth_error(503, "firestore_unavailable", "Firestore user lookup failed.") from exc
        account_id = account_id or str(user_data.get("accountId") or user_data.get("account_id") or "")
        role = role or str(user_data.get("role") or "member")
        email = email or str(user_data.get("email") or "")

    if not account_id:
        raise auth_error(403, "feature_locked", "No account is linked to this user.", requiredPlan="free")

    account_ref = db.collection("accounts").document(account_id)
    try:
        account_doc = account_ref.get()
        account_data = account_doc.to_dict() or {}
    except Exception as exc:
        raise auth_error(503, "firestore_unavailable", "Firestore account lookup failed.") from exc

    if not account_data:
        raise auth_error(403, "feature_locked", "No account settings were found for this user.", requiredPlan="free")

    account = effective_account({"id": account_id, **account_data})
    if account.get("status") not in ACTIVE_ACCOUNT_STATUSES:
        raise auth_error(
            403,
            "feature_locked",
            "This account is not active.",
            requiredPlan=account.get("plan") or "starter",
        )

    return AuthContext(
        user_id=user_id,
        email=email,
        account_id=account_id,
        role=role or "member",
        account=account,
        account_ref=account_ref,
        db=db,
    )


def _bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise auth_error(401, "auth_required", "Log in to use this feature.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise auth_error(401, "auth_required", "Log in to use this feature.")
    return token.strip()


def _firebase_modules():
    try:
        import firebase_admin
        from firebase_admin import auth as firebase_auth
        from firebase_admin import credentials, firestore
    except ImportError as exc:
        raise auth_error(
            503,
            "firebase_unavailable",
            "Firebase Admin SDK is not installed on the API server.",
        ) from exc
    return firebase_auth, firestore


def _firebase_app(settings: Settings):
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError as exc:
        raise auth_error(
            503,
            "firebase_unavailable",
            "Firebase Admin SDK is not installed on the API server.",
        ) from exc

    if firebase_admin._apps:
        return firebase_admin.get_app()

    options = {"projectId": settings.FIREBASE_PROJECT_ID} if settings.FIREBASE_PROJECT_ID else None
    credential = _firebase_credential(settings, credentials)
    try:
        if credential is not None:
            if options:
                return firebase_admin.initialize_app(credential, options=options)
            return firebase_admin.initialize_app(credential)
        if options:
            return firebase_admin.initialize_app(options=options)
        return firebase_admin.initialize_app()
    except Exception as exc:
        raise auth_error(
            503,
            "firebase_unavailable",
            "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or application default credentials.",
        ) from exc


def _firebase_credential(settings: Settings, credentials_module: Any):
    raw_value = settings.FIREBASE_SERVICE_ACCOUNT_JSON.strip()
    if not raw_value:
        return None

    if raw_value.startswith("{"):
        try:
            payload = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            raise auth_error(
                503,
                "firebase_unavailable",
                "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.",
            ) from exc
        return credentials_module.Certificate(payload)

    path = Path(raw_value)
    if path.exists():
        return credentials_module.Certificate(str(path))

    raise auth_error(
        503,
        "firebase_unavailable",
        "FIREBASE_SERVICE_ACCOUNT_JSON must be a JSON string or a service account file path.",
    )

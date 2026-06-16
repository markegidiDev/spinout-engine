from __future__ import annotations

import argparse
import hashlib
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from src.auth import _firebase_app, _firebase_modules  # noqa: E402
from src.config import get_settings  # noqa: E402
from src.plans import PLAN_CATALOG, PLAN_ORDER, effective_account  # noqa: E402


OWNER_ROLE = "owner"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Provision Firebase Auth users into Firestore accounts and custom claims."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    provision = subparsers.add_parser(
        "provision",
        help="Create users/{uid}, accounts/{accountId}, and account custom claims.",
    )
    target_group = provision.add_mutually_exclusive_group(required=True)
    target_group.add_argument("--all", action="store_true", help="Provision every Firebase Auth user.")
    target_group.add_argument("--uid", help="Provision one Firebase Auth user by uid.")
    target_group.add_argument("--email", help="Provision one Firebase Auth user by email.")
    provision.add_argument("--dry-run", action="store_true", help="Print changes without writing them.")

    upgrade = subparsers.add_parser(
        "upgrade",
        help="Update an account plan/quotas and refresh linked users' custom claims.",
    )
    upgrade.add_argument("--account-id", required=True, help="Firestore accounts/{accountId} document id.")
    upgrade.add_argument("--plan", required=True, choices=PLAN_ORDER, help="Target plan.")
    upgrade.add_argument("--dry-run", action="store_true", help="Print changes without writing them.")

    args = parser.parse_args()
    firebase_auth, firestore = _firebase_modules()
    app = _firebase_app(get_settings())
    db = firestore.client(app=app)

    if args.command == "provision":
        users = _selected_users(firebase_auth, app, args)
        count = 0
        for user in users:
            count += 1
            _provision_user(firebase_auth, db, user, args.dry_run)
        print(f"{'Would provision' if args.dry_run else 'Provisioned'} {count} Firebase Auth user(s).")
        return 0

    if args.command == "upgrade":
        _upgrade_account(firebase_auth, db, args.account_id, args.plan, args.dry_run)
        return 0

    parser.error("Unknown command.")
    return 2


def _selected_users(firebase_auth: Any, app: Any, args: argparse.Namespace) -> Iterable[Any]:
    if args.uid:
        return [firebase_auth.get_user(args.uid, app=app)]
    if args.email:
        return [firebase_auth.get_user_by_email(args.email, app=app)]
    return _all_users(firebase_auth, app)


def _all_users(firebase_auth: Any, app: Any) -> Iterable[Any]:
    page = firebase_auth.list_users(app=app)
    while page:
        yield from page.users
        page = page.get_next_page()


def _provision_user(firebase_auth: Any, db: Any, user: Any, dry_run: bool) -> None:
    now = _now_iso()
    uid = user.uid
    email = user.email or ""
    user_ref = db.collection("users").document(uid)
    user_doc = user_ref.get()
    user_data = user_doc.to_dict() or {}

    account_id = str(user_data.get("accountId") or user_data.get("account_id") or _default_account_id(uid))
    role = str(user_data.get("role") or OWNER_ROLE)
    user_payload = {
        "accountId": account_id,
        "role": role,
        "email": email or user_data.get("email") or "",
        "createdAt": user_data.get("createdAt") or now,
    }

    account_ref = db.collection("accounts").document(account_id)
    account_doc = account_ref.get()
    account_data = account_doc.to_dict() or {}
    if account_data:
        plan = effective_account(account_data).get("plan") or "free"
    else:
        plan = "free"

    _write_user_doc(user_ref, user_doc.exists, user_payload, dry_run)
    _write_account_doc(account_ref, account_doc.exists, dry_run)
    _set_claims(firebase_auth, user, account_id=account_id, role=role, plan=plan, dry_run=dry_run)


def _write_user_doc(user_ref: Any, exists: bool, user_payload: dict[str, Any], dry_run: bool) -> None:
    if dry_run:
        action = "update" if exists else "create"
        print(f"[dry-run] Would {action} users/{user_ref.id}: {user_payload}")
        return
    user_ref.set(user_payload, merge=True)


def _write_account_doc(account_ref: Any, exists: bool, dry_run: bool) -> None:
    if exists:
        if dry_run:
            print(f"[dry-run] Would keep existing accounts/{account_ref.id}.")
        return

    account_payload = _free_account_payload()
    if dry_run:
        print(f"[dry-run] Would create accounts/{account_ref.id}: {account_payload}")
        return
    account_ref.set(account_payload)


def _upgrade_account(firebase_auth: Any, db: Any, account_id: str, plan: str, dry_run: bool) -> None:
    account_ref = db.collection("accounts").document(account_id)
    account_doc = account_ref.get()
    if not account_doc.exists:
        raise SystemExit(f"accounts/{account_id} does not exist. Run provision first.")

    payload = {
        "plan": plan,
        "quotas": deepcopy(PLAN_CATALOG[plan]["quotas"]),
    }
    if dry_run:
        print(f"[dry-run] Would update accounts/{account_id}: {payload}")
    else:
        account_ref.set(payload, merge=True)

    linked_users = list(db.collection("users").where("accountId", "==", account_id).stream())
    if not linked_users:
        print(f"No users linked to accounts/{account_id}; account document was {'not changed' if dry_run else 'updated'}.")
        return

    for user_doc in linked_users:
        user_data = user_doc.to_dict() or {}
        user = firebase_auth.get_user(user_doc.id)
        _set_claims(
            firebase_auth,
            user,
            account_id=account_id,
            role=str(user_data.get("role") or OWNER_ROLE),
            plan=plan,
            dry_run=dry_run,
        )

    print(f"{'Would upgrade' if dry_run else 'Upgraded'} accounts/{account_id} to {plan}.")


def _set_claims(
    firebase_auth: Any,
    user: Any,
    *,
    account_id: str,
    role: str,
    plan: str,
    dry_run: bool,
) -> None:
    current_claims = dict(user.custom_claims or {})
    next_claims = {
        **current_claims,
        "accountId": account_id,
        "role": role,
        "plan": plan,
    }
    if dry_run:
        print(f"[dry-run] Would set custom claims for {user.uid}: {next_claims}")
        return
    firebase_auth.set_custom_user_claims(user.uid, next_claims)


def _free_account_payload() -> dict[str, Any]:
    return {
        "plan": "free",
        "status": "active",
        "quotas": deepcopy(PLAN_CATALOG["free"]["quotas"]),
        "usage": {
            "period": datetime.now(timezone.utc).strftime("%Y-%m"),
            "analysesUsed": 0,
            "analysesTotalUsed": 0,
        },
    }


def _default_account_id(uid: str) -> str:
    digest = hashlib.sha256(uid.encode("utf-8")).hexdigest()[:16]
    return f"acc_{digest}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())

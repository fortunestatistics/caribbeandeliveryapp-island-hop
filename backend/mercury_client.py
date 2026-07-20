"""Mercury Business Banking API client (read-only).

Used to reconcile Stripe payouts against Mercury bank transactions. We only ever
READ from Mercury — never move money. Credentials are read lazily from the
environment so import order vs. load_dotenv never matters:
  - MERCURY_API_BASE_URL (defaults to https://api.mercury.com/api/v1)
  - MERCURY_API_TOKEN    (full token, e.g. "secret-token:mercury_production_...")

The token is a bearer credential: it is NEVER exposed to the frontend and never
logged. All Mercury calls happen server-side.
"""
import os
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.mercury.com/api/v1"


class MercuryNotConfigured(Exception):
    """Raised when the Mercury API token is missing."""


def _base_url() -> str:
    return (os.environ.get("MERCURY_API_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")


def _token() -> str:
    token = os.environ.get("MERCURY_API_TOKEN")
    if not token:
        raise MercuryNotConfigured("MERCURY_API_TOKEN not set")
    return token


def _headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {_token()}", "Accept": "application/json"}


def is_configured() -> bool:
    return bool(os.environ.get("MERCURY_API_TOKEN"))


async def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{_base_url()}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.get(url, headers=_headers(), params=params)
    if resp.status_code == 401:
        raise PermissionError("Mercury rejected the API token (401)")
    resp.raise_for_status()
    return resp.json()


async def get_status() -> Dict[str, Any]:
    """Light health/config check used by the admin UI."""
    if not is_configured():
        return {"configured": False, "connected": False, "detail": "Mercury token not set"}
    try:
        data = await _get("accounts")
        accounts = data.get("accounts", data) if isinstance(data, dict) else data
        return {"configured": True, "connected": True, "account_count": len(accounts or [])}
    except PermissionError as exc:
        return {"configured": True, "connected": False, "detail": str(exc)}
    except Exception as exc:  # noqa: BLE001 — surface connectivity issues to the admin
        logger.warning(f"Mercury status check failed: {exc}")
        return {"configured": True, "connected": False, "detail": "Could not reach Mercury"}


def _normalize_account(a: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": a.get("id"),
        "name": a.get("name") or a.get("nickname") or "Account",
        "kind": a.get("kind") or a.get("type") or "",
        "status": a.get("status") or "",
        "available_balance": float(a.get("availableBalance") or 0),
        "current_balance": float(a.get("currentBalance") or 0),
        "account_number": a.get("accountNumber"),
        "routing_number": a.get("routingNumber"),
    }


def _normalize_transaction(t: Dict[str, Any], account_id: str) -> Dict[str, Any]:
    return {
        "id": t.get("id"),
        "account_id": account_id,
        "amount": float(t.get("amount") or 0),
        "description": t.get("bankDescription") or t.get("externalMemo")
            or t.get("counterpartyName") or t.get("note") or "",
        "counterparty": t.get("counterpartyName") or "",
        "kind": t.get("kind") or "",
        "status": t.get("status") or "",
        "posted_at": t.get("postedAt") or t.get("createdAt"),
        "created_at": t.get("createdAt"),
    }


async def list_accounts() -> List[Dict[str, Any]]:
    data = await _get("accounts")
    accounts = data.get("accounts", data) if isinstance(data, dict) else data
    return [_normalize_account(a) for a in (accounts or [])]


async def list_account_transactions(
    account_id: str,
    start: Optional[str] = None,
    end: Optional[str] = None,
    page_limit: int = 200,
    max_pages: int = 20,
) -> List[Dict[str, Any]]:
    """List transactions for one account using Mercury's offset pagination.

    start/end are ISO date strings (YYYY-MM-DD).
    """
    base_params: Dict[str, Any] = {"limit": page_limit}
    if start:
        base_params["start"] = start
    if end:
        base_params["end"] = end

    transactions: List[Dict[str, Any]] = []
    for page in range(max_pages):
        params = {**base_params, "offset": page * page_limit}
        data = await _get(f"account/{account_id}/transactions", params=params)
        batch = data.get("transactions", data.get("data", [])) if isinstance(data, dict) else data
        if not batch:
            break
        transactions.extend(_normalize_transaction(t, account_id) for t in batch)
        if len(batch) < page_limit:
            break
    return transactions


async def list_all_transactions(start: Optional[str] = None, end: Optional[str] = None) -> List[Dict[str, Any]]:
    """Aggregate transactions across all Mercury accounts for a date window."""
    accounts = await list_accounts()
    all_tx: List[Dict[str, Any]] = []
    for acct in accounts:
        if not acct.get("id"):
            continue
        all_tx.extend(await list_account_transactions(acct["id"], start=start, end=end))
    return all_tx

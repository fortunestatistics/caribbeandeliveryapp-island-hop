"""
CariPay client — talks to the user's CariPay digital wallet app.

Right now CariPay's API isn't exposed yet (only a landing page is up), so this
module supports a MOCK mode that simulates success. Flip MOCK_CARIPAY=false in
.env once CariPay ships its API, and fill in the HTTP calls in
`_real_deposit` / `_real_withdraw`.

Surface:
  await initiate_deposit(handle, amount, currency, reference) -> dict
  await initiate_withdrawal(handle, amount, currency, reference) -> dict
  verify_webhook_signature(payload_bytes, signature_header) -> bool

Public env vars:
  CARIPAY_API_BASE_URL    e.g. https://api.caripay.com/v1
  CARIPAY_API_KEY         static API key (header: X-CariPay-Api-Key)
  CARIPAY_WEBHOOK_SECRET  HMAC-SHA256 shared secret for webhook verification
  MOCK_CARIPAY            "true" → simulate success without HTTP calls
"""
from __future__ import annotations

import hmac
import hashlib
import os
import uuid
from typing import Optional

import httpx


def _mock_enabled() -> bool:
    return (os.environ.get("MOCK_CARIPAY", "true").lower() in {"1", "true", "yes"})


def _base_url() -> str:
    return os.environ.get("CARIPAY_API_BASE_URL", "").rstrip("/")


def _api_key() -> str:
    return os.environ.get("CARIPAY_API_KEY", "")


def _webhook_secret() -> str:
    return os.environ.get("CARIPAY_WEBHOOK_SECRET", "")


def _mock_response(action: str, amount: float, currency: str, reference: str) -> dict:
    return {
        "success": True,
        "mock": True,
        "transfer_id": f"cp_mock_{uuid.uuid4().hex[:16]}",
        "status": "completed",
        "action": action,
        "amount": amount,
        "currency": currency,
        "reference": reference,
    }


async def initiate_deposit(handle: str, amount: float, currency: str, reference: str) -> dict:
    """
    Pull funds FROM the user's CariPay account INTO our IslandHop wallet.
    Returns: {success, transfer_id, status, amount, currency, reference}
    """
    if _mock_enabled():
        return _mock_response("deposit", amount, currency, reference)
    return await _real_deposit(handle, amount, currency, reference)


async def initiate_withdrawal(handle: str, amount: float, currency: str, reference: str) -> dict:
    """
    Push funds FROM IslandHop wallet TO the user's CariPay account.
    Returns: {success, transfer_id, status, amount, currency, reference}
    """
    if _mock_enabled():
        return _mock_response("withdrawal", amount, currency, reference)
    return await _real_withdrawal(handle, amount, currency, reference)


def verify_webhook_signature(payload_bytes: bytes, signature_header: Optional[str]) -> bool:
    """
    Verify HMAC-SHA256 signature header sent by CariPay.
    Expected header value format: 'sha256=<hex_digest>'.

    In MOCK mode (CariPay not yet live) we always accept — there's no real
    signing party. Once MOCK_CARIPAY=false, the secret + header are enforced.
    """
    if _mock_enabled():
        return True
    secret = _webhook_secret()
    if not secret or not signature_header:
        return False
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"), payload_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ---------------------------------------------------------------------------
# Real HTTP calls — fill these in once CariPay exposes its API.
# Until then, MOCK_CARIPAY=true short-circuits before reaching this code.
# ---------------------------------------------------------------------------
async def _real_deposit(handle: str, amount: float, currency: str, reference: str) -> dict:
    if not _base_url() or not _api_key():
        raise RuntimeError("CariPay API not configured (set CARIPAY_API_BASE_URL and CARIPAY_API_KEY)")
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(
            f"{_base_url()}/transfers",
            headers={"X-CariPay-Api-Key": _api_key(), "Content-Type": "application/json"},
            json={
                "direction": "out",  # OUT of CariPay → into IslandHop
                "handle": handle,
                "amount": amount,
                "currency": currency,
                "reference": reference,
            },
        )
        r.raise_for_status()
        return r.json()


async def _real_withdrawal(handle: str, amount: float, currency: str, reference: str) -> dict:
    if not _base_url() or not _api_key():
        raise RuntimeError("CariPay API not configured (set CARIPAY_API_BASE_URL and CARIPAY_API_KEY)")
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(
            f"{_base_url()}/transfers",
            headers={"X-CariPay-Api-Key": _api_key(), "Content-Type": "application/json"},
            json={
                "direction": "in",  # INTO CariPay ← from IslandHop
                "handle": handle,
                "amount": amount,
                "currency": currency,
                "reference": reference,
            },
        )
        r.raise_for_status()
        return r.json()

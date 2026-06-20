"""PayPal REST API v2 client (mode-driven: sandbox | live).

Uses httpx directly against PayPal's REST API — no SDK dependency, so it's
version-proof and works identically for Checkout (Orders v2), Payouts (v1),
and webhook signature verification (v1).

Env:
  PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE (sandbox|live),
  PAYPAL_WEBHOOK_ID (required to verify webhook signatures)
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

_token_cache: Dict[str, Any] = {"token": None, "exp": 0, "key": None}


def _base_url() -> str:
    mode = (os.environ.get("PAYPAL_MODE") or "sandbox").lower()
    return "https://api-m.paypal.com" if mode == "live" else "https://api-m.sandbox.paypal.com"


def mode() -> str:
    return (os.environ.get("PAYPAL_MODE") or "sandbox").lower()


def _creds() -> tuple[str, str]:
    cid = os.environ.get("PAYPAL_CLIENT_ID")
    sec = os.environ.get("PAYPAL_CLIENT_SECRET")
    if not (cid and sec):
        raise RuntimeError("PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing)")
    return cid, sec


def is_configured() -> bool:
    return bool(os.environ.get("PAYPAL_CLIENT_ID") and os.environ.get("PAYPAL_CLIENT_SECRET"))


async def get_access_token() -> str:
    """Fetch (and cache) an OAuth2 access token via client-credentials."""
    cid, sec = _creds()
    cache_key = f"{_base_url()}:{cid}"
    now = time.time()
    if _token_cache["token"] and _token_cache["exp"] > now + 60 and _token_cache["key"] == cache_key:
        return _token_cache["token"]
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_base_url()}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(cid, sec),
            headers={"Accept": "application/json"},
        )
    if resp.status_code != 200:
        raise RuntimeError(f"PayPal auth failed ({resp.status_code}): {resp.text[:300]}")
    data = resp.json()
    _token_cache.update({"token": data["access_token"], "exp": now + int(data.get("expires_in", 3000)), "key": cache_key})
    return data["access_token"]


async def _auth_headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {await get_access_token()}", "Content-Type": "application/json"}


async def create_order(amount: float, currency: str, reference_id: str,
                       return_url: str, cancel_url: str, description: str = "IslandHop") -> Dict[str, Any]:
    """Create a CAPTURE order. Returns {success, id, status, approve_url, raw}."""
    body = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": reference_id,
            "description": description[:127],
            "amount": {"currency_code": currency.upper(), "value": f"{float(amount):.2f}"},
        }],
        "application_context": {
            "brand_name": "IslandHop",
            "user_action": "PAY_NOW",
            "return_url": return_url,
            "cancel_url": cancel_url,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{_base_url()}/v2/checkout/orders", json=body, headers=await _auth_headers())
        data = resp.json()
        if resp.status_code not in (200, 201):
            return {"success": False, "error": data.get("message") or resp.text[:300], "raw": data}
        approve = next((l["href"] for l in data.get("links", []) if l.get("rel") == "approve"), None)
        return {"success": True, "id": data.get("id"), "status": data.get("status"), "approve_url": approve, "raw": data}
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"PayPal create_order failed: {exc}")
        return {"success": False, "error": str(exc)}


async def capture_order(order_id: str) -> Dict[str, Any]:
    """Capture an approved order. Returns {success, status, capture_id, amount, currency, raw}."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{_base_url()}/v2/checkout/orders/{order_id}/capture",
                                     json={}, headers=await _auth_headers())
        data = resp.json()
        if resp.status_code not in (200, 201):
            return {"success": False, "error": data.get("message") or resp.text[:300], "raw": data}
        status = data.get("status")
        cap = {}
        try:
            cap = data["purchase_units"][0]["payments"]["captures"][0]
        except (KeyError, IndexError):
            pass
        return {
            "success": status == "COMPLETED",
            "status": status,
            "capture_id": cap.get("id"),
            "amount": float(cap.get("amount", {}).get("value", 0) or 0),
            "currency": cap.get("amount", {}).get("currency_code"),
            "reference_id": (data.get("purchase_units") or [{}])[0].get("reference_id"),
            "raw": data,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"PayPal capture_order failed: {exc}")
        return {"success": False, "error": str(exc)}


async def get_order(order_id: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{_base_url()}/v2/checkout/orders/{order_id}", headers=await _auth_headers())
        data = resp.json()
        if resp.status_code != 200:
            return {"success": False, "error": data.get("message") or resp.text[:300], "raw": data}
        return {"success": True, "id": data.get("id"), "status": data.get("status"), "raw": data}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}


async def create_payout(email: str, amount: float, currency: str, note: str,
                        sender_batch_id: str) -> Dict[str, Any]:
    """Send a single payout to a PayPal email. Returns {success, batch_id, status, raw}."""
    body = {
        "sender_batch_header": {
            "sender_batch_id": sender_batch_id,
            "email_subject": "You have a payout from IslandHop",
            "email_message": note or "Your IslandHop withdrawal has been sent.",
        },
        "items": [{
            "recipient_type": "EMAIL",
            "amount": {"value": f"{float(amount):.2f}", "currency": currency.upper()},
            "receiver": email,
            "note": note or "IslandHop payout",
            "sender_item_id": sender_batch_id,
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{_base_url()}/v1/payments/payouts", json=body, headers=await _auth_headers())
        data = resp.json()
        if resp.status_code not in (200, 201):
            return {"success": False, "error": data.get("message") or resp.text[:300], "raw": data}
        bh = data.get("batch_header", {})
        return {"success": True, "batch_id": bh.get("payout_batch_id"), "status": bh.get("batch_status"), "raw": data}
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"PayPal create_payout failed: {exc}")
        return {"success": False, "error": str(exc)}


async def verify_webhook(headers: Dict[str, str], body: Dict[str, Any]) -> bool:
    """Verify a webhook signature against PayPal. Requires PAYPAL_WEBHOOK_ID.
    Returns False (and logs) if not configured so callers can decide to reject."""
    webhook_id = os.environ.get("PAYPAL_WEBHOOK_ID")
    if not webhook_id:
        logger.warning("PAYPAL_WEBHOOK_ID not set — cannot verify webhook signature.")
        return False
    h = {k.lower(): v for k, v in headers.items()}
    payload = {
        "auth_algo": h.get("paypal-auth-algo"),
        "cert_url": h.get("paypal-cert-url"),
        "transmission_id": h.get("paypal-transmission-id"),
        "transmission_sig": h.get("paypal-transmission-sig"),
        "transmission_time": h.get("paypal-transmission-time"),
        "webhook_id": webhook_id,
        "webhook_event": body,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{_base_url()}/v1/notifications/verify-webhook-signature",
                                     json=payload, headers=await _auth_headers())
        return resp.status_code == 200 and resp.json().get("verification_status") == "SUCCESS"
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"PayPal webhook verify failed: {exc}")
        return False

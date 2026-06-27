"""
WiPay Caribbean hosted-payment client (sandbox-ready).

Flow:
  create_payment_request(...) -> POST to WiPay plugin endpoint -> {url, transaction_id}
  Customer is redirected to `url`, pays on WiPay's hosted page, then WiPay
  redirects back to our `response_url` with query params incl. a `hash`
  defined as md5(transaction_id + total + api_key).

Config comes from env:
  WIPAY_ACCOUNT_NUMBER, WIPAY_API_KEY, WIPAY_ENVIRONMENT (sandbox|live),
  WIPAY_COUNTRY_CODE (TT|JM|BB|GY), WIPAY_CURRENCY, WIPAY_BASE_URL
"""
from __future__ import annotations

import hashlib
import os
from typing import Any, Dict

import httpx

_COUNTRY_BASE = {
    "TT": "https://tt.wipayfinancial.com/plugins/payments/request",
    "JM": "https://jm.wipayfinancial.com/plugins/payments/request",
    "BB": "https://bb.wipayfinancial.com/plugins/payments/request",
    "GY": "https://gy.wipayfinancial.com/plugins/payments/request",
}


def _cfg() -> Dict[str, str]:
    country = os.environ.get("WIPAY_COUNTRY_CODE", "TT").upper()
    return {
        "account_number": os.environ.get("WIPAY_ACCOUNT_NUMBER", "1234567890"),
        "api_key": os.environ.get("WIPAY_API_KEY", "123"),
        "environment": os.environ.get("WIPAY_ENVIRONMENT", "sandbox"),
        "country_code": country,
        "currency": os.environ.get("WIPAY_CURRENCY", "USD"),
        "base_url": os.environ.get("WIPAY_BASE_URL") or _COUNTRY_BASE.get(country, _COUNTRY_BASE["TT"]),
    }


def is_configured() -> bool:
    c = _cfg()
    return bool(c["account_number"] and c["api_key"])


async def create_payment_request(order_id: str, amount: float, response_url: str,
                                 origin: str = "islandhop") -> Dict[str, Any]:
    """Request a hosted payment page from WiPay. Returns {success, url, transaction_id, ...}."""
    c = _cfg()
    payload = {
        "account_number": c["account_number"],
        "country_code": c["country_code"],
        "currency": c["currency"],
        "environment": c["environment"],
        "fee_structure": "customer_pay",
        "method": "credit_card",
        "order_id": order_id,
        "origin": origin,
        "response_url": response_url,
        "total": f"{float(amount):.2f}",
        "avs": "0",
        "api_key": c["api_key"],
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(c["base_url"], data=payload,
                                     headers={"Accept": "application/json"})
        resp.raise_for_status()
        try:
            data = resp.json()
        except Exception:
            return {"success": False, "error": f"WiPay returned non-JSON response: {resp.text[:300]}"}
        url = data.get("url") or data.get("hosted_page") or data.get("payment_url")
        if not url:
            return {"success": False, "error": data.get("message") or "WiPay did not return a payment URL",
                    "raw": data}
        return {
            "success": True,
            "url": url,
            "transaction_id": data.get("transaction_id") or data.get("transactionId"),
            "raw": data,
        }
    except httpx.HTTPStatusError as exc:
        return {"success": False, "error": f"WiPay HTTP {exc.response.status_code}: {exc.response.text[:300]}"}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}


def verify_hash(transaction_id: str, total: str, received_hash: str) -> bool:
    """WiPay hash = md5(transaction_id + total + api_key)."""
    if not (transaction_id and total and received_hash):
        return False
    api_key = _cfg()["api_key"]
    computed = hashlib.md5(f"{transaction_id}{total}{api_key}".encode("utf-8"), usedforsecurity=False).hexdigest()
    return computed.lower() == received_hash.lower()


def environment() -> str:
    return _cfg()["environment"]

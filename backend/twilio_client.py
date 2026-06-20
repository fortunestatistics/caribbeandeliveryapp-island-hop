"""
Twilio client — talks to Twilio for SMS OTP + WhatsApp messaging.

Right now Twilio creds aren't wired up in this environment, so this module
runs in MOCK mode (MOCK_TWILIO=true). It simulates successful sends and
returns deterministic IDs so the rest of the app can be wired up and tested
end-to-end. Flip MOCK_TWILIO=false in .env and fill TWILIO_ACCOUNT_SID,
TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, and TWILIO_WHATSAPP_FROM once Twilio is
provisioned.

Surface:
  send_sms(to: str, body: str) -> dict
  send_whatsapp(to: str, body: str) -> dict
  generate_otp() -> str    # 6-digit numeric code (cryptographically secure)
"""
from __future__ import annotations

import logging
import os
import secrets
import uuid

_log = logging.getLogger(__name__)


def _mock_enabled() -> bool:
    return os.environ.get("MOCK_TWILIO", "true").lower() in {"1", "true", "yes"}


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP of the requested length."""
    # `secrets` is the recommended module for security-sensitive randomness (PEP 506).
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def _mock_send(channel: str, to: str, body: str) -> dict:
    return {
        "success": True,
        "mock": True,
        "sid": f"{channel}_mock_{uuid.uuid4().hex[:16]}",
        "to": to,
        "body": body,
        "status": "queued",
        "channel": channel,
    }


def send_sms(to: str, body: str) -> dict:
    """Send an SMS message. Returns {success, sid, status, ...}."""
    if _mock_enabled():
        return _mock_send("sms", to, body)
    return _real_send_sms(to, body)


def send_whatsapp(to: str, body: str, content_sid: str | None = None,
                  content_variables: dict | None = None) -> dict:
    """Send a WhatsApp message. Returns {success, sid, status, ...}.

    If `content_sid` is given, sends an approved WhatsApp template (required for
    business-initiated messages outside the 24h window); otherwise sends free-form `body`.
    """
    if _mock_enabled():
        return _mock_send("whatsapp", to, body)
    return _real_send_whatsapp(to, body, content_sid=content_sid, content_variables=content_variables)


# ---------------------------------------------------------------------------
# Real Twilio HTTP calls — wire these up once Twilio creds are provisioned.
# Until then MOCK_TWILIO=true short-circuits before reaching this code.
# ---------------------------------------------------------------------------
def _real_send_sms(to: str, body: str) -> dict:
    try:
        from twilio.rest import Client  # type: ignore
    except ImportError:
        return {"success": False, "error": "twilio SDK not installed", "channel": "sms", "to": to}
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_SMS_FROM")
    if not (sid and token and from_number):
        return {"success": False, "error": "SMS is not configured on the server.", "channel": "sms", "to": to}
    if to and from_number.strip() == to.strip():
        return {"success": False, "error": "Sender and recipient cannot be the same number.", "channel": "sms", "to": to}
    try:
        client = Client(sid, token)
        msg = client.messages.create(from_=from_number, to=to, body=body)
        return {"success": True, "sid": msg.sid, "status": msg.status, "channel": "sms", "to": to, "body": body}
    except Exception as exc:  # noqa: BLE001 — surface a clean error, never crash the request
        return {"success": False, "error": str(getattr(exc, "msg", exc)),
                "error_code": getattr(exc, "code", None), "channel": "sms", "to": to}


def send_notification(to: str, body: str, channel: str = "whatsapp",
                      content_sid: str | None = None, content_variables: dict | None = None) -> dict:
    """Unified WhatsApp-first notification sender.

    channel="whatsapp" (default): send via WhatsApp. On failure:
      - error_code 63005 (no open 24h session window): log + return gracefully, NO SMS fallback.
      - any other error: fall back to SMS.
    channel="sms": send SMS directly (use for OTP/verification only).

    Returns the underlying send result plus `channel_used`.
    """
    if channel == "sms":
        res = send_sms(to, body)
        res["channel_used"] = "sms"
        return res

    res = send_whatsapp(to, body, content_sid=content_sid, content_variables=content_variables)
    if res.get("success"):
        res["channel_used"] = "whatsapp"
        return res

    if str(res.get("error_code")) == "63005":
        _log.info(f"WhatsApp session not open for {to} (63005) — skipping, no SMS fallback.")
        res["channel_used"] = "whatsapp"
        res["skipped"] = True
        return res

    _log.warning(f"WhatsApp send to {to} failed ({res.get('error_code')}): {res.get('error')} — falling back to SMS.")
    sms_res = send_sms(to, body)
    sms_res["channel_used"] = "sms"
    sms_res["whatsapp_error"] = res.get("error")
    return sms_res


def _real_send_whatsapp(to: str, body: str, content_sid: str | None = None,
                        content_variables: dict | None = None) -> dict:
    try:
        from twilio.rest import Client  # type: ignore
    except ImportError:
        return {"success": False, "error": "twilio SDK not installed", "channel": "whatsapp", "to": to}
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_WHATSAPP_FROM")  # e.g. 'whatsapp:+14155238886'
    if not (sid and token and from_number):
        return {"success": False, "error": "WhatsApp is not configured on the server (no WhatsApp sender set up).",
                "channel": "whatsapp", "to": to}
    try:
        import json as _json
        client = Client(sid, token)
        to_addr = to if to.startswith("whatsapp:") else f"whatsapp:{to}"
        kwargs = {"from_": from_number, "to": to_addr}
        if content_sid:
            kwargs["content_sid"] = content_sid
            if content_variables:
                kwargs["content_variables"] = _json.dumps(content_variables)
        else:
            kwargs["body"] = body
        msg = client.messages.create(**kwargs)
        return {"success": True, "sid": msg.sid, "status": msg.status, "channel": "whatsapp", "to": to, "body": body}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(getattr(exc, "msg", exc)),
                "error_code": getattr(exc, "code", None), "channel": "whatsapp", "to": to}

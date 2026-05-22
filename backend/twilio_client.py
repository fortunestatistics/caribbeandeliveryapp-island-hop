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
  generate_otp() -> str    # 6-digit numeric code
"""
from __future__ import annotations

import os
import random
import uuid
from typing import Optional


def _mock_enabled() -> bool:
    return os.environ.get("MOCK_TWILIO", "true").lower() in {"1", "true", "yes"}


def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of the requested length."""
    return "".join(str(random.randint(0, 9)) for _ in range(length))


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


def send_whatsapp(to: str, body: str) -> dict:
    """Send a WhatsApp message. Returns {success, sid, status, ...}."""
    if _mock_enabled():
        return _mock_send("whatsapp", to, body)
    return _real_send_whatsapp(to, body)


# ---------------------------------------------------------------------------
# Real Twilio HTTP calls — wire these up once Twilio creds are provisioned.
# Until then MOCK_TWILIO=true short-circuits before reaching this code.
# ---------------------------------------------------------------------------
def _real_send_sms(to: str, body: str) -> dict:
    try:
        from twilio.rest import Client  # type: ignore
    except ImportError as exc:
        raise RuntimeError("twilio SDK not installed — pip install twilio") from exc
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_SMS_FROM")
    if not (sid and token and from_number):
        raise RuntimeError("Twilio not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)")
    client = Client(sid, token)
    msg = client.messages.create(from_=from_number, to=to, body=body)
    return {"success": True, "sid": msg.sid, "status": msg.status, "channel": "sms", "to": to, "body": body}


def _real_send_whatsapp(to: str, body: str) -> dict:
    try:
        from twilio.rest import Client  # type: ignore
    except ImportError as exc:
        raise RuntimeError("twilio SDK not installed — pip install twilio") from exc
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_WHATSAPP_FROM")  # e.g. 'whatsapp:+14155238886'
    if not (sid and token and from_number):
        raise RuntimeError("Twilio not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)")
    client = Client(sid, token)
    to_addr = to if to.startswith("whatsapp:") else f"whatsapp:{to}"
    msg = client.messages.create(from_=from_number, to=to_addr, body=body)
    return {"success": True, "sid": msg.sid, "status": msg.status, "channel": "whatsapp", "to": to, "body": body}

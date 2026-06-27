"""WhatsApp Twilio status callback + visibility tests (iter21).

Validates:
  1) POST /api/webhooks/twilio-status updates the matching whatsapp_messages row.
  2) GET  /api/whatsapp/messages?phone=+1... returns the updated status + error_code.
  3) POST /api/whatsapp/send (admin) returns 200 + message object (does not 500).
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") \
    or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"
TEST_PHONE = "+15166057352"
KNOWN_SID = "SM01776c2435e0c04f064082872fe90b53"  # pre-existing outbound from request


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- 1) Webhook updates known message status ----------
def test_webhook_updates_known_message(admin_headers):
    """POST status callback for KNOWN_SID then verify via GET /whatsapp/messages."""
    r = requests.post(
        f"{BASE_URL}/api/webhooks/twilio-status",
        data={"MessageSid": KNOWN_SID, "MessageStatus": "failed", "ErrorCode": "63005"},
        timeout=20,
    )
    assert r.status_code == 200, f"webhook returned {r.status_code}: {r.text}"

    r = requests.get(
        f"{BASE_URL}/api/whatsapp/messages",
        params={"phone": TEST_PHONE, "limit": 200},
        headers=admin_headers, timeout=20,
    )
    assert r.status_code == 200, f"list returned {r.status_code}: {r.text}"
    msgs = r.json()
    assert isinstance(msgs, list)
    target = next((m for m in msgs if m.get("twilio_sid") == KNOWN_SID), None)
    # If pre-existing row doesn't exist (clean DB), webhook is still a no-op-success.
    if target is None:
        pytest.skip(f"Pre-existing message with sid={KNOWN_SID} not found; webhook still returned 200.")
    assert target.get("status") == "failed", f"expected status=failed, got {target.get('status')}"
    assert str(target.get("error_code")) == "63005", f"expected error_code=63005, got {target.get('error_code')}"


# ---------- 2) Webhook updates a freshly-sent outbound message ----------
def test_send_then_webhook_updates_status(admin_headers):
    """Send an outbound msg (it'll be queued or fail synchronously),
    then post a status callback for its sid and verify the row updates."""
    body = f"TEST_iter21 status callback round-trip {uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE_URL}/api/whatsapp/send",
        json={"to": TEST_PHONE, "body": body},
        headers=admin_headers, timeout=30,
    )
    # whatsapp_send raises 400 if Twilio rejects synchronously. Either way, no 500.
    assert r.status_code in (200, 400), f"unexpected {r.status_code}: {r.text}"
    if r.status_code != 200:
        pytest.skip(f"Twilio rejected synchronously: {r.text}. Webhook path still tested in test 1.")

    msg = r.json().get("message") or {}
    sid = msg.get("twilio_sid")
    msg_id = msg.get("id")
    assert sid and msg_id, f"missing sid/id in response: {r.json()}"
    assert msg.get("status") in {"queued", "sent", "accepted"}, f"unexpected initial status {msg.get('status')}"

    # Simulate Twilio status callback: failed/63005
    cb = requests.post(
        f"{BASE_URL}/api/webhooks/twilio-status",
        data={"MessageSid": sid, "MessageStatus": "failed", "ErrorCode": "63005"},
        timeout=20,
    )
    assert cb.status_code == 200

    # Verify via API
    time.sleep(0.5)
    r2 = requests.get(
        f"{BASE_URL}/api/whatsapp/messages",
        params={"phone": TEST_PHONE, "limit": 200},
        headers=admin_headers, timeout=20,
    )
    assert r2.status_code == 200
    msgs = r2.json()
    fresh = next((m for m in msgs if m.get("id") == msg_id), None)
    assert fresh is not None, "freshly-sent message missing from GET list"
    assert fresh.get("status") == "failed", f"status not updated: {fresh.get('status')}"
    assert str(fresh.get("error_code")) == "63005"


# ---------- 3) /whatsapp/send does not 500 ----------
def test_send_does_not_500(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/whatsapp/send",
        json={"to": TEST_PHONE, "body": "TEST_iter21 no-500 check"},
        headers=admin_headers, timeout=30,
    )
    assert r.status_code != 500, f"500 from /whatsapp/send: {r.text}"
    assert r.status_code in (200, 400)
    if r.status_code == 200:
        body = r.json()
        assert body.get("success") is True
        assert "message" in body and body["message"].get("twilio_sid")


# ---------- 4) Conversations endpoint still loads ----------
def test_conversations_endpoint(admin_headers):
    r = requests.get(f"{BASE_URL}/api/whatsapp/conversations", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- 5) Webhook is idempotent / safe with unknown sid ----------
def test_webhook_unknown_sid_is_safe():
    r = requests.post(
        f"{BASE_URL}/api/webhooks/twilio-status",
        data={"MessageSid": f"SMnonexistent_{uuid.uuid4().hex}", "MessageStatus": "failed", "ErrorCode": "63005"},
        timeout=20,
    )
    assert r.status_code == 200

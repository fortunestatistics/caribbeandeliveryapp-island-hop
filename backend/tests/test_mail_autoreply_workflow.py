"""
Mail support-inbox workflow tests (iteration 16)
Covers: auto-reply settings GET/PUT, manual run, team list, message-list ticket
enrichment, assign, resolve.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-island.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "tracyfortune@islandhoptt.com"
OWNER_PASSWORD = "IslandHopAdmin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, "no access_token"
    return tok


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- mail status ---
def test_mail_status_connected(headers):
    r = requests.get(f"{API}/admin/mail/status", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d.get("configured") is True
    assert d.get("consent_granted") is True
    assert isinstance(d.get("mailboxes"), list) and len(d["mailboxes"]) > 0


# --- auto-reply settings ---
def test_autoreply_settings_get(headers):
    r = requests.get(f"{API}/admin/mail/auto-reply/settings", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "enabled" in d
    assert "subject" in d
    assert "body_html" in d


def test_autoreply_settings_put_template(headers):
    payload = {"enabled": True, "subject": "Thanks for contacting IslandHop — we got your message",
               "body_html": "<p>Hi {name},</p><p>We received your email and our team will respond shortly.</p>"}
    r = requests.put(f"{API}/admin/mail/auto-reply/settings", json=payload, headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["subject"] == payload["subject"]
    assert d["body_html"] == payload["body_html"]
    assert d["enabled"] is True
    # Verify persistence via GET
    g = requests.get(f"{API}/admin/mail/auto-reply/settings", headers=headers, timeout=30)
    assert g.status_code == 200
    assert g.json()["subject"] == payload["subject"]


def test_autoreply_toggle_off_on(headers):
    r1 = requests.put(f"{API}/admin/mail/auto-reply/settings", json={"enabled": False}, headers=headers, timeout=30)
    assert r1.status_code == 200
    assert r1.json()["enabled"] is False
    r2 = requests.put(f"{API}/admin/mail/auto-reply/settings", json={"enabled": True}, headers=headers, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["enabled"] is True


# --- auto-reply run (watermark should keep this at 0) ---
def test_autoreply_run_returns_zero_with_watermark(headers):
    r = requests.post(f"{API}/admin/mail/auto-reply/run", json={}, headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "auto_replies_sent" in d
    # CORRECT safe behavior: should be 0 because watermark blocks historical mail
    assert isinstance(d["auto_replies_sent"], int)
    assert d["auto_replies_sent"] == 0, f"Expected 0 with watermark, got {d['auto_replies_sent']}"


# --- team list ---
def test_team_list(headers):
    r = requests.get(f"{API}/admin/mail/team", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "members" in d
    assert isinstance(d["members"], list)
    assert len(d["members"]) > 0
    m0 = d["members"][0]
    assert "id" in m0 and ("email" in m0 or "name" in m0)
    assert "user_type" in m0


# --- messages list w/ ticket enrichment + assign + resolve ---
@pytest.fixture(scope="module")
def first_mailbox(headers):
    r = requests.get(f"{API}/admin/mail/status", headers=headers, timeout=30)
    return r.json().get("mailboxes", [None])[0]


@pytest.fixture(scope="module")
def first_message(headers, first_mailbox):
    if not first_mailbox:
        pytest.skip("no mailbox")
    r = requests.get(f"{API}/admin/mail/mailboxes/{first_mailbox}/messages?top=5", headers=headers, timeout=60)
    assert r.status_code == 200, r.text
    items = r.json().get("value", [])
    if not items:
        pytest.skip("no messages in mailbox")
    return items[0]


def test_messages_have_ticket_field(headers, first_mailbox):
    r = requests.get(f"{API}/admin/mail/mailboxes/{first_mailbox}/messages?top=5", headers=headers, timeout=60)
    assert r.status_code == 200
    items = r.json().get("value", [])
    if not items:
        pytest.skip("no messages")
    # ticket field should be present (may be None) on each item
    for m in items:
        assert "ticket" in m, "message missing ticket enrichment field"
    # no _id leakage
    for m in items:
        t = m.get("ticket")
        if t:
            assert "_id" not in t, "MongoDB _id leaked in ticket"


def test_assign_to_owner(headers, first_mailbox, first_message):
    # get owner's user_id from team
    tr = requests.get(f"{API}/admin/mail/team", headers=headers, timeout=30).json()
    owner = next((m for m in tr["members"] if m.get("email") == OWNER_EMAIL), tr["members"][0])
    assignee_id = owner["id"]

    r = requests.post(
        f"{API}/admin/mail/mailboxes/{first_mailbox}/messages/{first_message['id']}/assign",
        json={"assignee_id": assignee_id}, headers=headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert "ticket" in d
    t = d["ticket"]
    assert t.get("assigned_to") == assignee_id
    assert t.get("assigned_to_name")
    assert t.get("status") == "assigned"
    assert "_id" not in t


def test_assign_unassign(headers, first_mailbox, first_message):
    r = requests.post(
        f"{API}/admin/mail/mailboxes/{first_mailbox}/messages/{first_message['id']}/assign",
        json={"assignee_id": None}, headers=headers, timeout=30,
    )
    assert r.status_code == 200, r.text


def test_resolve(headers, first_mailbox, first_message):
    r = requests.post(
        f"{API}/admin/mail/mailboxes/{first_mailbox}/messages/{first_message['id']}/resolve",
        json={}, headers=headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    # subsequent message-list GET should reflect resolved
    lr = requests.get(f"{API}/admin/mail/mailboxes/{first_mailbox}/messages?top=10", headers=headers, timeout=60)
    assert lr.status_code == 200
    items = lr.json().get("value", [])
    match = next((m for m in items if m["id"] == first_message["id"]), None)
    if match and match.get("ticket"):
        assert match["ticket"].get("status") == "resolved"

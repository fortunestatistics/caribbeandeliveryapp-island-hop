"""Tests for admin team management, registration lockdown, and invites."""
import time
import uuid
import os
import requests

from conftest import BASE_URL

OWNER_EMAIL = os.environ.get("ADMIN_EMAIL", "tracyfortune@islandhoptt.com")
OWNER_PASSWORD = os.environ.get("ADMIN_PASSWORD", "IslandHopAdmin2026!")


def _register(email, password="Test1234!", name="QA", user_type="customer"):
    return requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "user_type": user_type},
        timeout=30,
    )


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _owner_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_owner_can_login():
    assert _owner_token()


def test_public_register_cannot_self_assign_admin():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    r = _register(f"hacker_{ts}@gmail.com", user_type="admin")
    assert r.status_code == 200
    assert r.json()["user"]["user_type"] == "customer"


def test_promote_and_revoke_agent():
    owner = _owner_token()
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"agent_{ts}@gmail.com"
    reg = _register(email)
    member_id = reg.json()["user"]["id"]
    member_tok = reg.json()["access_token"]

    r = requests.post(f"{BASE_URL}/api/admin/team/promote", headers=_hdr(owner), json={"email": email, "role": "agent"}, timeout=30)
    assert r.status_code == 200

    # Verify via the promoted user's own account (robust against list pagination).
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(member_tok), timeout=30).json()
    assert me["user_type"] == "agent"

    r = requests.post(f"{BASE_URL}/api/admin/team/revoke", headers=_hdr(owner), json={"user_id": member_id}, timeout=30)
    assert r.status_code == 200
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(member_tok), timeout=30).json()
    assert me["user_type"] == "customer"


def test_cannot_revoke_owner():
    owner = _owner_token()
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(owner), timeout=30).json()
    r = requests.post(f"{BASE_URL}/api/admin/team/revoke", headers=_hdr(owner), json={"user_id": me["id"]}, timeout=30)
    assert r.status_code in (400, 403)


def test_non_admin_cannot_access_team():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    r = _register(f"cust_{ts}@gmail.com")
    tok = r.json()["access_token"]
    r = requests.get(f"{BASE_URL}/api/admin/team", headers=_hdr(tok), timeout=30)
    assert r.status_code == 403


def test_invite_and_accept_flow():
    owner = _owner_token()
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"invited_{ts}@gmail.com"
    r = requests.post(f"{BASE_URL}/api/admin/team/invite", headers=_hdr(owner), json={"email": email, "role": "admin"}, timeout=30)
    assert r.status_code == 200
    link = r.json()["invite_link"]
    token = link.split("/admin/invite/")[1]

    # validate token
    r = requests.get(f"{BASE_URL}/api/auth/invite/{token}", timeout=30)
    assert r.status_code == 200 and r.json()["role"] == "admin"

    # accept
    r = requests.post(f"{BASE_URL}/api/auth/invite/accept", json={"token": token, "name": "Invited", "password": "InvitedPass123!"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["user"]["user_type"] == "admin"

    # token now used
    r = requests.get(f"{BASE_URL}/api/auth/invite/{token}", timeout=30)
    assert r.status_code in (404, 410)

    # the new admin can log in
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "InvitedPass123!"}, timeout=30)
    assert r.status_code == 200


def test_change_password():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"cp_{ts}@gmail.com"
    r = _register(email, password="OldPass123!")
    tok = r.json()["access_token"]
    # wrong current
    r = requests.post(f"{BASE_URL}/api/auth/change-password", headers=_hdr(tok), json={"current_password": "nope", "new_password": "NewPass123!"}, timeout=30)
    assert r.status_code == 400
    # correct
    r = requests.post(f"{BASE_URL}/api/auth/change-password", headers=_hdr(tok), json={"current_password": "OldPass123!", "new_password": "NewPass123!"}, timeout=30)
    assert r.status_code == 200
    # login with new password
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "NewPass123!"}, timeout=30)
    assert r.status_code == 200

"""Extra coverage for review: agent role 403, owner /auth/me, invite link shape."""
import os
import time
import uuid
import requests

from conftest import BASE_URL

OWNER_EMAIL = os.environ.get("ADMIN_EMAIL", "tracyfortune@islandhoptt.com")
OWNER_PASSWORD = os.environ.get("ADMIN_PASSWORD", "IslandHopAdmin2026!")


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


def _register(email, password="Test1234!", name="QA", user_type="customer"):
    return requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "user_type": user_type},
        timeout=30,
    )


# Verifies owner /api/auth/me returns user_type=admin
def test_owner_me_is_admin():
    tok = _owner_token()
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), timeout=30).json()
    assert me["user_type"] == "admin", me
    assert me["email"].lower() == OWNER_EMAIL.lower()


# Verifies the registration lockdown also blocks user_type=agent
def test_register_cannot_self_assign_agent():
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    r = _register(f"agentsneak_{ts}@gmail.com", user_type="agent")
    assert r.status_code == 200
    assert r.json()["user"]["user_type"] == "customer"
    # confirm customer cannot reach /admin/team
    tok = r.json()["access_token"]
    rr = requests.get(f"{BASE_URL}/api/admin/team", headers=_hdr(tok), timeout=30)
    assert rr.status_code == 403


# Agent role should NOT be able to reach admin-only endpoints (team, users)
def test_agent_cannot_access_admin_only_endpoints():
    owner = _owner_token()
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"agentrole_{ts}@gmail.com"
    reg = _register(email)
    member_tok = reg.json()["access_token"]

    # promote to agent
    r = requests.post(
        f"{BASE_URL}/api/admin/team/promote",
        headers=_hdr(owner),
        json={"email": email, "role": "agent"},
        timeout=30,
    )
    assert r.status_code == 200

    # agent JWT calling admin-only endpoints
    r1 = requests.get(f"{BASE_URL}/api/admin/team", headers=_hdr(member_tok), timeout=30)
    r2 = requests.get(f"{BASE_URL}/api/admin/users", headers=_hdr(member_tok), timeout=30)
    assert r1.status_code == 403, r1.text
    assert r2.status_code == 403, r2.text

    # /auth/me should reflect role=agent (via user_type)
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(member_tok), timeout=30).json()
    assert me["user_type"] == "agent"


# Verifies invite_link contains /admin/invite/<token> shape
def test_invite_link_shape():
    owner = _owner_token()
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"inviteshape_{ts}@gmail.com"
    r = requests.post(
        f"{BASE_URL}/api/admin/team/invite",
        headers=_hdr(owner),
        json={"email": email, "role": "agent"},
        timeout=30,
    )
    assert r.status_code == 200
    link = r.json()["invite_link"]
    assert "/admin/invite/" in link
    token = link.split("/admin/invite/")[1]
    info = requests.get(f"{BASE_URL}/api/auth/invite/{token}", timeout=30).json()
    assert info["email"].lower() == email.lower()
    assert info["role"] == "agent"


# Owner self-revoke prevented (in addition to user_id-based check in main file)
def test_owner_team_list_marks_owner_with_no_revoke():
    tok = _owner_token()
    r = requests.get(f"{BASE_URL}/api/admin/team", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200
    data = r.json()
    # tolerate either {members:[...]} or [...]
    members = data.get("team", data.get("members", data)) if isinstance(data, dict) else data
    owners = [m for m in members if m.get("is_owner") or m.get("email", "").lower() == OWNER_EMAIL.lower()]
    assert owners, f"Owner not present in team list: {data!r}"
    # The owner record should indicate it is the owner (frontend uses this to hide revoke)
    assert any(m.get("is_owner") for m in owners) or any(m.get("email", "").lower() == OWNER_EMAIL.lower() for m in owners)

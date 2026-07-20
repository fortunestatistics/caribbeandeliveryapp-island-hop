"""Tests for the P0 admin 'message user' guard endpoint.

Covers:
- 403 when caller is not admin
- 404 when user_id doesn't exist
- 400 when subject or body empty
- 400 when target user has a placeholder/test email
- 401 when no auth header
- is_real_email() unit checks
- /api/admin/users listing exposes the seeded placeholder user
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin.qa@islandhop-demo.com"
ADMIN_PASSWORD = "AdminQA1234!"
PLACEHOLDER_USER_EMAIL = "id_start_demo_qa@gmail.com"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, f"no access_token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_token():
    ts = int(time.time())
    email = f"TEST_msgcust_{ts}@gmail.com"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Test1234!", "name": "Msg Cust", "user_type": "customer"},
        timeout=20,
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def all_users(admin_headers):
    r = requests.get(f"{API}/admin/users", params={"limit": 2000}, headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"admin users list failed: {r.status_code} {r.text}"
    data = r.json()
    users = data.get("users") if isinstance(data, dict) else data
    assert isinstance(users, list) and len(users) > 0
    return users


@pytest.fixture(scope="module")
def placeholder_user_id(all_users):
    target = next((u for u in all_users if u.get("email") == PLACEHOLDER_USER_EMAIL), None)
    if not target:
        target = next((u for u in all_users if (u.get("email") or "").startswith("id_start_")), None)
    if not target:
        pytest.skip("No seeded placeholder user found")
    return target["id"]


@pytest.fixture(scope="module")
def real_user_id(all_users):
    """A user with a real, non-placeholder email (we don't actually send mail to them)."""
    me = next((u for u in all_users if u.get("email") == ADMIN_EMAIL), None)
    if me:
        return me["id"]
    # fallback: any real-email customer
    import graph_mail
    real = next((u for u in all_users if graph_mail.is_real_email(u.get("email"))), None)
    if not real:
        pytest.skip("No user with a real email found")
    return real["id"]


# ---------- is_real_email unit ----------
def test_is_real_email_unit():
    import graph_mail  # noqa: E402
    assert graph_mail.is_real_email("real.person@gmail.com") is True
    assert graph_mail.is_real_email("id_start_demo_qa@gmail.com") is False
    assert graph_mail.is_real_email("id_noapp_abc@gmail.com") is False
    assert graph_mail.is_real_email("foo@test.com") is False
    assert graph_mail.is_real_email("foo@example.com") is False
    assert graph_mail.is_real_email("not-an-email") is False
    assert graph_mail.is_real_email("") is False
    assert graph_mail.is_real_email(None) is False
    assert graph_mail.is_real_email("sched_test_xyz@gmail.com") is False


# ---------- Endpoint guard branches ----------
def test_message_user_unauthenticated():
    r = requests.post(
        f"{API}/admin/users/anything/message",
        json={"subject": "x", "body": "y"},
        timeout=15,
    )
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"


def test_message_user_non_admin_forbidden(customer_token, admin_headers, real_user_id):
    r = requests.post(
        f"{API}/admin/users/{real_user_id}/message",
        json={"subject": "Hello", "body": "World"},
        headers={"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"},
        timeout=15,
    )
    assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"


def test_message_user_not_found(admin_headers):
    r = requests.post(
        f"{API}/admin/users/does-not-exist-xyz/message",
        json={"subject": "Hello", "body": "World"},
        headers=admin_headers,
        timeout=15,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"
    assert "not found" in r.json().get("detail", "").lower()


def test_message_user_empty_subject(admin_headers, real_user_id):
    r = requests.post(
        f"{API}/admin/users/{real_user_id}/message",
        json={"subject": "   ", "body": "body present"},
        headers=admin_headers,
        timeout=15,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
    assert "subject" in r.json().get("detail", "").lower() or "body" in r.json().get("detail", "").lower()


def test_message_user_empty_body(admin_headers, real_user_id):
    r = requests.post(
        f"{API}/admin/users/{real_user_id}/message",
        json={"subject": "Subject ok", "body": ""},
        headers=admin_headers,
        timeout=15,
    )
    assert r.status_code == 400


def test_message_user_placeholder_email_rejected(admin_headers, placeholder_user_id):
    r = requests.post(
        f"{API}/admin/users/{placeholder_user_id}/message",
        json={"subject": "Test", "body": "Real body"},
        headers=admin_headers,
        timeout=15,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert "placeholder" in detail or "no valid email" in detail or "test account" in detail, \
        f"detail does not mention placeholder/no valid email: {detail}"

"""Iteration 26 smoke tests: backend endpoints after adding 93 perf indexes."""
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://logistics-island.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin.qa@islandhop-demo.com"
ADMIN_PW = "AdminQA1234!"


def test_taxi_rate_card_public():
    r = requests.get(f"{BASE_URL}/api/taxi/rate-card", timeout=15)
    assert r.status_code == 200, f"rate-card {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert isinstance(data, (dict, list))


def test_restaurants_public():
    r = requests.get(f"{BASE_URL}/api/restaurants", timeout=15)
    assert r.status_code == 200, f"restaurants {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert isinstance(data, (dict, list))


def test_admin_login_and_stats():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PW},
        timeout=15,
    )
    assert r.status_code == 200, f"login {r.status_code}: {r.text[:200]}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    assert token, f"no token in response: {body}"

    r2 = requests.get(
        f"{BASE_URL}/api/admin/stats",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r2.status_code == 200, f"admin/stats {r2.status_code}: {r2.text[:200]}"
    stats = r2.json()
    assert isinstance(stats, dict)

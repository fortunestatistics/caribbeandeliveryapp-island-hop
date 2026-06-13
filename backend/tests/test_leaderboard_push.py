"""Tests for the Driver Leaderboard and Web Push subscription endpoints."""
import time
import uuid
import requests


def _register(base_url, user_type="customer"):
    email = f"lbpush_{user_type}_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = requests.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "Test1234!",
            "name": f"QA {user_type.title()}",
            "user_type": user_type,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return {"token": body["access_token"], "user_id": body["user"]["id"]}


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestLeaderboard:
    def test_leaderboard_public_and_shape(self, base_url):
        r = requests.get(f"{base_url}/api/drivers/leaderboard?limit=5", timeout=30)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        # When rows exist, each must carry the fields the UI renders.
        for row in rows:
            for key in ("id", "name", "deliveries", "rating", "streak"):
                assert key in row, f"missing {key}"
            assert row["streak"] in {"GOLD", "SILVER", "BRONZE"}

    def test_leaderboard_limit_capped(self, base_url):
        r = requests.get(f"{base_url}/api/drivers/leaderboard?limit=999", timeout=30)
        assert r.status_code == 200
        assert len(r.json()) <= 50


class TestPush:
    def test_vapid_public_key_exposed(self, base_url):
        r = requests.get(f"{base_url}/api/push/vapid-public-key", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("public_key")

    def test_subscribe_requires_auth(self, base_url):
        r = requests.post(
            f"{base_url}/api/push/subscribe",
            json={"endpoint": "https://example.com/x", "keys": {"p256dh": "a", "auth": "b"}},
            timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_subscribe_and_unsubscribe(self, base_url):
        user = _register(base_url)
        endpoint = f"https://fcm.googleapis.com/fcm/send/{uuid.uuid4().hex}"
        payload = {"endpoint": endpoint, "keys": {"p256dh": "BNcRdreALRFX", "auth": "tBHItJI5"}}
        r = requests.post(
            f"{base_url}/api/push/subscribe",
            headers=_hdr(user["token"]),
            json=payload,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        r = requests.post(
            f"{base_url}/api/push/unsubscribe",
            headers=_hdr(user["token"]),
            json={"endpoint": endpoint},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

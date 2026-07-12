"""Tests for the Admin Fraud Review Queue."""
import time
import uuid
import requests


def _register(base_url, user_type="customer", name=None):
    if user_type in ("admin", "agent"):
        lr = requests.post(f"{base_url}/api/auth/login",
                           json={"email": "tracyfortune@islandhoptt.com", "password": "IslandHopAdmin2026!"}, timeout=30)
        assert lr.status_code == 200, f"owner admin login failed: {lr.text}"
        b = lr.json()
        return {"email": "tracyfortune@islandhoptt.com", "user_id": b["user"]["id"], "token": b["access_token"]}
    email = f"fraud_{user_type}_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = requests.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "Test1234!",
            "name": name or f"QA {user_type.title()}",
            "user_type": user_type,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "user_id": body["user"]["id"], "token": body["access_token"]}


def _create_order(base_url, token, total):
    r = requests.post(
        f"{base_url}/api/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "customer_id": "x",
            "service_type": "food",
            "items": [{"menu_item_id": "a", "name": "Item", "quantity": 1, "price": total}],
            "subtotal": total,
            "delivery_fee": 0,
            "total": total,
            "pickup_address": {},
            "delivery_address": {},
            "customer_phone": "+1868000",
            "payment_method": "card",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _admin_get_queue(base_url, admin_token, status="open"):
    r = requests.get(
        f"{base_url}/api/admin/fraud-queue",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"status": status},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestFraudQueue:
    def test_admin_only_access(self, base_url):
        cust = _register(base_url, "customer")
        r = requests.get(
            f"{base_url}/api/admin/fraud-queue",
            headers={"Authorization": f"Bearer {cust['token']}"},
            timeout=30,
        )
        assert r.status_code == 403

    def test_high_value_order_creates_flag(self, base_url):
        admin = _register(base_url, "admin")
        cust = _register(base_url, "customer", name="High-Value Tester")
        order = _create_order(base_url, cust["token"], total=650.0)

        queue = _admin_get_queue(base_url, admin["token"])
        match = next((f for f in queue["flags"] if f["order_id"] == order["id"]), None)
        assert match is not None, "Expected a fraud flag for the high-value order"
        assert match["status"] == "open"
        assert "high_value" in match["signals"]
        assert match["severity"] in {"medium", "high"}
        assert match["customer"]["id"] == cust["user_id"]

    def test_low_value_order_no_flag(self, base_url):
        admin = _register(base_url, "admin")
        cust = _register(base_url, "customer")
        order = _create_order(base_url, cust["token"], total=12.0)

        queue = _admin_get_queue(base_url, admin["token"], status="all")
        # No flag should exist for this small order
        match = next((f for f in queue["flags"] if f["order_id"] == order["id"]), None)
        assert match is None

    def test_clear_action_removes_from_open_queue(self, base_url):
        admin = _register(base_url, "admin")
        cust = _register(base_url, "customer")
        order = _create_order(base_url, cust["token"], total=800.0)

        queue = _admin_get_queue(base_url, admin["token"])
        flag = next(f for f in queue["flags"] if f["order_id"] == order["id"])

        r = requests.post(
            f"{base_url}/api/admin/fraud-queue/{flag['id']}/review",
            headers={"Authorization": f"Bearer {admin['token']}"},
            json={"action": "clear", "notes": "Verified human"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "cleared"

        queue_after = _admin_get_queue(base_url, admin["token"])
        assert not any(f["id"] == flag["id"] for f in queue_after["flags"])

    def test_confirm_action_cancels_order_and_suspends_user(self, base_url):
        admin = _register(base_url, "admin")
        cust = _register(base_url, "customer")
        order = _create_order(base_url, cust["token"], total=900.0)

        queue = _admin_get_queue(base_url, admin["token"])
        flag = next(f for f in queue["flags"] if f["order_id"] == order["id"])

        r = requests.post(
            f"{base_url}/api/admin/fraud-queue/{flag['id']}/review",
            headers={"Authorization": f"Bearer {admin['token']}"},
            json={"action": "confirm"},
            timeout=30,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "confirmed_fraud"

        # Verify in confirmed_fraud bucket
        queue_after = _admin_get_queue(base_url, admin["token"], status="confirmed_fraud")
        assert any(f["id"] == flag["id"] for f in queue_after["flags"])

    def test_double_review_returns_400(self, base_url):
        admin = _register(base_url, "admin")
        cust = _register(base_url, "customer")
        order = _create_order(base_url, cust["token"], total=700.0)
        queue = _admin_get_queue(base_url, admin["token"])
        flag = next(f for f in queue["flags"] if f["order_id"] == order["id"])

        requests.post(
            f"{base_url}/api/admin/fraud-queue/{flag['id']}/review",
            headers={"Authorization": f"Bearer {admin['token']}"},
            json={"action": "clear"},
            timeout=30,
        )
        r = requests.post(
            f"{base_url}/api/admin/fraud-queue/{flag['id']}/review",
            headers={"Authorization": f"Bearer {admin['token']}"},
            json={"action": "confirm"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_invalid_action_rejected(self, base_url):
        admin = _register(base_url, "admin")
        cust = _register(base_url, "customer")
        order = _create_order(base_url, cust["token"], total=750.0)
        queue = _admin_get_queue(base_url, admin["token"])
        flag = next(f for f in queue["flags"] if f["order_id"] == order["id"])

        r = requests.post(
            f"{base_url}/api/admin/fraud-queue/{flag['id']}/review",
            headers={"Authorization": f"Bearer {admin['token']}"},
            json={"action": "bogus"},
            timeout=30,
        )
        assert r.status_code == 400

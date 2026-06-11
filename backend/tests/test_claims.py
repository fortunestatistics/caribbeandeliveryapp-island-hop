"""Tests for the Customer Claims system (built on support tickets)."""
import time
import uuid
import requests


def _register(base_url, user_type="customer", name=None):
    email = f"claims_{user_type}_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
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


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _make_order(base_url, cust_token, total=25.0):
    r = requests.post(
        f"{base_url}/api/orders",
        headers=_hdr(cust_token),
        json={
            "customer_id": "x",
            "service_type": "food",
            "items": [{"menu_item_id": "a", "name": "I", "quantity": 1, "price": total}],
            "subtotal": total,
            "delivery_fee": 3,
            "total": total + 3,
            "pickup_address": {},
            "delivery_address": {},
            "customer_phone": "+1",
            "payment_method": "card",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestClaims:
    def test_file_and_list_claim(self, base_url):
        cust = _register(base_url)
        order = _make_order(base_url, cust["token"])

        r = requests.post(
            f"{base_url}/api/claims",
            headers=_hdr(cust["token"]),
            json={
                "order_id": order["id"],
                "subject": "Cold pizza",
                "description": "Arrived cold",
                "claim_type": "quality",
                "category": "claim",
                "user_id": "x",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["category"] == "claim"
        assert body["claim_type"] == "quality"
        assert body["order_id"] == order["id"]
        assert body["status"] == "open"

        r = requests.get(f"{base_url}/api/claims", headers=_hdr(cust["token"]))
        assert r.status_code == 200
        claims = r.json()
        assert any(c["id"] == body["id"] for c in claims)

    def test_invalid_claim_type_rejected(self, base_url):
        cust = _register(base_url)
        order = _make_order(base_url, cust["token"])

        r = requests.post(
            f"{base_url}/api/claims",
            headers=_hdr(cust["token"]),
            json={
                "order_id": order["id"],
                "subject": "x",
                "description": "x",
                "claim_type": "bogus_type",
                "category": "claim",
                "user_id": "x",
            },
        )
        assert r.status_code == 400

    def test_cannot_claim_other_users_order(self, base_url):
        cust_a = _register(base_url)
        cust_b = _register(base_url)
        order_a = _make_order(base_url, cust_a["token"])

        r = requests.post(
            f"{base_url}/api/claims",
            headers=_hdr(cust_b["token"]),
            json={
                "order_id": order_a["id"],
                "subject": "x",
                "description": "x",
                "claim_type": "other",
                "category": "claim",
                "user_id": "x",
            },
        )
        assert r.status_code == 404

    def test_resolve_approved_credits_wallet(self, base_url):
        cust = _register(base_url)
        order = _make_order(base_url, cust["token"])
        # File claim
        claim = requests.post(
            f"{base_url}/api/claims",
            headers=_hdr(cust["token"]),
            json={
                "order_id": order["id"],
                "subject": "x",
                "description": "Missing fries",
                "claim_type": "missing_item",
                "category": "claim",
                "user_id": "x",
            },
        ).json()

        admin = _register(base_url, "admin")
        r = requests.post(
            f"{base_url}/api/claims/{claim['id']}/resolve",
            headers=_hdr(admin["token"]),
            json={"resolution": "approved", "credit_amount": 5.0, "notes": "ok"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "resolved"
        assert r.json()["credit_amount"] == 5.0

        # Wallet now has 5 USD
        r = requests.get(f"{base_url}/api/wallet", headers=_hdr(cust["token"]))
        assert r.status_code == 200
        balances = r.json().get("balances", {})
        assert balances.get("USD", 0) >= 5.0

    def test_resolve_rejected_no_credit(self, base_url):
        cust = _register(base_url)
        order = _make_order(base_url, cust["token"])
        claim = requests.post(
            f"{base_url}/api/claims",
            headers=_hdr(cust["token"]),
            json={
                "order_id": order["id"],
                "subject": "x",
                "description": "x",
                "claim_type": "other",
                "category": "claim",
                "user_id": "x",
            },
        ).json()

        admin = _register(base_url, "admin")
        r = requests.post(
            f"{base_url}/api/claims/{claim['id']}/resolve",
            headers=_hdr(admin["token"]),
            json={"resolution": "rejected"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "closed"
        assert r.json().get("credit_amount") is None

    def test_message_endpoint_accepts_json_body(self, base_url):
        cust = _register(base_url)
        order = _make_order(base_url, cust["token"])
        claim = requests.post(
            f"{base_url}/api/claims",
            headers=_hdr(cust["token"]),
            json={
                "order_id": order["id"],
                "subject": "x",
                "description": "x",
                "claim_type": "other",
                "category": "claim",
                "user_id": "x",
            },
        ).json()

        r = requests.post(
            f"{base_url}/api/support/tickets/{claim['id']}/messages",
            headers=_hdr(cust["token"]),
            json={"message": "Any update?", "sender_type": "customer"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["message"] == "Any update?"

    def test_non_admin_cannot_resolve(self, base_url):
        cust = _register(base_url)
        order = _make_order(base_url, cust["token"])
        claim = requests.post(
            f"{base_url}/api/claims",
            headers=_hdr(cust["token"]),
            json={
                "order_id": order["id"],
                "subject": "x",
                "description": "x",
                "claim_type": "other",
                "category": "claim",
                "user_id": "x",
            },
        ).json()

        r = requests.post(
            f"{base_url}/api/claims/{claim['id']}/resolve",
            headers=_hdr(cust["token"]),
            json={"resolution": "approved", "credit_amount": 5.0},
        )
        assert r.status_code == 403

"""Backend API tests for the IslandHop in-app wallet (live features only).

Covers:
  - GET /api/wallet (auto-create, default balances, default_currency, auth)
  - GET /api/wallet/transactions
  - POST /api/wallet/send (recipient not found, self-send, insufficient balance, success)
  - POST /api/wallet/pay-order (404, double-pay, insufficient, success)

NOTE: The legacy CariPay link/deposit/withdraw flow + /webhook/caripay were removed.
Wallets are funded via the live funding-request → admin-approve path (see `_fund_wallet`).
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

OWNER_EMAIL = "tracyfortune@islandhoptt.com"
OWNER_PASSWORD = "IslandHopAdmin2026!"


# ---------- helpers ----------
def _register(email_prefix="wallet"):
    email = f"{email_prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@test.com".lower()
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "Test1234!", "name": "Wallet Tester", "user_type": "customer"},
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return {
        "email": email,
        "user_id": body["user"]["id"],
        "token": body["access_token"],
        "headers": {"Authorization": f"Bearer {body['access_token']}", "Content-Type": "application/json"},
    }


def _admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"owner admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


def _fund_wallet(user, amount, currency="USD"):
    """Fund a wallet via the live path: user files a deposit funding-request, admin approves."""
    r = requests.post(f"{BASE_URL}/api/wallet/funding-request",
                      json={"direction": "deposit", "method": "bank", "amount": amount, "currency": currency},
                      headers=user["headers"], timeout=20)
    assert r.status_code == 200, f"funding-request failed: {r.text}"
    rid = r.json()["request"]["id"]
    ar = requests.post(f"{BASE_URL}/api/admin/wallet/funding-requests/{rid}/approve",
                       headers=_admin_headers(), timeout=20)
    assert ar.status_code == 200, f"funding approve failed: {ar.text}"


@pytest.fixture(scope="module")
def user_a():
    return _register("walletA")


@pytest.fixture(scope="module")
def user_b():
    return _register("walletB")


# =================== GET /api/wallet ===================
class TestGetWallet:
    def test_401_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/wallet", timeout=20)
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"

    def test_auto_create_wallet_default_state(self, user_a):
        r = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        w = r.json()
        assert w["user_id"] == user_a["user_id"]
        assert w["balances"].get("USD") == 0
        assert w["balances"].get("TTD") == 0
        assert w["default_currency"] == "USD"
        assert "id" in w

    def test_idempotent_get(self, user_a):
        r1 = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20)
        r2 = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20)
        assert r1.json()["id"] == r2.json()["id"]


# =================== GET /api/wallet/transactions ===================
class TestGetTransactions:
    def test_401_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/wallet/transactions", timeout=20)
        assert r.status_code == 401

    def test_returns_list_initially_empty(self, user_a):
        r = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# =================== POST /api/wallet/send ===================
class TestP2PSend:
    def test_401_without_auth(self):
        r = requests.post(f"{BASE_URL}/api/wallet/send",
                          json={"recipient_email": "x@y.com", "amount": 1, "currency": "USD"}, timeout=20)
        assert r.status_code == 401

    def test_recipient_not_found(self, user_a):
        r = requests.post(f"{BASE_URL}/api/wallet/send",
                          json={"recipient_email": f"nobody_{uuid.uuid4().hex}@nowhere.test",
                                "amount": 1, "currency": "USD"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 404, r.text

    def test_self_send_400(self, user_a):
        r = requests.post(f"{BASE_URL}/api/wallet/send",
                          json={"recipient_email": user_a["email"], "amount": 1, "currency": "USD"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_insufficient_balance_no_debit(self, user_b, user_a):
        # user_b sending USD to user_a — user_b has $0 USD
        before_sender = requests.get(f"{BASE_URL}/api/wallet", headers=user_b["headers"], timeout=20).json()
        before_recipient = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20).json()
        r = requests.post(f"{BASE_URL}/api/wallet/send",
                          json={"recipient_email": user_a["email"], "amount": 5, "currency": "USD"},
                          headers=user_b["headers"], timeout=20)
        assert r.status_code == 400
        after_sender = requests.get(f"{BASE_URL}/api/wallet", headers=user_b["headers"], timeout=20).json()
        after_recipient = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20).json()
        assert before_sender["balances"].get("USD", 0) == after_sender["balances"].get("USD", 0)
        assert before_recipient["balances"].get("USD", 0) == after_recipient["balances"].get("USD", 0)

    def test_successful_p2p(self, user_a, user_b):
        _fund_wallet(user_a, 20, "USD")  # live funding so the sender has a balance
        sender_before = float(requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"]).json()["balances"]["USD"])
        recipient_before = float(requests.get(f"{BASE_URL}/api/wallet", headers=user_b["headers"]).json()["balances"].get("USD", 0))
        assert sender_before >= 5

        r = requests.post(f"{BASE_URL}/api/wallet/send",
                          json={"recipient_email": user_b["email"], "amount": 5, "currency": "USD", "note": "lunch"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["transaction"]["type"] == "p2p_send"
        assert body["balance"]["USD"] == pytest.approx(sender_before - 5, rel=1e-6)

        recipient_after = float(requests.get(f"{BASE_URL}/api/wallet", headers=user_b["headers"]).json()["balances"]["USD"])
        assert recipient_after == pytest.approx(recipient_before + 5, rel=1e-6)

        rtxns = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=user_b["headers"]).json()
        assert any(t["type"] == "p2p_receive" and t["amount"] == 5 for t in rtxns)


# =================== POST /api/wallet/pay-order ===================
class TestPayOrder:
    @pytest.fixture(scope="class")
    def order(self, user_a):
        wallet = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"]).json()
        if float(wallet["balances"].get("USD", 0)) < 60:
            _fund_wallet(user_a, 200, "USD")
        payload = {
            "customer_id": "will_be_overridden",
            "service_type": "food",
            "restaurant_id": f"rest_{uuid.uuid4().hex[:6]}",
            "items": [{"menu_item_id": str(uuid.uuid4()), "name": "Patty", "price": 5.0, "quantity": 2}],
            "subtotal": 10.0,
            "delivery_fee": 3.0,
            "tip": 0.0,
            "total": 13.0,
            "pickup_address": {"street": "1 A", "city": "K"},
            "delivery_address": {"street": "2 B", "city": "K"},
            "customer_phone": "555",
            "payment_method": "wallet",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        return r.json()

    def test_unknown_order_404(self, user_a):
        r = requests.post(f"{BASE_URL}/api/wallet/pay-order",
                          json={"order_id": f"missing_{uuid.uuid4().hex}"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 404, r.text

    def test_insufficient_balance(self, user_b):
        payload = {
            "customer_id": "will_be_overridden",
            "service_type": "food",
            "restaurant_id": f"rest_{uuid.uuid4().hex[:6]}",
            "items": [{"menu_item_id": str(uuid.uuid4()), "name": "Big meal", "price": 5000.0, "quantity": 1}],
            "subtotal": 5000.0, "delivery_fee": 0.0, "tip": 0.0, "total": 5000.0,
            "pickup_address": {"street": "1", "city": "K"},
            "delivery_address": {"street": "2", "city": "K"},
            "customer_phone": "555",
            "payment_method": "wallet",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, headers=user_b["headers"], timeout=20)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        r = requests.post(f"{BASE_URL}/api/wallet/pay-order",
                          json={"order_id": oid},
                          headers=user_b["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_pay_then_double_pay(self, user_a, order):
        oid = order["id"]
        before = float(requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"]).json()["balances"]["USD"])
        r = requests.post(f"{BASE_URL}/api/wallet/pay-order",
                          json={"order_id": oid},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["transaction"]["type"] == "order_payment"
        after = float(requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"]).json()["balances"]["USD"])
        assert after == pytest.approx(before - float(order["total"]), rel=1e-6)

        r2 = requests.post(f"{BASE_URL}/api/wallet/pay-order",
                           json={"order_id": oid},
                           headers=user_a["headers"], timeout=20)
        assert r2.status_code == 400, r2.text

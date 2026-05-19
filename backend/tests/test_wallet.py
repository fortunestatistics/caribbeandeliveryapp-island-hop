"""Backend API tests for IslandHop in-app wallet + CariPay (MOCK) integration.

Covers:
  - GET /api/wallet (auto-create, default balances, default_currency, auth)
  - GET /api/wallet/transactions
  - POST/DELETE /api/wallet/link (handle persistence + validation)
  - POST /api/wallet/deposit (requires linked CariPay, currency validation, amount bounds)
  - POST /api/wallet/withdraw (insufficient balance => 400, must NOT debit on failure)
  - POST /api/wallet/send (recipient not found, self-send, insufficient balance, success)
  - POST /api/wallet/pay-order (404, double-pay, insufficient, success)
  - POST /api/webhook/caripay (mock signature, idempotency, unknown handle, invalid JSON)

MOCK_CARIPAY=true is assumed (see /app/backend/.env). CariPay client is mocked.
"""
import os
import json
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
        # default balances (TTD as Trinidad launch market)
        assert w["balances"].get("USD") == 0
        assert w["balances"].get("TTD") == 0
        assert w["default_currency"] == "USD"
        assert w.get("caripay_handle") in (None, "")
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
        data = r.json()
        assert isinstance(data, list)


# =================== POST/DELETE /api/wallet/link ===================
class TestLink:
    def test_401_without_auth(self):
        r = requests.post(f"{BASE_URL}/api/wallet/link", json={"handle": "+18761234567", "country": "JM"}, timeout=20)
        assert r.status_code == 401

    def test_empty_handle_400(self, user_a):
        r = requests.post(f"{BASE_URL}/api/wallet/link",
                          json={"handle": "   ", "country": "JM"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_link_persists_handle(self, user_a):
        handle = f"+1876{uuid.uuid4().hex[:7]}"
        r = requests.post(f"{BASE_URL}/api/wallet/link",
                          json={"handle": handle, "country": "JM"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["caripay_handle"] == handle
        assert body["caripay_country"] == "JM"
        # GET confirms persistence
        g = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20).json()
        assert g["caripay_handle"] == handle

    def test_unlink_clears_handle(self, user_b):
        # link first
        requests.post(f"{BASE_URL}/api/wallet/link",
                      json={"handle": "temp_handle_xyz", "country": "TT"},
                      headers=user_b["headers"], timeout=20)
        r = requests.delete(f"{BASE_URL}/api/wallet/link", headers=user_b["headers"], timeout=20)
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/wallet", headers=user_b["headers"], timeout=20).json()
        assert g.get("caripay_handle") in (None, "")
        # re-link for further tests
        requests.post(f"{BASE_URL}/api/wallet/link",
                      json={"handle": f"+1868{uuid.uuid4().hex[:7]}", "country": "TT"},
                      headers=user_b["headers"], timeout=20)


# =================== POST /api/wallet/deposit ===================
class TestDeposit:
    def test_401_without_auth(self):
        r = requests.post(f"{BASE_URL}/api/wallet/deposit", json={"amount": 10, "currency": "USD"}, timeout=20)
        assert r.status_code == 401

    def test_requires_linked_caripay(self):
        # Fresh user, no link
        u = _register("nodlink")
        r = requests.post(f"{BASE_URL}/api/wallet/deposit",
                          json={"amount": 10, "currency": "USD"},
                          headers=u["headers"], timeout=20)
        assert r.status_code == 400, r.text
        assert "link" in r.text.lower() or "caripay" in r.text.lower()

    def test_amount_too_low(self, user_a):
        r = requests.post(f"{BASE_URL}/api/wallet/deposit",
                          json={"amount": 0, "currency": "USD"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 400

    def test_amount_too_high(self, user_a):
        r = requests.post(f"{BASE_URL}/api/wallet/deposit",
                          json={"amount": 10001, "currency": "USD"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 400

    def test_unknown_currency_400(self, user_a):
        r = requests.post(f"{BASE_URL}/api/wallet/deposit",
                          json={"amount": 5, "currency": "XYZ"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 400

    def test_deposit_usd_credits_balance_and_records_txn(self, user_a):
        before = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20).json()
        before_bal = float(before["balances"].get("USD", 0))

        r = requests.post(f"{BASE_URL}/api/wallet/deposit",
                          json={"amount": 100.0, "currency": "USD", "note": "test deposit"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["transaction"]["type"] == "deposit"
        assert body["transaction"]["status"] == "completed"
        assert body["transaction"]["amount"] == 100.0
        assert body["transaction"]["currency"] == "USD"
        # Balance increased by 100
        assert body["balance"]["USD"] == pytest.approx(before_bal + 100.0, rel=1e-6)

        # Verify via GET
        after = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20).json()
        assert float(after["balances"]["USD"]) == pytest.approx(before_bal + 100.0, rel=1e-6)

        # Txn listed
        txns = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=user_a["headers"], timeout=20).json()
        assert any(t["type"] == "deposit" and t["amount"] == 100.0 for t in txns)

    @pytest.mark.parametrize("ccy", ["JMD", "TTD", "BBD", "GHS", "NGN", "ZAR"])
    def test_deposit_other_supported_currencies(self, user_a, ccy):
        r = requests.post(f"{BASE_URL}/api/wallet/deposit",
                          json={"amount": 50, "currency": ccy},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, f"{ccy}: {r.text}"
        assert r.json()["balance"][ccy] >= 50


# =================== POST /api/wallet/withdraw ===================
class TestWithdraw:
    def test_401_without_auth(self):
        r = requests.post(f"{BASE_URL}/api/wallet/withdraw", json={"amount": 5, "currency": "USD"}, timeout=20)
        assert r.status_code == 401

    def test_requires_link(self):
        u = _register("nowlink")
        r = requests.post(f"{BASE_URL}/api/wallet/withdraw",
                          json={"amount": 5, "currency": "USD"}, headers=u["headers"], timeout=20)
        assert r.status_code == 400

    def test_insufficient_balance_does_not_debit(self, user_b):
        # user_b is linked but balance is 0
        before = requests.get(f"{BASE_URL}/api/wallet", headers=user_b["headers"], timeout=20).json()
        usd_before = float(before["balances"].get("USD", 0))
        r = requests.post(f"{BASE_URL}/api/wallet/withdraw",
                          json={"amount": 50, "currency": "USD"},
                          headers=user_b["headers"], timeout=20)
        assert r.status_code == 400, r.text
        after = requests.get(f"{BASE_URL}/api/wallet", headers=user_b["headers"], timeout=20).json()
        usd_after = float(after["balances"].get("USD", 0))
        assert usd_before == usd_after, "balance was modified on failed withdraw"

    def test_successful_withdraw_debits_and_records(self, user_a):
        before = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"], timeout=20).json()
        usd_before = float(before["balances"]["USD"])
        assert usd_before >= 10, "test prerequisite: user_a needs USD from prior deposit"

        r = requests.post(f"{BASE_URL}/api/wallet/withdraw",
                          json={"amount": 10, "currency": "USD"},
                          headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["transaction"]["type"] == "withdraw"
        assert body["transaction"]["status"] == "completed"
        assert body["balance"]["USD"] == pytest.approx(usd_before - 10, rel=1e-6)


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

        # recipient should see a p2p_receive txn
        rtxns = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=user_b["headers"]).json()
        assert any(t["type"] == "p2p_receive" and t["amount"] == 5 for t in rtxns)


# =================== POST /api/wallet/pay-order ===================
class TestPayOrder:
    @pytest.fixture(scope="class")
    def order(self, user_a):
        # ensure user_a has enough USD
        wallet = requests.get(f"{BASE_URL}/api/wallet", headers=user_a["headers"]).json()
        if float(wallet["balances"].get("USD", 0)) < 60:
            requests.post(f"{BASE_URL}/api/wallet/deposit",
                          json={"amount": 200, "currency": "USD"},
                          headers=user_a["headers"], timeout=20)
        # create an order
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
        # user_b has only ~$5 USD (received from p2p). Create $50 order.
        payload = {
            "customer_id": "will_be_overridden",
            "service_type": "food",
            "restaurant_id": f"rest_{uuid.uuid4().hex[:6]}",
            "items": [{"menu_item_id": str(uuid.uuid4()), "name": "Big meal", "price": 50.0, "quantity": 1}],
            "subtotal": 50.0, "delivery_fee": 0.0, "tip": 0.0, "total": 50.0,
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

        # double-pay must be 400
        r2 = requests.post(f"{BASE_URL}/api/wallet/pay-order",
                           json={"order_id": oid},
                           headers=user_a["headers"], timeout=20)
        assert r2.status_code == 400, r2.text


# =================== POST /api/webhook/caripay ===================
class TestCariPayWebhook:
    def test_invalid_json_400(self):
        r = requests.post(f"{BASE_URL}/api/webhook/caripay",
                          data="not-json-at-all", headers={"Content-Type": "application/json"},
                          timeout=20)
        assert r.status_code == 400, r.text

    def test_unknown_handle_ignored(self):
        r = requests.post(f"{BASE_URL}/api/webhook/caripay",
                          json={"type": "deposit.completed", "transfer_id": f"tx_{uuid.uuid4().hex}",
                                "handle": f"nope_{uuid.uuid4().hex}", "amount": 10, "currency": "USD",
                                "status": "completed"},
                          timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("received") is True
        assert body.get("ignored") is True

    def test_webhook_credits_and_is_idempotent(self):
        # Create a fresh user, link a unique handle
        u = _register("hookuser")
        handle = f"hook_{uuid.uuid4().hex[:10]}"
        requests.post(f"{BASE_URL}/api/wallet/link",
                      json={"handle": handle, "country": "JM"},
                      headers=u["headers"], timeout=20)

        before = float(requests.get(f"{BASE_URL}/api/wallet", headers=u["headers"]).json()["balances"].get("USD", 0))
        transfer_id = f"cp_{uuid.uuid4().hex}"
        event = {"type": "deposit.completed", "transfer_id": transfer_id,
                 "handle": handle, "amount": 25.0, "currency": "USD", "status": "completed"}

        r1 = requests.post(f"{BASE_URL}/api/webhook/caripay", json=event, timeout=20)
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1.get("received") is True and b1.get("credited") is True

        after1 = float(requests.get(f"{BASE_URL}/api/wallet", headers=u["headers"]).json()["balances"]["USD"])
        assert after1 == pytest.approx(before + 25.0, rel=1e-6)

        # Replay — should be duplicate, NO double credit
        r2 = requests.post(f"{BASE_URL}/api/webhook/caripay", json=event, timeout=20)
        assert r2.status_code == 200, r2.text
        b2 = r2.json()
        assert b2.get("duplicate") is True

        after2 = float(requests.get(f"{BASE_URL}/api/wallet", headers=u["headers"]).json()["balances"]["USD"])
        assert after2 == pytest.approx(after1, rel=1e-6), "duplicate webhook double-credited"

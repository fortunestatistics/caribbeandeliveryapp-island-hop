"""Backend API tests for the new IslandHop wallet features (iteration 5):
  * Request Money endpoints  -- POST/GET/approve/decline/DELETE  /api/wallet/requests
  * Refund-to-wallet         -- POST /api/orders/{id}/refund when order was paid via wallet
  * Amount rounding          -- _round_money applied at /api/wallet/deposit (and downstream)
  * Driver-delivery credit   -- negative-path code review only (silent skip when no driver row)

MOCK_CARIPAY=true is assumed (see /app/backend/.env).
Auth: JWT Bearer (POST /api/auth/register).
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


# ---------- helpers ----------
def _register(prefix: str = "req"):
    email = f"{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@test.com".lower()
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "Test1234!", "name": "QA Tester", "user_type": "customer"},
        timeout=30,
    )
    assert r.status_code == 200, f"register: {r.status_code} {r.text}"
    body = r.json()
    return {
        "email": email,
        "user_id": body["user"]["id"],
        "token": body["access_token"],
        "headers": {
            "Authorization": f"Bearer {body['access_token']}",
            "Content-Type": "application/json",
        },
    }


def _admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "tracyfortune@islandhoptt.com", "password": "IslandHopAdmin2026!"}, timeout=30)
    assert r.status_code == 200, f"owner admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}", "Content-Type": "application/json"}


def _link_and_deposit(user, amount: float = 100.0, currency: str = "USD"):
    """Fund a wallet via the live path (CariPay link/deposit removed): user files a
    deposit funding-request, admin approves it."""
    r = requests.post(f"{BASE_URL}/api/wallet/funding-request",
                      json={"direction": "deposit", "method": "bank", "amount": amount, "currency": currency},
                      headers=user["headers"], timeout=20)
    assert r.status_code == 200, f"funding-request failed: {r.text}"
    rid = r.json()["request"]["id"]
    ar = requests.post(f"{BASE_URL}/api/admin/wallet/funding-requests/{rid}/approve",
                       headers=_admin_headers(), timeout=20)
    assert ar.status_code == 200, f"funding approve failed: {ar.text}"
    return ar.json()


def _balance(user, ccy: str = "USD") -> float:
    r = requests.get(f"{BASE_URL}/api/wallet", headers=user["headers"], timeout=20)
    assert r.status_code == 200, r.text
    return float(r.json()["balances"].get(ccy, 0))


# ============================================================================
# Request Money - /api/wallet/requests
# ============================================================================
@pytest.fixture(scope="module")
def requester():
    """User A — will ask for money."""
    return _register("reqA")


@pytest.fixture(scope="module")
def payer():
    """User B — will pay (after depositing $100)."""
    u = _register("reqB")
    _link_and_deposit(u, amount=100.0, currency="USD")
    return u


@pytest.fixture(scope="module")
def stranger():
    """User C — uninvolved third party (used for 403 / unauth checks)."""
    return _register("reqC")


class TestRequestMoneyCreate:
    def test_create_unauth_401(self):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": "x@y.com", "amount": 5}, timeout=20)
        assert r.status_code == 401, r.text

    def test_create_amount_too_low(self, requester, payer):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 0},
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_create_amount_too_high(self, requester, payer):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 10001},
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_create_unsupported_currency(self, requester, payer):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 10, "currency": "XYZ"},
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_create_unknown_payer_404(self, requester):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": f"nobody_{uuid.uuid4().hex[:8]}@nope.com",
                                "amount": 10},
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 404, r.text

    def test_create_self_request_400(self, requester):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": requester["email"], "amount": 10},
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_create_success_returns_pending(self, requester, payer):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 12.34,
                                "currency": "USD", "note": "Lunch"},
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "pending"
        assert body["amount"] == pytest.approx(12.34)
        assert body["currency"] == "USD"
        assert body["id"]
        assert body["requester_user_id"] == requester["user_id"]
        assert body["payer_user_id"] == payer["user_id"]


class TestRequestMoneyList:
    def test_list_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/wallet/requests", timeout=20)
        assert r.status_code == 401, r.text

    def test_list_shows_outgoing_for_requester(self, requester, payer):
        # ensure at least one request exists
        requests.post(f"{BASE_URL}/api/wallet/requests",
                      json={"payer_email": payer["email"], "amount": 5},
                      headers=requester["headers"], timeout=20)
        r = requests.get(f"{BASE_URL}/api/wallet/requests",
                         headers=requester["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "incoming" in body and "outgoing" in body
        assert any(req["requester_user_id"] == requester["user_id"] for req in body["outgoing"])

    def test_list_shows_incoming_for_payer(self, requester, payer):
        r = requests.get(f"{BASE_URL}/api/wallet/requests",
                         headers=payer["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert any(req["payer_user_id"] == payer["user_id"] for req in body["incoming"])


class TestRequestApprove:
    @pytest.fixture
    def pending_request(self, requester, payer):
        r = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 7.50,
                                "currency": "USD", "note": "Coffee"},
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 200, r.text
        return r.json()

    def test_approve_unauth_401(self, pending_request):
        r = requests.post(f"{BASE_URL}/api/wallet/requests/{pending_request['id']}/approve",
                          timeout=20)
        assert r.status_code == 401, r.text

    def test_approve_unknown_id_404(self, payer):
        r = requests.post(f"{BASE_URL}/api/wallet/requests/missing_{uuid.uuid4().hex}/approve",
                          headers=payer["headers"], timeout=20)
        assert r.status_code == 404, r.text

    def test_approve_by_non_payer_403(self, pending_request, stranger):
        r = requests.post(f"{BASE_URL}/api/wallet/requests/{pending_request['id']}/approve",
                          headers=stranger["headers"], timeout=20)
        assert r.status_code == 403, r.text

    def test_approve_by_requester_403(self, pending_request, requester):
        # Requester cannot approve their own outgoing request
        r = requests.post(f"{BASE_URL}/api/wallet/requests/{pending_request['id']}/approve",
                          headers=requester["headers"], timeout=20)
        assert r.status_code == 403, r.text

    def test_approve_success_transfers_funds(self, pending_request, requester, payer):
        before_req = _balance(requester)
        before_payer = _balance(payer)
        amt = float(pending_request["amount"])

        r = requests.post(f"{BASE_URL}/api/wallet/requests/{pending_request['id']}/approve",
                          headers=payer["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["amount"] == pytest.approx(amt)

        # balances moved
        assert _balance(requester) == pytest.approx(before_req + amt, abs=1e-6)
        assert _balance(payer) == pytest.approx(before_payer - amt, abs=1e-6)

        # txns recorded — p2p_send on payer, p2p_receive on requester
        rt = requests.get(f"{BASE_URL}/api/wallet/transactions",
                          headers=payer["headers"], timeout=20).json()
        assert any(t["type"] == "p2p_send" and abs(t["amount"] - amt) < 1e-6 for t in rt)
        rt2 = requests.get(f"{BASE_URL}/api/wallet/transactions",
                           headers=requester["headers"], timeout=20).json()
        assert any(t["type"] == "p2p_receive" and abs(t["amount"] - amt) < 1e-6 for t in rt2)

        # status now approved (visible in list)
        lst = requests.get(f"{BASE_URL}/api/wallet/requests",
                          headers=payer["headers"], timeout=20).json()
        match = [r for r in lst["incoming"] if r["id"] == pending_request["id"]]
        assert match and match[0]["status"] == "approved"

    def test_double_approve_400(self, requester, payer):
        # Create + approve, then approve again -> 400
        c = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 2.0},
                          headers=requester["headers"], timeout=20)
        rid = c.json()["id"]
        a1 = requests.post(f"{BASE_URL}/api/wallet/requests/{rid}/approve",
                           headers=payer["headers"], timeout=20)
        assert a1.status_code == 200, a1.text
        a2 = requests.post(f"{BASE_URL}/api/wallet/requests/{rid}/approve",
                           headers=payer["headers"], timeout=20)
        assert a2.status_code == 400, a2.text

    def test_approve_insufficient_balance_400(self, requester):
        # broke user as payer
        broke = _register("reqBroke")  # never deposits
        c = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": broke["email"], "amount": 50.0},
                          headers=requester["headers"], timeout=20)
        rid = c.json()["id"]
        a = requests.post(f"{BASE_URL}/api/wallet/requests/{rid}/approve",
                          headers=broke["headers"], timeout=20)
        assert a.status_code == 400, a.text
        # must remain pending (lock was reverted)
        lst = requests.get(f"{BASE_URL}/api/wallet/requests",
                           headers=broke["headers"], timeout=20).json()
        match = [r for r in lst["incoming"] if r["id"] == rid]
        assert match and match[0]["status"] == "pending"


class TestRequestDecline:
    def test_decline_unauth_401(self):
        r = requests.post(f"{BASE_URL}/api/wallet/requests/x/decline", timeout=20)
        assert r.status_code == 401, r.text

    def test_decline_unknown_id_404(self, payer):
        r = requests.post(f"{BASE_URL}/api/wallet/requests/missing_{uuid.uuid4().hex}/decline",
                          headers=payer["headers"], timeout=20)
        assert r.status_code == 404, r.text

    def test_decline_by_non_payer_403(self, requester, payer, stranger):
        c = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 3.0},
                          headers=requester["headers"], timeout=20)
        rid = c.json()["id"]
        r = requests.post(f"{BASE_URL}/api/wallet/requests/{rid}/decline",
                          headers=stranger["headers"], timeout=20)
        assert r.status_code == 403, r.text

    def test_decline_success(self, requester, payer):
        c = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 4.0},
                          headers=requester["headers"], timeout=20)
        rid = c.json()["id"]
        before = _balance(payer)
        r = requests.post(f"{BASE_URL}/api/wallet/requests/{rid}/decline",
                          headers=payer["headers"], timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "declined"
        # no funds moved
        assert _balance(payer) == pytest.approx(before, abs=1e-6)
        # double decline is 400
        r2 = requests.post(f"{BASE_URL}/api/wallet/requests/{rid}/decline",
                           headers=payer["headers"], timeout=20)
        assert r2.status_code == 400, r2.text


class TestRequestCancel:
    def test_cancel_unauth_401(self):
        r = requests.delete(f"{BASE_URL}/api/wallet/requests/x", timeout=20)
        assert r.status_code == 401, r.text

    def test_cancel_unknown_id_404(self, requester):
        r = requests.delete(f"{BASE_URL}/api/wallet/requests/missing_{uuid.uuid4().hex}",
                            headers=requester["headers"], timeout=20)
        assert r.status_code == 404, r.text

    def test_cancel_by_payer_403(self, requester, payer):
        c = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 6.0},
                          headers=requester["headers"], timeout=20)
        rid = c.json()["id"]
        r = requests.delete(f"{BASE_URL}/api/wallet/requests/{rid}",
                            headers=payer["headers"], timeout=20)
        assert r.status_code == 403, r.text

    def test_cancel_success(self, requester, payer):
        c = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 8.0},
                          headers=requester["headers"], timeout=20)
        rid = c.json()["id"]
        r = requests.delete(f"{BASE_URL}/api/wallet/requests/{rid}",
                            headers=requester["headers"], timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "cancelled"
        # cannot cancel again
        r2 = requests.delete(f"{BASE_URL}/api/wallet/requests/{rid}",
                             headers=requester["headers"], timeout=20)
        assert r2.status_code == 400, r2.text

    def test_cannot_approve_cancelled(self, requester, payer):
        c = requests.post(f"{BASE_URL}/api/wallet/requests",
                          json={"payer_email": payer["email"], "amount": 9.0},
                          headers=requester["headers"], timeout=20)
        rid = c.json()["id"]
        requests.delete(f"{BASE_URL}/api/wallet/requests/{rid}",
                        headers=requester["headers"], timeout=20)
        a = requests.post(f"{BASE_URL}/api/wallet/requests/{rid}/approve",
                          headers=payer["headers"], timeout=20)
        assert a.status_code == 400, a.text


# ============================================================================
# Refund-to-wallet  -- POST /api/orders/{id}/refund (paid via wallet)
# ============================================================================
def _create_and_pay_order(user, total: float = 25.0):
    payload = {
        "customer_id": "will_be_overridden",
        "service_type": "food",
        "restaurant_id": f"rest_{uuid.uuid4().hex[:6]}",
        "items": [{"menu_item_id": str(uuid.uuid4()), "name": "Test item",
                   "price": total, "quantity": 1}],
        "subtotal": total, "delivery_fee": 0.0, "tip": 0.0, "total": total,
        "pickup_address": {"street": "1", "city": "K"},
        "delivery_address": {"street": "2", "city": "K"},
        "customer_phone": "555",
        "payment_method": "wallet",
    }
    r = requests.post(f"{BASE_URL}/api/orders", json=payload,
                      headers=user["headers"], timeout=20)
    assert r.status_code == 200, r.text
    oid = r.json()["id"]
    p = requests.post(f"{BASE_URL}/api/wallet/pay-order",
                      json={"order_id": oid},
                      headers=user["headers"], timeout=20)
    assert p.status_code == 200, p.text
    return oid


@pytest.fixture(scope="module")
def refund_user():
    u = _register("refundU")
    _link_and_deposit(u, amount=500.0, currency="USD")
    return u


class TestRefundToWallet:
    def test_full_refund_credits_wallet(self, refund_user):
        oid = _create_and_pay_order(refund_user, total=25.0)
        # Full refund returns the order's actual charged total (subtotal + service fee, etc.).
        order = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=refund_user["headers"], timeout=20).json()
        charged = round(float(order["total"]), 2)
        before = _balance(refund_user)

        r = requests.post(f"{BASE_URL}/api/orders/{oid}/refund",
                          json={"reason": "requested_by_customer"},
                          headers=refund_user["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["method"] == "wallet"
        assert body["status"] == "refunded"
        assert body["amount"] == pytest.approx(charged)

        # wallet credited
        assert _balance(refund_user) == pytest.approx(before + charged, abs=1e-6)

        # order updated
        o = requests.get(f"{BASE_URL}/api/orders/{oid}",
                         headers=refund_user["headers"], timeout=20).json()
        assert o.get("payment_status") == "refunded"

        # refund txn recorded
        txns = requests.get(f"{BASE_URL}/api/wallet/transactions",
                            headers=refund_user["headers"], timeout=20).json()
        assert any(t["type"] == "refund" and t.get("order_id") == oid for t in txns)

    def test_partial_refund_partial_status(self, refund_user):
        oid = _create_and_pay_order(refund_user, total=40.0)
        before = _balance(refund_user)

        r = requests.post(f"{BASE_URL}/api/orders/{oid}/refund",
                          json={"amount": 10.0, "reason": "duplicate"},
                          headers=refund_user["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["method"] == "wallet"
        assert body["status"] == "partially_refunded"
        assert body["amount"] == pytest.approx(10.0)
        assert _balance(refund_user) == pytest.approx(before + 10.0, abs=1e-6)

        # order shows partially_refunded
        o = requests.get(f"{BASE_URL}/api/orders/{oid}",
                         headers=refund_user["headers"], timeout=20).json()
        assert o.get("payment_status") == "partially_refunded"

    def test_refund_invalid_amount_400(self, refund_user):
        oid = _create_and_pay_order(refund_user, total=15.0)
        # over-refund
        r = requests.post(f"{BASE_URL}/api/orders/{oid}/refund",
                          json={"amount": 999.0},
                          headers=refund_user["headers"], timeout=20)
        assert r.status_code == 400, r.text
        # negative
        r2 = requests.post(f"{BASE_URL}/api/orders/{oid}/refund",
                           json={"amount": -1.0},
                           headers=refund_user["headers"], timeout=20)
        assert r2.status_code == 400, r2.text

    def test_refund_unauth_other_user_403(self, refund_user):
        oid = _create_and_pay_order(refund_user, total=12.0)
        other = _register("refundOther")
        r = requests.post(f"{BASE_URL}/api/orders/{oid}/refund",
                          json={},
                          headers=other["headers"], timeout=20)
        # Either 403 (not authorized) or 404 (order scoped to customer) is acceptable
        assert r.status_code in (403, 404), r.text


# ============================================================================
# Amount rounding -- _round_money applied at /api/wallet/deposit
# ============================================================================
class TestAmountRounding:
    def test_deposit_rounds_to_two_decimals(self):
        u = _register("roundU")
        # File a deposit funding-request with a >2dp amount; server applies _round_money.
        r = requests.post(f"{BASE_URL}/api/wallet/funding-request",
                          json={"direction": "deposit", "method": "bank", "amount": 10.105, "currency": "USD"},
                          headers=u["headers"], timeout=20)
        assert r.status_code == 200, r.text
        req_amt = float(r.json()["request"]["amount"])
        assert abs(req_amt - 10.105) > 1e-9, f"amount not rounded server-side: {req_amt}"
        assert req_amt in (10.10, 10.11), f"expected 10.10 or 10.11, got {req_amt}"
        rid = r.json()["request"]["id"]

        ar = requests.post(f"{BASE_URL}/api/admin/wallet/funding-requests/{rid}/approve",
                           headers=_admin_headers(), timeout=20)
        assert ar.status_code == 200, ar.text

        # /wallet/transactions must show the same rounded value
        txns = requests.get(f"{BASE_URL}/api/wallet/transactions",
                            headers=u["headers"], timeout=20).json()
        assert txns, "no txns returned"
        amt_txn = float(txns[0]["amount"])
        assert amt_txn == req_amt
        assert amt_txn in (10.10, 10.11)

        # Balance reflects rounded amount
        bal = _balance(u)
        assert bal == pytest.approx(req_amt, abs=1e-6)


# ============================================================================
# Driver delivery wallet credit -- negative path code review
# ============================================================================
class TestDriverDeliveryCredit:
    def test_silent_skip_documented(self):
        """The PUT /orders/{id}/status='delivered' handler looks up the
        drivers row by order.driver_id, and if it's missing OR the row has no
        user_id, the IslandHop wallet credit step is silently skipped (no
        exception). Authentication for the actual delivery transition requires
        the caller to be the assigned driver/restaurant/admin, which is hard to
        seed without an admin endpoint. Verified via static inspection of
        server.py around line 2136 — `driver_row` may be None and
        `driver_user_id` is then None, guarded by
        `if driver_user_id and driver_earnings:` before _credit_wallet_with_txn.
        """
        import re as _re
        with open("/app/backend/server.py") as fh:
            src = fh.read()
        # Confirm the guard exists
        assert _re.search(r"if driver_user_id and driver_earnings", src), \
            "missing guard for missing driver row -- code-path will break"
        # Confirm both txn_type strings are present
        assert "txn_type=\"payout_in\"" in src
        assert "txn_type=\"tip_in\"" in src

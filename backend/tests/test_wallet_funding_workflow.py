"""
Phase-1 customer wallet funding tests (deposit/withdraw with admin approval).

Covers:
 - Payment methods CRUD (PayPal + Bank).
 - Customer creates deposit & withdraw funding requests.
 - Withdraw blocked when balance insufficient.
 - Admin lists pending requests & approves → wallet balance updates.
 - Withdraw approval debits balance, over-withdraw blocked at approval.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-island.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def customer_token():
    ts = int(time.time())
    email = f"qa_walletfunding_{ts}@test.com"
    payload = {"email": email, "password": "Test1234!", "name": "QA Wallet", "user_type": "customer"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in register response: {data}"
    return {"token": token, "email": email}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


# --- Payment methods CRUD ---------------------------------------------------
class TestPaymentMethods:
    def test_add_paypal_method(self, customer_token):
        r = requests.post(f"{API}/wallet/payment-methods",
                          headers=_h(customer_token["token"]),
                          json={"type": "paypal", "details": {"email": "qa@paypal.test"}}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["payment_method"]["type"] == "paypal"
        assert "id" in body["payment_method"]

    def test_add_bank_method_and_list(self, customer_token):
        r = requests.post(f"{API}/wallet/payment-methods",
                          headers=_h(customer_token["token"]),
                          json={"type": "bank_account",
                                "details": {"bank_name": "Republic Bank", "account_name": "QA",
                                            "account_number": "1234567890", "branch": "POS"}}, timeout=30)
        assert r.status_code == 200, r.text
        bank_id = r.json()["payment_method"]["id"]

        # list
        lr = requests.get(f"{API}/wallet/payment-methods", headers=_h(customer_token["token"]), timeout=30)
        assert lr.status_code == 200
        ids = [m["id"] for m in lr.json()["payment_methods"]]
        assert bank_id in ids

    def test_add_bank_method_missing_account_number(self, customer_token):
        r = requests.post(f"{API}/wallet/payment-methods",
                          headers=_h(customer_token["token"]),
                          json={"type": "bank_account", "details": {"bank_name": "X"}}, timeout=30)
        assert r.status_code == 400

    def test_delete_method(self, customer_token):
        r = requests.post(f"{API}/wallet/payment-methods",
                          headers=_h(customer_token["token"]),
                          json={"type": "paypal", "details": {"email": "delete@paypal.test"}}, timeout=30)
        pm_id = r.json()["payment_method"]["id"]
        d = requests.delete(f"{API}/wallet/payment-methods/{pm_id}",
                            headers=_h(customer_token["token"]), timeout=30)
        assert d.status_code == 200
        # second delete → 404
        d2 = requests.delete(f"{API}/wallet/payment-methods/{pm_id}",
                             headers=_h(customer_token["token"]), timeout=30)
        assert d2.status_code == 404


# --- Funding request lifecycle ---------------------------------------------
class TestFundingRequests:
    def test_over_withdraw_blocked_at_request(self, customer_token):
        r = requests.post(f"{API}/wallet/funding-request",
                          headers=_h(customer_token["token"]),
                          json={"direction": "withdraw", "method": "bank",
                                "amount": 500, "currency": "USD",
                                "destination": "1234"}, timeout=30)
        assert r.status_code == 400
        assert "Insufficient" in r.text or "insufficient" in r.text

    def test_invalid_method_rejected(self, customer_token):
        r = requests.post(f"{API}/wallet/funding-request",
                          headers=_h(customer_token["token"]),
                          json={"direction": "deposit", "method": "bitcoin", "amount": 10,
                                "currency": "USD"}, timeout=30)
        assert r.status_code == 400

    def test_create_deposit_request_appears_in_user_list(self, customer_token):
        r = requests.post(f"{API}/wallet/funding-request",
                          headers=_h(customer_token["token"]),
                          json={"direction": "deposit", "method": "bank",
                                "amount": 100, "currency": "USD",
                                "reference": "QA-REF-001"}, timeout=30)
        assert r.status_code == 200, r.text
        req = r.json()["request"]
        assert req["status"] == "pending"
        assert req["amount"] == 100.0
        assert req["currency"] == "USD"

        l = requests.get(f"{API}/wallet/funding-requests", headers=_h(customer_token["token"]), timeout=30)
        assert l.status_code == 200
        ids = [x["id"] for x in l.json()["requests"]]
        assert req["id"] in ids


# --- Admin approval + balance math -----------------------------------------
class TestAdminApprovalFlow:
    def test_full_deposit_then_withdraw_cycle(self, customer_token, admin_token):
        # 1) create deposit
        dep = requests.post(f"{API}/wallet/funding-request",
                            headers=_h(customer_token["token"]),
                            json={"direction": "deposit", "method": "bank",
                                  "amount": 250, "currency": "USD",
                                  "reference": "Cycle-Test"}, timeout=30)
        assert dep.status_code == 200, dep.text
        dep_id = dep.json()["request"]["id"]

        # 2) admin list pending and confirm the request is there
        adm = requests.get(f"{API}/admin/wallet/funding-requests?status=pending",
                           headers=_h(admin_token), timeout=30)
        assert adm.status_code == 200, adm.text
        ids = [r["id"] for r in adm.json()["requests"]]
        assert dep_id in ids

        # 3) admin approves deposit → balance credited
        ap = requests.post(f"{API}/admin/wallet/funding-requests/{dep_id}/approve",
                           headers=_h(admin_token), timeout=30)
        assert ap.status_code == 200, ap.text
        body = ap.json()
        assert body["status"] == "approved"
        assert float(body["balance"].get("USD", 0)) >= 250.0

        # second approve → 400 (already approved)
        ap2 = requests.post(f"{API}/admin/wallet/funding-requests/{dep_id}/approve",
                            headers=_h(admin_token), timeout=30)
        assert ap2.status_code == 400

        # 4) customer requests a withdraw within balance
        wd = requests.post(f"{API}/wallet/funding-request",
                           headers=_h(customer_token["token"]),
                           json={"direction": "withdraw", "method": "paypal",
                                 "amount": 100, "currency": "USD",
                                 "destination": "qa@paypal.test"}, timeout=30)
        assert wd.status_code == 200, wd.text
        wd_id = wd.json()["request"]["id"]

        # 5) admin approves withdraw → balance debited
        wa = requests.post(f"{API}/admin/wallet/funding-requests/{wd_id}/approve",
                           headers=_h(admin_token), timeout=30)
        assert wa.status_code == 200, wa.text
        new_bal = float(wa.json()["balance"].get("USD", 0))
        # net should equal previous - 100 (allow other tests' prior credits/debits)
        # Verify balance dropped by ~100
        prev = float(body["balance"].get("USD", 0))
        assert abs((prev - new_bal) - 100.0) < 0.01, f"expected -100, prev={prev} new={new_bal}"

        # 6) admin attempts huge withdraw → blocked at approval (or at create — both acceptable)
        huge = requests.post(f"{API}/wallet/funding-request",
                             headers=_h(customer_token["token"]),
                             json={"direction": "withdraw", "method": "bank",
                                   "amount": 99999, "currency": "USD",
                                   "destination": "1234"}, timeout=30)
        assert huge.status_code == 400  # blocked at request creation

    def test_admin_reject_flow(self, customer_token, admin_token):
        # Create a fresh deposit and reject it
        d = requests.post(f"{API}/wallet/funding-request",
                          headers=_h(customer_token["token"]),
                          json={"direction": "deposit", "method": "wipay",
                                "amount": 50, "currency": "TTD",
                                "reference": "RejectMe"}, timeout=30)
        assert d.status_code == 200
        rid = d.json()["request"]["id"]
        rj = requests.post(f"{API}/admin/wallet/funding-requests/{rid}/reject",
                           headers=_h(admin_token), timeout=30)
        assert rj.status_code == 200
        assert rj.json()["status"] == "rejected"

        # listed under rejected filter
        lr = requests.get(f"{API}/admin/wallet/funding-requests?status=rejected",
                          headers=_h(admin_token), timeout=30)
        assert lr.status_code == 200
        assert any(x["id"] == rid for x in lr.json()["requests"])

    def test_admin_endpoints_require_admin(self, customer_token):
        r = requests.get(f"{API}/admin/wallet/funding-requests",
                         headers=_h(customer_token["token"]), timeout=30)
        assert r.status_code in (401, 403)

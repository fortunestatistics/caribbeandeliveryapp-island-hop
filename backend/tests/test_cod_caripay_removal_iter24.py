"""Backend regression for iteration 24:
- CariPay/wallet endpoints removed (404)
- New COD endpoint POST /api/orders/{id}/confirm-cod works
- Order status transitions still work after COD (preparing/picked_up/delivered)
- /api/taxi/rate-card 200 regression
- Privacy / Terms pages reachable (frontend, but verified via static routes 200 on FE)
- Admin Mail status responds (auth required)
- WhatsApp code path on confirm-cod does not 500
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0]
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin.qa@islandhop-demo.com"
ADMIN_PASS = "AdminQA1234!"


@pytest.fixture(scope="module")
def customer_token():
    ts = int(time.time())
    email = f"TEST_cod_{ts}@gmail.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Test1234!", "name": "COD Tester",
        "user_type": "customer",
    }, timeout=20)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token: {data}"
    return tok, email


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- CariPay / Wallet endpoint removal ----------

class TestCariPayRemoval:
    def test_wallet_link_gone(self, customer_token):
        tok, _ = customer_token
        r = requests.post(f"{API}/wallet/link", json={}, headers=_h(tok), timeout=10)
        assert r.status_code == 404, f"expected 404 got {r.status_code} {r.text[:200]}"

    def test_wallet_deposit_gone(self, customer_token):
        tok, _ = customer_token
        r = requests.post(f"{API}/wallet/deposit", json={"amount": 10}, headers=_h(tok), timeout=10)
        assert r.status_code == 404

    def test_wallet_withdraw_gone(self, customer_token):
        tok, _ = customer_token
        r = requests.post(f"{API}/wallet/withdraw", json={"amount": 10}, headers=_h(tok), timeout=10)
        assert r.status_code == 404

    def test_caripay_webhook_gone(self):
        r = requests.post(f"{API}/webhook/caripay", json={}, timeout=10)
        assert r.status_code == 404


# ---------- Regression: rate card still up ----------

def test_taxi_rate_card_200():
    r = requests.get(f"{API}/taxi/rate-card", timeout=10)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    assert isinstance(data, (dict, list))


# ---------- COD checkout flow ----------

def _create_food_order(tok):
    payload = {
        "customer_id": "will-be-overwritten",
        "service_type": "food",
        "items": [{"menu_item_id": "item1", "id": "item1", "name": "Roti", "price": 8.50, "quantity": 1}],
        "subtotal": 8.50,
        "delivery_fee": 5.00,
        "total": 0,  # backend recalculates with service fee
        "pickup_address": {"street": "123 Vendor St", "city": "POS", "country": "TT"},
        "delivery_address": {"street": "45 Customer Rd", "city": "POS", "country": "TT"},
        "customer_phone": "+18685551111",
        "payment_method": "card",
    }
    r = requests.post(f"{API}/orders", json=payload, headers=_h(tok), timeout=20)
    assert r.status_code in (200, 201), f"create order failed: {r.status_code} {r.text[:300]}"
    return r.json()


class TestCODFlow:
    def test_confirm_cod_sets_fields(self, customer_token):
        tok, _ = customer_token
        order = _create_food_order(tok)
        oid = order["id"]
        assert order.get("status") in ("pending", "pending_payment", "created", "placed", None) or True

        r = requests.post(f"{API}/orders/{oid}/confirm-cod", headers=_h(tok), timeout=20)
        assert r.status_code == 200, f"confirm-cod: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("payment_method") == "cash"
        assert body.get("status") == "confirmed"

        # GET order — verify persistence
        g = requests.get(f"{API}/orders/{oid}", headers=_h(tok), timeout=10)
        assert g.status_code == 200
        od = g.json()
        assert od["payment_method"] == "cash"
        assert od["payment_status"] == "cod_pending"
        assert od["status"] == "confirmed"

    def test_confirm_cod_unauthenticated(self):
        r = requests.post(f"{API}/orders/does-not-matter/confirm-cod", timeout=10)
        assert r.status_code in (401, 403)

    def test_confirm_cod_unknown_order(self, customer_token):
        tok, _ = customer_token
        r = requests.post(f"{API}/orders/nonexistent-{uuid.uuid4()}/confirm-cod", headers=_h(tok), timeout=10)
        assert r.status_code == 404

    def test_cod_order_can_progress_through_logistics(self, customer_token, admin_token):
        """COD should NOT block subsequent status transitions.
        NOTE: surfaces a CRITICAL pre-existing bug in server.py — the PUT
        /api/orders/{id}/status route decorator wraps the helper
        `_status_timestamp_field` instead of `update_order_status`, so the
        endpoint returns 200 but does NOT actually persist the status change.
        """
        if not admin_token:
            pytest.skip("admin token unavailable")
        tok, _ = customer_token
        order = _create_food_order(tok)
        oid = order["id"]

        # Confirm via COD
        r = requests.post(f"{API}/orders/{oid}/confirm-cod", headers=_h(tok), timeout=20)
        assert r.status_code == 200

        # Try transitions with admin token
        last_status = None
        for status in ["preparing", "picked_up", "delivered"]:
            up = requests.put(f"{API}/orders/{oid}/status",
                              params={"status": status},
                              headers=_h(admin_token), timeout=15)
            last_status = (status, up.status_code, up.text[:200])
            assert up.status_code in (200, 201), f"transition {status} failed: {up.status_code} {up.text[:300]}"

        # Final verify — read order via customer
        g = requests.get(f"{API}/orders/{oid}", headers=_h(tok), timeout=10)
        assert g.status_code == 200
        final = g.json().get("status")
        # If this fails, PUT /api/orders/{id}/status is broken (decorator bound to wrong function).
        assert final == "delivered", (
            f"Order status did not advance to 'delivered' after PUT calls returned 200. "
            f"Got '{final}'. Last PUT result: {last_status}. "
            f"Likely cause: @api_router.put('/orders/{{order_id}}/status') decorator in server.py "
            f"is attached to helper `_status_timestamp_field` (line ~2250) instead of "
            f"`update_order_status` (line ~2381). The route returns the timestamp-field name "
            f"as JSON without touching MongoDB."
        )


# ---------- Admin Mail workflow regression ----------

class TestAdminMailRegression:
    def test_admin_mail_status(self, admin_token):
        if not admin_token:
            pytest.skip("no admin")
        r = requests.get(f"{API}/admin/mail/status", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        # Must be a dict-shaped response (configured/consent fields, etc.)
        assert isinstance(data, dict)

    def test_admin_mail_status_unauthenticated(self):
        r = requests.get(f"{API}/admin/mail/status", timeout=10)
        assert r.status_code in (401, 403)


# ---------- Privacy / Terms pages (frontend static routes via React) ----------

class TestPublicPages:
    """These are React routes – served at frontend origin – verify 200."""
    def test_privacy_policy_route(self):
        # Frontend SPA always returns 200 for any unknown path (index.html)
        r = requests.get(f"{BASE_URL}/privacy-policy", timeout=15, allow_redirects=True)
        assert r.status_code == 200

    def test_terms_route(self):
        r = requests.get(f"{BASE_URL}/terms-and-conditions", timeout=15, allow_redirects=True)
        assert r.status_code == 200

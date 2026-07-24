"""Backend tests for Split-Cart Checkout, Merchant Weekly Payout, and QR-related endpoints (iter 45)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

VENDOR_ROTI = "b0ca2f1d-d696-4e77-a606-f82b44c5d817"     # Roti Palace (restaurant)
VENDOR_PHARMACY = "b12146bb-4e6c-4eac-86fe-e7732ca616c9"  # Island Health Pharmacy


# --- helpers ---------------------------------------------------------------

def _register_customer():
    email = f"split_cart_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "Test1234!", "name": "Split Cart QA", "phone": "+18684441234"},
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return body["user"]["id"], body["access_token"], email


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _address():
    return {"street": "1 QA Ave", "city": "Port of Spain", "country": "Trinidad & Tobago", "latitude": 10.65, "longitude": -61.5}


def _create_order(token, vendor_id, cart_group_id, service_type="food", subtotal=10.0):
    payload = {
        "customer_id": "will-be-overwritten",
        "restaurant_id": vendor_id,
        "vendor_id": vendor_id,
        "service_type": service_type,
        "items": [{"id": str(uuid.uuid4()), "name": "QA item", "quantity": 1, "price": subtotal, "menu_item_id": str(uuid.uuid4())}],
        "subtotal": subtotal,
        "delivery_fee": 3.0,
        "tip": 0.0,
        "total": subtotal + 3.0,
        "pickup_address": _address(),
        "delivery_address": _address(),
        "customer_phone": "+18684441234",
        "payment_method": "cash",
        "cart_group_id": cart_group_id,
    }
    return requests.post(f"{BASE_URL}/api/orders", json=payload, headers=_headers(token), timeout=30)


# --- fixtures --------------------------------------------------------------

@pytest.fixture(scope="module")
def customer():
    uid, token, email = _register_customer()
    return {"id": uid, "token": token, "email": email}


@pytest.fixture(scope="module")
def other_customer():
    uid, token, email = _register_customer()
    return {"id": uid, "token": token, "email": email}


@pytest.fixture(scope="module")
def two_orders(customer):
    cart_group_id = str(uuid.uuid4())
    r1 = _create_order(customer["token"], VENDOR_ROTI, cart_group_id, service_type="food", subtotal=12.5)
    r2 = _create_order(customer["token"], VENDOR_PHARMACY, cart_group_id, service_type="pharmacy", subtotal=8.0)
    assert r1.status_code == 200, f"order1 failed: {r1.status_code} {r1.text}"
    assert r2.status_code == 200, f"order2 failed: {r2.status_code} {r2.text}"
    o1, o2 = r1.json(), r2.json()
    return {"cart_group_id": cart_group_id, "orders": [o1, o2]}


# --- Split-cart order creation --------------------------------------------

class TestSplitCartOrderCreate:
    def test_orders_carry_cart_group_id(self, two_orders, customer):
        cgid = two_orders["cart_group_id"]
        for o in two_orders["orders"]:
            assert o["cart_group_id"] == cgid, f"cart_group_id not persisted on order {o['id']}"
            assert o["customer_id"] == customer["id"]
            assert o["status"] == "pending"

    def test_orders_persisted_via_get(self, two_orders, customer):
        r = requests.get(f"{BASE_URL}/api/orders", headers=_headers(customer["token"]), timeout=30)
        assert r.status_code == 200
        ids = {o["id"] for o in r.json()}
        for created in two_orders["orders"]:
            assert created["id"] in ids


# --- session-multi (Stripe) -----------------------------------------------

class TestCheckoutSessionMulti:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/payments/checkout/session-multi",
                          json={"order_ids": ["x"], "origin_url": "https://example.com"}, timeout=30)
        assert r.status_code in (401, 403)

    def test_rejects_empty_order_ids(self, customer):
        r = requests.post(
            f"{BASE_URL}/api/payments/checkout/session-multi",
            headers=_headers(customer["token"]),
            json={"order_ids": [], "origin_url": "https://example.com"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_cannot_pay_for_another_users_orders(self, other_customer, two_orders):
        # other_customer tries to check out first customer's orders
        ids = [o["id"] for o in two_orders["orders"]]
        r = requests.post(
            f"{BASE_URL}/api/payments/checkout/session-multi",
            headers=_headers(other_customer["token"]),
            json={"order_ids": ids, "origin_url": "https://example.com"},
            timeout=30,
        )
        # Should be 404 (orders not found for this user) — must not succeed
        assert r.status_code in (403, 404), f"cross-user checkout leaked: {r.status_code} {r.text}"

    def test_returns_stripe_url_and_order_ids(self, customer, two_orders):
        ids = [o["id"] for o in two_orders["orders"]]
        r = requests.post(
            f"{BASE_URL}/api/payments/checkout/session-multi",
            headers=_headers(customer["token"]),
            json={"order_ids": ids, "origin_url": "https://example.com"},
            timeout=45,
        )
        assert r.status_code == 200, f"session-multi failed: {r.status_code} {r.text}"
        data = r.json()
        assert "url" in data and data["url"].startswith("http"), f"missing stripe url: {data}"
        assert set(data.get("order_ids") or []) == set(ids)


# --- confirm-cod-multi ----------------------------------------------------

class TestConfirmCodMulti:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/orders/confirm-cod-multi", json={"order_ids": ["x"]}, timeout=30)
        assert r.status_code in (401, 403)

    def test_other_user_cannot_confirm_others_orders(self, other_customer, two_orders):
        ids = [o["id"] for o in two_orders["orders"]]
        r = requests.post(
            f"{BASE_URL}/api/orders/confirm-cod-multi",
            headers=_headers(other_customer["token"]),
            json={"order_ids": ids},
            timeout=30,
        )
        # endpoint silently skips non-owned orders; confirmed list should be empty
        assert r.status_code == 200
        assert r.json().get("order_ids") == []

    def test_confirms_all_and_persists(self, customer):
        # fresh orders to avoid interfering with session-multi test
        cgid = str(uuid.uuid4())
        r1 = _create_order(customer["token"], VENDOR_ROTI, cgid, subtotal=5.0)
        r2 = _create_order(customer["token"], VENDOR_PHARMACY, cgid, service_type="pharmacy", subtotal=6.0)
        assert r1.status_code == 200 and r2.status_code == 200
        ids = [r1.json()["id"], r2.json()["id"]]

        r = requests.post(
            f"{BASE_URL}/api/orders/confirm-cod-multi",
            headers=_headers(customer["token"]),
            json={"order_ids": ids},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert set(body["order_ids"]) == set(ids)
        assert body["payment_method"] == "cash"
        assert body["status"] == "confirmed"

        # Verify persistence
        gr = requests.get(f"{BASE_URL}/api/orders", headers=_headers(customer["token"]), timeout=30)
        assert gr.status_code == 200
        found = {o["id"]: o for o in gr.json() if o["id"] in ids}
        for oid in ids:
            o = found.get(oid)
            assert o is not None, f"order {oid} missing after confirm"
            assert o["status"] == "confirmed"
            assert o["payment_status"] == "cod_pending"
            assert o["payment_method"] == "cash"


# --- Merchant weekly payout endpoint --------------------------------------

class TestMerchantWeeklyPayout:
    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/merchant/payouts/weekly", timeout=30)
        assert r.status_code in (401, 403)

    def test_customer_gets_404(self, customer):
        # A plain customer has no merchant account → 404
        r = requests.get(f"{BASE_URL}/api/merchant/payouts/weekly",
                         headers=_headers(customer["token"]), timeout=30)
        assert r.status_code == 404

    def test_restaurant_owner_gets_summary(self):
        # register a customer then promote them via POST /api/restaurants
        uid, token, email = _register_customer()
        payload = {
            "user_id": uid,
            "name": f"QA Store {uuid.uuid4().hex[:5]}",
            "description": "qa",
            "cuisine_type": "caribbean",
            "address": {"street": "1 Test", "city": "Port of Spain", "country": "Trinidad & Tobago"},
            "phone": "+18684441111",
            "email": email,
        }
        rr = requests.post(f"{BASE_URL}/api/restaurants", json=payload,
                           headers=_headers(token), timeout=30)
        assert rr.status_code in (200, 201), f"create restaurant failed: {rr.status_code} {rr.text}"

        # re-login to refresh token/user_type
        li = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": email, "password": "Test1234!"}, timeout=30)
        assert li.status_code == 200
        merchant_token = li.json()["access_token"]

        r = requests.get(f"{BASE_URL}/api/merchant/payouts/weekly",
                         headers=_headers(merchant_token), timeout=30)
        assert r.status_code == 200, f"weekly payout failed: {r.status_code} {r.text}"
        body = r.json()
        for key in ("owed_this_week", "paid_this_week", "orders_this_week", "currency"):
            assert key in body, f"missing key {key} in {body}"
        assert isinstance(body["owed_this_week"], (int, float))
        assert isinstance(body["orders_this_week"], int)
        assert body["currency"] == "USD"


# --- Merchant vendor lookup (for QR target) -------------------------------

class TestSeededVendorsExist:
    """The QR code encodes {origin}/restaurant/{vendorId} — verify those ids are real."""
    @pytest.mark.parametrize("vid", [VENDOR_ROTI, VENDOR_PHARMACY])
    def test_public_storefront_reachable(self, vid):
        # /api/merchants/{id}/storefront is the endpoint the /restaurant/:id page uses.
        r = requests.get(f"{BASE_URL}/api/merchants/{vid}/storefront", timeout=30)
        assert r.status_code == 200, \
            f"seeded vendor {vid} storefront not resolvable: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body.get("vendor_id") == vid
        assert body.get("name")

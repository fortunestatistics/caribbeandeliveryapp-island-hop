"""
Iter 27 backend tests:
- Merchant storefront CRUD (auth + public)
- Self-service merchant coupons CRUD
- Coupon-at-checkout math + edge cases (404 invalid, 400 min_order, 400 usage_limit)
- Order creation regression for tiered driver payout (financial fields shape)
"""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE, "REACT_APP_BACKEND_URL must be configured"
API = f"{BASE}/api"


def _ts():
    return int(time.time() * 1000)


@pytest.fixture(scope="module")
def merchant():
    """Register a fresh customer, then POST /api/restaurants to promote to merchant.
    Returns dict with email, token (Bearer JWT), restaurant_id, user_id.
    """
    email = f"merchant_{_ts()}_{uuid.uuid4().hex[:6]}@test.com"
    pw = "MerchantPw1!"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": pw, "name": "Test Merchant", "user_type": "customer",
    }, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    token = data.get("access_token") or data.get("token")
    user_id = data["user"]["id"]
    assert token

    H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    rest_payload = {
        "user_id": user_id,  # dummy; backend overwrites with current_user.id anyway
        "name": f"Test Eatery {_ts()}",
        "description": "Storefront coupon test",
        "cuisine_type": "Caribbean",
        "address": {"street": "1 Main", "city": "Port of Spain", "country": "TT"},
        "phone": "+18685559999",
        "email": email,
    }
    rr = requests.post(f"{API}/restaurants", json=rest_payload, headers=H, timeout=20)
    assert rr.status_code == 200, rr.text
    rest_id = rr.json()["id"]
    return {"email": email, "password": pw, "token": token, "user_id": user_id,
            "restaurant_id": rest_id, "headers": H}


@pytest.fixture(scope="module")
def customer():
    email = f"buyer_{_ts()}_{uuid.uuid4().hex[:6]}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "BuyerPw1!", "name": "Buyer", "user_type": "customer",
    }, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    token = data.get("access_token") or data.get("token")
    return {"email": email, "token": token, "user_id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


# --------------------- STOREFRONT ---------------------

class TestStorefront:
    def test_put_and_get_storefront_then_public(self, merchant):
        bio = "Family-run Caribbean kitchen serving roti and doubles."
        payload = {
            "logo": "data:image/png;base64,iVBORw0KGgo=",
            "cover": "data:image/png;base64,iVBORw0KGgo=",
            "bio": bio,
            "gallery": [
                "data:image/png;base64,AAAA",
                "data:image/png;base64,BBBB",
            ],
        }
        r = requests.put(f"{API}/merchant/storefront", json=payload, headers=merchant["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["storefront"]["bio"] == bio
        assert len(body["storefront"]["gallery"]) == 2

        # GET own
        rg = requests.get(f"{API}/merchant/storefront", headers=merchant["headers"], timeout=20)
        assert rg.status_code == 200
        assert rg.json()["bio"] == bio
        assert rg.json()["vendor_id"] == merchant["restaurant_id"]

        # GET public
        rp = requests.get(f"{API}/merchants/{merchant['restaurant_id']}/storefront", timeout=20)
        assert rp.status_code == 200
        assert rp.json()["bio"] == bio
        assert rp.json().get("logo") is not None

    def test_bio_over_500_rejected(self, merchant):
        r = requests.put(f"{API}/merchant/storefront",
                         json={"bio": "x" * 501}, headers=merchant["headers"], timeout=20)
        assert r.status_code == 400

    def test_gallery_over_6_rejected(self, merchant):
        r = requests.put(f"{API}/merchant/storefront",
                         json={"gallery": ["data:image/png;base64,A"] * 7},
                         headers=merchant["headers"], timeout=20)
        assert r.status_code == 400


# --------------------- COUPONS CRUD ---------------------

class TestCouponsCRUD:
    def test_invalid_type_rejected(self, merchant):
        r = requests.post(f"{API}/merchant/coupons", json={
            "code": "BAD1", "discount_type": "weird", "discount_value": 10,
        }, headers=merchant["headers"], timeout=20)
        assert r.status_code == 400

    def test_percentage_over_100_rejected(self, merchant):
        r = requests.post(f"{API}/merchant/coupons", json={
            "code": "TOOBIG", "discount_type": "percentage", "discount_value": 150,
        }, headers=merchant["headers"], timeout=20)
        assert r.status_code == 400

    def test_invalid_code_chars_rejected(self, merchant):
        r = requests.post(f"{API}/merchant/coupons", json={
            "code": "AB", "discount_type": "fixed", "discount_value": 5,
        }, headers=merchant["headers"], timeout=20)
        assert r.status_code == 400

    def test_create_auto_code_when_blank(self, merchant):
        r = requests.post(f"{API}/merchant/coupons", json={
            "discount_type": "percentage", "discount_value": 5,
        }, headers=merchant["headers"], timeout=20)
        assert r.status_code == 200, r.text
        c = r.json()["coupon"]
        assert c["code"] and len(c["code"]) >= 3
        # cleanup
        requests.delete(f"{API}/merchant/coupons/{c['id']}", headers=merchant["headers"], timeout=10)

    def test_list_toggle_delete(self, merchant):
        code = f"LIST{_ts() % 100000}"
        r = requests.post(f"{API}/merchant/coupons", json={
            "code": code, "discount_type": "fixed", "discount_value": 3,
        }, headers=merchant["headers"], timeout=20)
        assert r.status_code == 200
        cid = r.json()["coupon"]["id"]

        lr = requests.get(f"{API}/merchant/coupons", headers=merchant["headers"], timeout=20)
        assert lr.status_code == 200
        matching = [c for c in lr.json() if c["id"] == cid]
        assert matching and "used_count" in matching[0] and "is_expired" in matching[0]

        pr = requests.patch(f"{API}/merchant/coupons/{cid}",
                            json={"active": False}, headers=merchant["headers"], timeout=20)
        assert pr.status_code == 200

        dr = requests.delete(f"{API}/merchant/coupons/{cid}", headers=merchant["headers"], timeout=20)
        assert dr.status_code == 200

    def test_duplicate_code_rejected(self, merchant):
        code = f"DUP{_ts() % 100000}"
        r1 = requests.post(f"{API}/merchant/coupons", json={
            "code": code, "discount_type": "fixed", "discount_value": 1,
        }, headers=merchant["headers"], timeout=20)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/merchant/coupons", json={
            "code": code, "discount_type": "fixed", "discount_value": 1,
        }, headers=merchant["headers"], timeout=20)
        assert r2.status_code == 400
        # cleanup
        cid = r1.json()["coupon"]["id"]
        requests.delete(f"{API}/merchant/coupons/{cid}", headers=merchant["headers"], timeout=10)


# --------------------- COUPON AT CHECKOUT (CRITICAL E2E) ---------------------

def _create_order(customer, restaurant_id, subtotal=50.0, delivery_fee=10.0, tip=0.0):
    payload = {
        "restaurant_id": restaurant_id,
        "service_type": "food",
        "items": [],
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "tip": tip,
        "total": subtotal + delivery_fee + tip,
        "pickup_address": {"street": "Vendor", "city": "POS", "country": "TT"},
        "delivery_address": {"street": "Buyer", "city": "POS", "country": "TT"},
        "customer_phone": "+18685550000",
        "payment_method": "cod",
    }
    r = requests.post(f"{API}/orders/create", json=payload, headers=customer["headers"], timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


class TestCouponAtCheckout:
    def test_percentage_15_on_50(self, merchant, customer):
        code = f"PCT{_ts() % 100000}"
        rc = requests.post(f"{API}/merchant/coupons", json={
            "code": code, "discount_type": "percentage", "discount_value": 15,
        }, headers=merchant["headers"], timeout=20)
        assert rc.status_code == 200
        try:
            order = _create_order(customer, merchant["restaurant_id"])
            order_id = order["id"]
            # service_fee should be $3 platform
            assert abs(float(order.get("service_fee", 0)) - 3.0) < 0.01

            r = requests.post(f"{API}/orders/{order_id}/apply-promo",
                              json={"code": code}, headers=customer["headers"], timeout=20)
            assert r.status_code == 200, r.text
            body = r.json()
            assert abs(body["discount"] - 7.5) < 0.01
            # total = 50 + 10 + 0 + 3 - 7.5 = 55.5
            assert abs(body["total"] - 55.5) < 0.01
        finally:
            requests.delete(f"{API}/merchant/coupons/{rc.json()['coupon']['id']}",
                            headers=merchant["headers"], timeout=10)

    def test_fixed_5(self, merchant, customer):
        code = f"FX{_ts() % 100000}"
        rc = requests.post(f"{API}/merchant/coupons", json={
            "code": code, "discount_type": "fixed", "discount_value": 5,
        }, headers=merchant["headers"], timeout=20)
        assert rc.status_code == 200
        try:
            order = _create_order(customer, merchant["restaurant_id"])
            r = requests.post(f"{API}/orders/{order['id']}/apply-promo",
                              json={"code": code}, headers=customer["headers"], timeout=20)
            assert r.status_code == 200, r.text
            body = r.json()
            assert abs(body["discount"] - 5.0) < 0.01
            assert abs(body["total"] - 58.0) < 0.01
        finally:
            requests.delete(f"{API}/merchant/coupons/{rc.json()['coupon']['id']}",
                            headers=merchant["headers"], timeout=10)

    def test_invalid_code_404(self, merchant, customer):
        order = _create_order(customer, merchant["restaurant_id"])
        r = requests.post(f"{API}/orders/{order['id']}/apply-promo",
                          json={"code": f"NOPE{_ts() % 10000}"},
                          headers=customer["headers"], timeout=20)
        assert r.status_code == 404

    def test_min_order_violation_400(self, merchant, customer):
        code = f"MIN{_ts() % 100000}"
        rc = requests.post(f"{API}/merchant/coupons", json={
            "code": code, "discount_type": "fixed", "discount_value": 5, "min_order_amount": 200,
        }, headers=merchant["headers"], timeout=20)
        assert rc.status_code == 200
        try:
            order = _create_order(customer, merchant["restaurant_id"], subtotal=50)
            r = requests.post(f"{API}/orders/{order['id']}/apply-promo",
                              json={"code": code}, headers=customer["headers"], timeout=20)
            assert r.status_code == 400
        finally:
            requests.delete(f"{API}/merchant/coupons/{rc.json()['coupon']['id']}",
                            headers=merchant["headers"], timeout=10)

    def test_usage_limit_exceeded_400(self, merchant, customer):
        code = f"LIM{_ts() % 100000}"
        rc = requests.post(f"{API}/merchant/coupons", json={
            "code": code, "discount_type": "fixed", "discount_value": 2, "usage_limit": 1,
        }, headers=merchant["headers"], timeout=20)
        assert rc.status_code == 200
        try:
            o1 = _create_order(customer, merchant["restaurant_id"])
            r1 = requests.post(f"{API}/orders/{o1['id']}/apply-promo",
                               json={"code": code}, headers=customer["headers"], timeout=20)
            assert r1.status_code == 200
            o2 = _create_order(customer, merchant["restaurant_id"])
            r2 = requests.post(f"{API}/orders/{o2['id']}/apply-promo",
                               json={"code": code}, headers=customer["headers"], timeout=20)
            assert r2.status_code == 400
        finally:
            requests.delete(f"{API}/merchant/coupons/{rc.json()['coupon']['id']}",
                            headers=merchant["headers"], timeout=10)


# --------------------- TIERED PAYOUT regression on order creation ---------------------

class TestOrderFinancialsRegression:
    def test_order_create_has_financial_fields(self, merchant, customer):
        order = _create_order(customer, merchant["restaurant_id"],
                              subtotal=50, delivery_fee=20, tip=5)
        # Must have service_fee 3, valid driver_fee_rate and split fields
        assert abs(float(order["service_fee"]) - 3.0) < 0.01
        # driver split may be auto-finalized if a driver is online, else pre-finalize defaults
        assert "driver_fee_rate" in order
        # Tier rates allowed: 0 (premium) or 0.20 (standard) — never 0.10/0.90
        assert order["driver_fee_rate"] in (0.0, 0.20)
        # driver_earnings should at minimum include tip if assigned; else 0 pre-assign
        assert float(order.get("tip", 0)) == 5.0
        # No regression: total = subtotal + delivery + tip + service_fee
        # (apply-promo would change later)
        # 50 + 20 + 5 + 3 = 78
        assert abs(float(order["total"]) - 78.0) < 0.01

"""
Iteration 29: Driver + Merchant 3-tier subscription tests.

Covers:
- DRIVER subscription API: plans catalogue, default tier, select Pro→Premium→Standard
- DRIVER payout integration: rate constants exposed via /plans (driver_keep_pct 80/90/100)
- MERCHANT subscription API: plans catalogue, default tier, select Pro→Premium
- MERCHANT commission integration: end-to-end with order creation under each tier,
  verifies commission_rate, commission_amount, vendor_payout, fixed service_fee=$3.00
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-island.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TS = int(time.time())


# ---------- Shared helpers ----------

def _register(email_prefix: str, user_type: str = "customer") -> dict:
    """Register a fresh customer (public register ignores user_type now)."""
    email = f"{email_prefix}_{TS}_{uuid.uuid4().hex[:6]}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Test1234!", "name": "QA Sub Test", "user_type": user_type,
    }, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "token": data["access_token"], "user_id": data["user"]["id"]}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- DRIVER subscription tests ----------

class TestDriverSubscription:

    @pytest.fixture(scope="class")
    def driver_ctx(self):
        u = _register("drv_sub")
        # Promote to driver via /api/drivers
        payload = {
            "license_number": f"DL-{TS}",
            "vehicle_type": "car",
            "vehicle_plate": f"PCV-{TS%10000}",
            "vehicle_make": "Toyota",
            "vehicle_model": "Corolla",
        }
        r = requests.post(f"{API}/drivers", json=payload, headers=_auth(u["token"]), timeout=30)
        assert r.status_code == 200, f"driver create failed: {r.status_code} {r.text}"
        return u

    def test_plans_catalogue(self, driver_ctx):
        r = requests.get(f"{API}/driver/subscription/plans", headers=_auth(driver_ctx["token"]), timeout=30)
        assert r.status_code == 200
        plans = r.json()
        assert isinstance(plans, list) and len(plans) == 3
        by_tier = {p["tier"]: p for p in plans}
        assert by_tier["standard"]["price_ttd"] == 0
        assert by_tier["pro"]["price_ttd"] == 700
        assert by_tier["premium"]["price_ttd"] == 1400
        assert by_tier["standard"]["driver_keep_pct"] == 80
        assert by_tier["pro"]["driver_keep_pct"] == 90
        assert by_tier["premium"]["driver_keep_pct"] == 100

    def test_default_tier_is_standard(self, driver_ctx):
        r = requests.get(f"{API}/driver/subscription", headers=_auth(driver_ctx["token"]), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("tier") == "standard", data

    def test_select_pro_then_verify(self, driver_ctx):
        r = requests.post(f"{API}/driver/subscription/select",
                          json={"tier": "pro"}, headers=_auth(driver_ctx["token"]), timeout=30)
        assert r.status_code == 200, r.text
        # GET to confirm persisted
        g = requests.get(f"{API}/driver/subscription", headers=_auth(driver_ctx["token"]), timeout=30)
        assert g.status_code == 200
        assert g.json().get("tier") == "pro"

    def test_select_premium_then_back_to_standard(self, driver_ctx):
        r = requests.post(f"{API}/driver/subscription/select",
                          json={"tier": "premium"}, headers=_auth(driver_ctx["token"]), timeout=30)
        assert r.status_code == 200
        g = requests.get(f"{API}/driver/subscription", headers=_auth(driver_ctx["token"]), timeout=30)
        assert g.json().get("tier") == "premium"
        # Back to standard (free) — should always succeed
        r2 = requests.post(f"{API}/driver/subscription/select",
                           json={"tier": "standard"}, headers=_auth(driver_ctx["token"]), timeout=30)
        assert r2.status_code == 200
        g2 = requests.get(f"{API}/driver/subscription", headers=_auth(driver_ctx["token"]), timeout=30)
        assert g2.json().get("tier") == "standard"


# ---------- MERCHANT subscription + commission tests ----------

class TestMerchantSubscriptionAndCommission:

    @pytest.fixture(scope="class")
    def merchant_ctx(self):
        u = _register("mrc_sub")
        body = {
            "user_id": u["user_id"],  # required by model but overwritten server-side
            "name": f"QA Merchant {TS}",
            "description": "QA merchant for subscription tier testing.",
            "cuisine_type": "Caribbean",
            "address": {
                "street": "1 QA Street", "city": "Port of Spain", "state": "Trinidad",
                "country": "TT", "postal_code": "00000",
            },
            "phone": "+18685550001",
            "email": u["email"],
        }
        r = requests.post(f"{API}/restaurants", json=body, headers=_auth(u["token"]), timeout=30)
        assert r.status_code == 200, f"restaurant create failed: {r.status_code} {r.text}"
        restaurant = r.json()
        u["restaurant_id"] = restaurant["id"]
        return u

    def test_plans_catalogue(self, merchant_ctx):
        r = requests.get(f"{API}/merchant/subscription/plans", headers=_auth(merchant_ctx["token"]), timeout=30)
        assert r.status_code == 200, r.text
        plans = r.json()
        assert len(plans) == 3
        by_tier = {p["tier"]: p for p in plans}
        assert by_tier["standard"]["price_ttd"] == 0
        assert by_tier["pro"]["price_ttd"] == 800
        assert by_tier["premium"]["price_ttd"] == 1600
        assert by_tier["standard"]["commission_pct"] == 10
        assert by_tier["pro"]["commission_pct"] == 5
        assert by_tier["premium"]["commission_pct"] == 0
        assert by_tier["standard"]["featured"] is False
        assert by_tier["pro"]["featured"] is True
        assert by_tier["premium"]["featured"] is True

    def test_default_tier_is_standard(self, merchant_ctx):
        r = requests.get(f"{API}/merchant/subscription", headers=_auth(merchant_ctx["token"]), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("tier") == "standard"

    # ---- end-to-end commission integration ----

    def _create_order(self, customer_token: str, restaurant_id: str) -> dict:
        addr = {
            "street": "Customer St", "city": "POS", "state": "TT",
            "country": "TT", "postal_code": "00000",
        }
        body = {
            "restaurant_id": restaurant_id,
            "items": [{
                "menu_item_id": "demo-item",
                "id": "demo-item",
                "name": "QA Item",
                "price": 100.0,
                "quantity": 1,
            }],
            "subtotal": 100.0,
            "delivery_fee": 10.0,
            "total": 113.0,
            "delivery_address": addr,
            "pickup_address": addr,
            "service_type": "food",
            "customer_phone": "+18685550100",
            "payment_method": "cod",
        }
        r = requests.post(f"{API}/orders/create", json=body, headers=_auth(customer_token), timeout=30)
        assert r.status_code in (200, 201), f"order create failed: {r.status_code} {r.text}"
        return r.json()

    def test_commission_standard_then_pro_then_premium(self, merchant_ctx):
        # Fresh customer to place orders
        cust = _register("mrc_cust")
        rid = merchant_ctx["restaurant_id"]
        tok = merchant_ctx["token"]

        # ----- STANDARD: 10% -----
        o1 = self._create_order(cust["token"], rid)
        assert o1.get("commission_rate") == 10, o1
        assert round(o1.get("commission_amount", -1), 2) == 10.0
        assert round(o1.get("vendor_payout", -1), 2) == 90.0
        assert round(o1.get("service_fee", -1), 2) == 3.0

        # ----- Upgrade to PRO -----
        up = requests.post(f"{API}/merchant/subscription/select",
                           json={"tier": "pro"}, headers=_auth(tok), timeout=30)
        assert up.status_code == 200, up.text
        check = requests.get(f"{API}/merchant/subscription", headers=_auth(tok), timeout=30).json()
        assert check.get("tier") == "pro"
        assert check.get("plan", {}).get("featured") is True, check

        o2 = self._create_order(cust["token"], rid)
        assert o2.get("commission_rate") == 5, o2
        assert round(o2.get("commission_amount", -1), 2) == 5.0
        assert round(o2.get("vendor_payout", -1), 2) == 95.0
        assert round(o2.get("service_fee", -1), 2) == 3.0

        # ----- Upgrade to PREMIUM -----
        up2 = requests.post(f"{API}/merchant/subscription/select",
                            json={"tier": "premium"}, headers=_auth(tok), timeout=30)
        assert up2.status_code == 200, up2.text
        check2 = requests.get(f"{API}/merchant/subscription", headers=_auth(tok), timeout=30).json()
        assert check2.get("tier") == "premium"
        assert check2.get("plan", {}).get("featured") is True

        o3 = self._create_order(cust["token"], rid)
        assert o3.get("commission_rate") == 0, o3
        assert round(o3.get("commission_amount", -1), 2) == 0.0
        assert round(o3.get("vendor_payout", -1), 2) == 100.0
        assert round(o3.get("service_fee", -1), 2) == 3.0

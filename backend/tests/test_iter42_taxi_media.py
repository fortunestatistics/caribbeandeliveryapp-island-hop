"""
Iteration 42 regression tests:
1. Vendor slim media endpoint: GET /api/vendors/{vendor_id}/media
2. Taxi commission split: 20% (standard) / 5% (pro) / 0% (premium) applied by
   _finalize_driver_split for service_type=='taxi'.
3. Delivery commission unchanged (regression): still uses DRIVER_PLAN_RATES 20/10/0.
4. Driver + merchant subscription plan catalogues.
"""
import os
import uuid
import asyncio
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


_LOOP = asyncio.new_event_loop()


def _run(async_fn):
    """Execute a zero-arg coroutine function on a shared event loop, so that the
    motor client that server.py creates at import time (bound to this loop) can
    be reused across tests."""
    return _LOOP.run_until_complete(async_fn())


def _make_client():
    from motor.motor_asyncio import AsyncIOMotorClient
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ---------------- 1. slim vendor media ----------------
class TestVendorMediaEndpoint:
    def test_media_with_cover_and_logo(self):
        vendor_id = f"TEST_media_{uuid.uuid4().hex[:8]}"

        async def seed():
            db = _make_client()
            await db.merchant_storefronts.insert_one({
                "vendor_id": vendor_id,
                "cover": "https://example.com/cover.jpg",
                "logo": "https://example.com/logo.png",
                "gallery": ["https://example.com/g1.jpg"],
                "bio": "should not appear",
            })

        async def cleanup():
            db = _make_client()
            await db.merchant_storefronts.delete_one({"vendor_id": vendor_id})

        _run(seed)
        try:
            r = requests.get(f"{API}/vendors/{vendor_id}/media", timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["vendor_id"] == vendor_id
            assert data["cover"] == "https://example.com/cover.jpg"
            assert data["logo"] == "https://example.com/logo.png"
            assert "gallery" not in data, f"gallery leaked: {data}"
            assert "bio" not in data
        finally:
            _run(cleanup)

    def test_media_missing_vendor_returns_null(self):
        vendor_id = f"TEST_missing_{uuid.uuid4().hex[:8]}"
        r = requests.get(f"{API}/vendors/{vendor_id}/media", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["vendor_id"] == vendor_id
        assert data["cover"] is None
        assert data["logo"] is None
        assert "gallery" not in data


# ---------------- 2/3. Taxi & delivery split ----------------
class TestDriverSplit:
    def _run_case(self, service_type, fare, driver_doc):
        oid = f"TEST_ord_{uuid.uuid4().hex[:8]}"

        async def do():
            import sys
            if "/app/backend" not in sys.path:
                sys.path.insert(0, "/app/backend")
            from server import _finalize_driver_split
            db = _make_client()
            await db.orders.insert_one({
                "id": oid,
                "service_type": service_type,
                "delivery_fee": fare,
                "tip": 0.0,
                "commission_amount": 0.0,
                "service_fee": 0.0,
            })
            await _finalize_driver_split(oid, driver_doc)
            doc = await db.orders.find_one({"id": oid}, {"_id": 0})
            await db.orders.delete_one({"id": oid})
            return doc

        return _run(do)

    # Taxi
    def test_taxi_standard_20(self):
        o = self._run_case("taxi", 100.0, {"user_id": "TEST_d", "subscription_tier": "standard"})
        assert o["driver_fee_rate"] == 0.20
        assert o["platform_delivery_portion"] == 20.0
        assert o["driver_delivery_portion"] == 80.0

    def test_taxi_pro_5(self):
        o = self._run_case("taxi", 100.0, {"user_id": "TEST_d", "subscription_tier": "pro"})
        assert o["driver_fee_rate"] == 0.05
        assert o["platform_delivery_portion"] == 5.0
        assert o["driver_delivery_portion"] == 95.0

    def test_taxi_premium_0(self):
        """Code pins premium taxi to 0% (per DRIVER_SUBSCRIPTION_PLANS)."""
        o = self._run_case("taxi", 100.0, {"user_id": "TEST_d", "subscription_tier": "premium"})
        assert o["driver_fee_rate"] == 0.0
        assert o["platform_delivery_portion"] == 0.0
        assert o["driver_delivery_portion"] == 100.0

    # Delivery unchanged
    def test_delivery_standard_20(self):
        o = self._run_case("food", 50.0, {"user_id": "TEST_d", "subscription_tier": "standard"})
        assert o["driver_fee_rate"] == 0.20
        assert o["platform_delivery_portion"] == 10.0
        assert o["driver_delivery_portion"] == 40.0

    def test_delivery_pro_10(self):
        o = self._run_case("grocery", 50.0, {"user_id": "TEST_d", "subscription_tier": "pro"})
        assert o["driver_fee_rate"] == 0.10
        assert o["platform_delivery_portion"] == 5.0
        assert o["driver_delivery_portion"] == 45.0

    def test_delivery_premium_0(self):
        o = self._run_case("pharmacy", 50.0, {"user_id": "TEST_d", "subscription_tier": "premium"})
        assert o["driver_fee_rate"] == 0.0
        assert o["platform_delivery_portion"] == 0.0
        assert o["driver_delivery_portion"] == 50.0


# ---------------- 4/5. subscription catalogues ----------------
class TestSubscriptionPlans:
    def test_driver_plans_expose_taxi_cut_pct(self):
        r = requests.get(f"{API}/driver/subscription/plans", timeout=15)
        assert r.status_code == 200, r.text
        plans = r.json()
        assert len(plans) == 3
        by = {p["tier"]: p for p in plans}
        assert by["standard"]["taxi_cut_pct"] == 20
        assert by["pro"]["taxi_cut_pct"] == 5
        assert by["premium"]["taxi_cut_pct"] == 0
        assert by["standard"]["driver_keep_pct"] == 80
        assert by["pro"]["driver_keep_pct"] == 90
        assert by["premium"]["driver_keep_pct"] == 100

    def test_merchant_plans_healthy(self):
        r = requests.get(f"{API}/merchant/subscription/plans", timeout=15)
        assert r.status_code == 200, r.text
        plans = r.json()
        assert len(plans) == 3
        by = {p["tier"]: p for p in plans}
        assert by["standard"]["commission_pct"] == 10
        assert by["pro"]["commission_pct"] == 5
        assert by["premium"]["commission_pct"] == 0

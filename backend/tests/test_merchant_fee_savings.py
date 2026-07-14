"""Tests for the Premium fee-savings ROI endpoint (GET /api/merchant/fee-savings)."""
import time
import uuid
import requests

from conftest import BASE_URL

from pymongo import MongoClient
import os


def _register(suffix):
    ts = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"{suffix}_{ts}@gmail.com"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": "Test1234!", "name": "FeeSave QA"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"], email


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _make_merchant(suffix):
    tok, email = _register(suffix)
    r = requests.post(f"{BASE_URL}/api/restaurants", headers=_hdr(tok),
                      json={"user_id": "x", "name": f"FeeSave {suffix}", "description": "d",
                            "cuisine_type": "Caribbean",
                            "address": {"street": "1", "city": "POS", "country": "TT"},
                            "phone": "+18685550100", "email": email}, timeout=30)
    assert r.status_code in (200, 201), r.text
    return tok, r.json()["id"]


def _set_tier(rid, tier):
    cli = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    cli[os.environ.get("DB_NAME", "test_database")].restaurants.update_one(
        {"id": rid}, {"$set": {"subscription_tier": tier, "status": "active"}})
    cli.close()


def _order(tok, rid, subtotal):
    body = {"restaurant_id": rid, "service_type": "food",
            "items": [{"menu_item_id": "i", "id": "i", "name": "Item", "price": subtotal, "quantity": 1}],
            "subtotal": subtotal, "delivery_fee": 10.0, "total": subtotal + 13.0,
            "delivery_address": {"street": "a", "city": "POS", "country": "TT"},
            "pickup_address": {"street": "a", "city": "POS", "country": "TT"},
            "customer_phone": "+18685550100", "payment_method": "cod"}
    r = requests.post(f"{BASE_URL}/api/orders/create", headers=_hdr(tok), json=body, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


def test_premium_merchant_sees_full_savings():
    tok, rid = _make_merchant("prem")
    _set_tier(rid, "premium")
    o = _order(tok, rid, 100.0)
    assert round(o.get("commission_amount"), 2) == 0.0  # premium pays 0%
    r = requests.get(f"{BASE_URL}/api/merchant/fee-savings", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["tier"] == "premium"
    assert d["commission_paid"] == 0.0
    assert d["standard_commission"] == 10.0   # 10% of 100
    assert d["saved"] == 10.0
    assert d["upgrade_tier"] is None
    assert d["potential_extra_savings"] == 0.0


def test_standard_merchant_sees_upgrade_upsell():
    tok, rid = _make_merchant("std")
    _set_tier(rid, "standard")
    _order(tok, rid, 200.0)
    r = requests.get(f"{BASE_URL}/api/merchant/fee-savings", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["tier"] == "standard"
    assert d["commission_paid"] == 20.0       # 10% of 200
    assert d["saved"] == 0.0                  # standard saves nothing vs itself
    assert d["upgrade_tier"] == "premium"
    assert d["potential_extra_savings"] == 20.0  # would save the full commission on premium


def test_non_merchant_gets_404():
    tok, _ = _register("cust")
    r = requests.get(f"{BASE_URL}/api/merchant/fee-savings", headers=_hdr(tok), timeout=30)
    assert r.status_code == 404, r.text

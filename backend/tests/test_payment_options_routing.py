"""Backend tests for dual payment-processor routing.

Covers GET /api/orders/{order_id}/payment-options routing between Stripe (US
merchants) and WiPay (Caribbean merchants), plus regression checks for the two
underlying session-creation endpoints:
  - POST /api/payments/wipay/checkout/session
  - POST /api/payments/checkout/session (Stripe)
"""
import os
import uuid
import time
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break


def _mongo():
    cfg = {}
    with open("/app/backend/.env") as fh:
        for line in fh:
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    client = MongoClient(cfg["MONGO_URL"], serverSelectionTimeoutMS=3000)
    return client, client[cfg["DB_NAME"]]


def _minimal_food_order(restaurant_id: str):
    return {
        "customer_id": "overridden",
        "service_type": "food",
        "restaurant_id": restaurant_id,
        "items": [{
            "menu_item_id": str(uuid.uuid4()),
            "name": "Pizza Slice",
            "price": 5.0,
            "quantity": 2,
        }],
        "subtotal": 10.0,
        "delivery_fee": 2.0,
        "tip": 0.0,
        "tax": 0.5,
        "total": 12.5,
        "pickup_address": {"street": "1 X", "city": "Kingston"},
        "delivery_address": {"street": "2 Y", "city": "Kingston"},
        "customer_phone": "555-0001",
        "payment_method": "card",
    }


def _seed_restaurant(db, country):
    """Insert a minimal restaurants doc with the given address.country."""
    rid = f"rest_qa_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": rid,
        "user_id": f"owner_{uuid.uuid4().hex[:6]}",
        "name": f"QA Restaurant {country or 'no-country'}",
        "cuisine_type": "test",
        "address": {"street": "1 QA Ln", "city": "Test City"},
        "phone": "555-1000",
        "email": f"qa_{uuid.uuid4().hex[:6]}@test.com",
        "status": "active",
    }
    if country is not None:
        doc["address"]["country"] = country
    db.restaurants.insert_one(doc)
    return rid


def _create_order(auth_headers, restaurant_id):
    r = requests.post(f"{BASE_URL}/api/orders",
                      json=_minimal_food_order(restaurant_id),
                      headers=auth_headers, timeout=20)
    assert r.status_code == 200, f"order create failed: {r.status_code} {r.text}"
    return r.json()["id"]


# --------------------- payment-options routing ---------------------

class TestPaymentOptionsRouting:

    def test_401_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/orders/anything/payment-options", timeout=15)
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"

    def test_404_unknown_order(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/orders/missing_{uuid.uuid4().hex}/payment-options",
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"

    def test_wipay_for_trinidad_merchant(self, auth_headers):
        client, db = _mongo()
        try:
            rid = _seed_restaurant(db, "Trinidad & Tobago")
            order_id = _create_order(auth_headers, rid)

            r = requests.get(
                f"{BASE_URL}/api/orders/{order_id}/payment-options",
                headers=auth_headers, timeout=15,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["processor"] == "wipay", body
            assert body["reason"] == "merchant_country", body
            assert body["cod_enabled"] is True
            assert body["wallet_enabled"] is True
            assert body["already_paid"] is False
            assert "wipay_environment" in body
        finally:
            client.close()

    @pytest.mark.parametrize("country", ["United States", "US", "USA",
                                         "united states of america"])
    def test_stripe_for_us_merchant(self, auth_headers, country):
        client, db = _mongo()
        try:
            rid = _seed_restaurant(db, country)
            order_id = _create_order(auth_headers, rid)

            r = requests.get(
                f"{BASE_URL}/api/orders/{order_id}/payment-options",
                headers=auth_headers, timeout=15,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["processor"] == "stripe", f"country={country} body={body}"
            assert body["reason"] == "merchant_country", body
            assert body["cod_enabled"] is True
            assert body["wallet_enabled"] is True
        finally:
            client.close()

    def test_default_wipay_when_no_country_set(self, auth_headers):
        """Merchant exists but address has no country field → falls back to WiPay
        (either via 'currency' if USD not signaled, or 'default')."""
        client, db = _mongo()
        try:
            rid = _seed_restaurant(db, None)  # no country in address
            order_id = _create_order(auth_headers, rid)

            r = requests.get(
                f"{BASE_URL}/api/orders/{order_id}/payment-options",
                headers=auth_headers, timeout=15,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["processor"] == "wipay", body
            # No currency stored on orders, so reason must be 'default'
            assert body["reason"] in ("default", "currency"), body
        finally:
            client.close()

    def test_wipay_for_other_caribbean_country(self, auth_headers):
        client, db = _mongo()
        try:
            rid = _seed_restaurant(db, "Jamaica")
            order_id = _create_order(auth_headers, rid)

            r = requests.get(
                f"{BASE_URL}/api/orders/{order_id}/payment-options",
                headers=auth_headers, timeout=15,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["processor"] == "wipay", body
            assert body["reason"] == "merchant_country", body
        finally:
            client.close()


# --------------------- Regression: session endpoints still work ---------------------

class TestSessionEndpointsRegression:

    def test_wipay_session_creates_url(self, auth_headers):
        client, db = _mongo()
        try:
            rid = _seed_restaurant(db, "Trinidad & Tobago")
            order_id = _create_order(auth_headers, rid)

            r = requests.post(
                f"{BASE_URL}/api/payments/wipay/checkout/session",
                json={"order_id": order_id, "origin_url": "https://example.com"},
                headers=auth_headers, timeout=30,
            )
            assert r.status_code == 200, f"wipay session failed: {r.status_code} {r.text}"
            body = r.json()
            assert "url" in body and body["url"].startswith("http")
            assert "transaction_id" in body
            assert body.get("environment") in ("sandbox", "live")
        finally:
            client.close()

    def test_stripe_session_creates_url(self, auth_headers):
        client, db = _mongo()
        try:
            rid = _seed_restaurant(db, "United States")
            order_id = _create_order(auth_headers, rid)

            r = requests.post(
                f"{BASE_URL}/api/payments/checkout/session",
                json={"order_id": order_id, "origin_url": "https://example.com"},
                headers=auth_headers, timeout=30,
            )
            assert r.status_code == 200, f"stripe session failed: {r.status_code} {r.text}"
            body = r.json()
            assert "url" in body and body["url"].startswith("http")
            assert "session_id" in body
        finally:
            client.close()


# --------------------- cleanup ---------------------

@pytest.fixture(scope="module", autouse=True)
def _cleanup_seeded_restaurants():
    yield
    try:
        client, db = _mongo()
        db.restaurants.delete_many({"id": {"$regex": r"^rest_qa_"}})
        client.close()
    except Exception as exc:
        print(f"[cleanup] restaurants purge skipped: {exc}")

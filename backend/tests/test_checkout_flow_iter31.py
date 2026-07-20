"""Iter 31 - P0 Checkout fix: order creation + checkout + COD payment flow.

Covers:
 - Auth: register fresh customer
 - POST /api/orders for food (restaurant) + grocery payloads -> returns order id
 - GET /api/orders/{id} returns the same order (used by CheckoutPage)
 - POST /api/orders/{id}/confirm-cod marks order paid (COD)
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-island.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def customer():
    email = f"qa_checkout_{int(time.time())}_{uuid.uuid4().hex[:6]}@gmail.com"
    payload = {"email": email, "password": "Test1234!", "name": "QA Checkout", "user_type": "customer"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no access_token in register response: {data}"
    return {"email": email, "token": token, "user": data.get("user", {})}


@pytest.fixture(scope="module")
def auth_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def restaurant_id():
    """Find an active restaurant to attach order to."""
    r = requests.get(f"{API}/restaurants", timeout=30)
    assert r.status_code == 200, f"list restaurants {r.status_code}"
    items = r.json()
    assert isinstance(items, list) and len(items) > 0, "no restaurants seeded"
    # Prefer 'island-spice' if available else first
    for it in items:
        if it.get("id") == "island-spice":
            return "island-spice"
    return items[0]["id"]


def test_register_customer(customer):
    assert customer["token"]
    assert "@" in customer["email"]


def test_create_food_order_returns_id(auth_headers, restaurant_id):
    payload = {
        "customer_id": "x",  # overwritten server-side
        "service_type": "food",
        "restaurant_id": restaurant_id,
        "items": [
            {"menu_item_id": "m1", "name": "Oxtail Dinner", "quantity": 1, "price": 65.0},
            {"menu_item_id": "m2", "name": "Curry Goat",   "quantity": 1, "price": 55.0},
        ],
        "subtotal": 120.0,
        "delivery_fee": 15.0,
        "total": 135.0,
        "pickup_address": {"street": "Restaurant", "city": "POS", "country": "TT"},
        "delivery_address": {"street": "123 QA Lane", "city": "Port of Spain", "country": "TT"},
        "customer_phone": "+18685550000",
        "payment_method": "cod",
    }
    r = requests.post(f"{API}/orders", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code in (200, 201), f"create food order {r.status_code} {r.text}"
    body = r.json()
    assert body.get("id"), f"missing id: {body}"
    assert body.get("service_type") == "food"
    # Persist for downstream
    pytest.food_order_id = body["id"]

    # GET to verify
    rg = requests.get(f"{API}/orders/{body['id']}", headers=auth_headers, timeout=30)
    assert rg.status_code == 200, f"get food order {rg.status_code} {rg.text}"
    g = rg.json()
    assert g["id"] == body["id"]
    assert g.get("total") is not None


def test_create_grocery_order_returns_id(auth_headers):
    payload = {
        "customer_id": "x",
        "service_type": "grocery",
        "store_id": "massy-stores-trincity",
        "items": [
            {"menu_item_id": "g1", "name": "Bread", "quantity": 2, "price": 12.0},
            {"menu_item_id": "g2", "name": "Milk",  "quantity": 1, "price": 18.0},
        ],
        "subtotal": 42.0,
        "delivery_fee": 18.0,
        "total": 60.0,
        "pickup_address": {"location": "Massy Stores", "full_address": "Trincity"},
        "delivery_address": {"street": "123 QA Lane", "city": "Port of Spain", "country": "TT"},
        "customer_phone": "+18685550000",
        "payment_method": "cod",
    }
    r = requests.post(f"{API}/orders", json=payload, headers=auth_headers, timeout=30)
    assert r.status_code in (200, 201), f"create grocery order {r.status_code} {r.text}"
    body = r.json()
    assert body.get("id"), body
    pytest.grocery_order_id = body["id"]


def test_create_order_requires_auth(restaurant_id):
    payload = {
        "customer_id": "x",
        "service_type": "food",
        "restaurant_id": restaurant_id,
        "items": [{"menu_item_id": "m1", "name": "Item", "quantity": 1, "price": 10.0}],
        "subtotal": 10.0, "delivery_fee": 5.0, "total": 15.0,
        "pickup_address": {"street": "r", "city": "y"},
        "delivery_address": {"street": "x", "city": "y"},
        "customer_phone": "+18680000000",
        "payment_method": "cod",
    }
    r = requests.post(f"{API}/orders", json=payload, timeout=30)
    assert r.status_code in (401, 403), f"expected unauth, got {r.status_code} {r.text[:200]}"


def test_confirm_cod_marks_paid(auth_headers):
    oid = getattr(pytest, "food_order_id", None)
    assert oid, "food order id not set"
    r = requests.post(f"{API}/orders/{oid}/confirm-cod", headers=auth_headers, timeout=30)
    assert r.status_code in (200, 201), f"confirm-cod {r.status_code} {r.text}"
    # Re-GET and check payment status flips
    rg = requests.get(f"{API}/orders/{oid}", headers=auth_headers, timeout=30)
    assert rg.status_code == 200
    body = rg.json()
    pstatus = (body.get("payment_status") or "").lower()
    assert pstatus in ("paid", "pending_cod", "cod_pending", "completed"), f"unexpected payment_status={pstatus} body={body}"

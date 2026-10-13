"""Tests for TT$ -> USD conversion on merchant orders, taxi exemption, and business search sort."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
TTD_PER_USD = 6.78
VENDOR_ID = "b0ca2f1d-d696-4e77-a606-f82b44c5d817"


@pytest.fixture(scope="module")
def customer_token():
    ts = int(time.time())
    email = f"px_{ts}@gmail.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Test1234!", "name": "PX",
        "role": "customer"
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    cust_id = (data.get("user") or {}).get("id") or data.get("id")
    assert tok, f"no token in response: {data}"
    return {"token": tok, "customer_id": cust_id, "email": email}


def auth_headers(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def test_storefront_returns_raw_ttd():
    r = requests.get(f"{API}/merchants/{VENDOR_ID}/storefront")
    assert r.status_code == 200, r.text
    data = r.json()
    # Look for menu items with raw TTD prices
    items_str = str(data)
    # Chicken Roti should be 45, Doubles 8, Sweet Drink 10
    print("storefront keys:", list(data.keys()) if isinstance(data, dict) else "list")
    assert "45" in items_str or 45 in [i.get("price") for i in (data.get("menu_items") or data.get("items") or [])]


def test_food_order_conversion(customer_token):
    tok = customer_token["token"]
    body = {
        "customer_id": customer_token["customer_id"] or "x",
        "service_type": "food",
        "restaurant_id": VENDOR_ID,
        "items": [{"menu_item_id": "1", "name": "Chicken Roti", "quantity": 1, "price": 45.0}],
        "subtotal": 45.0,
        "delivery_fee": 15.0,
        "tip": 0,
        "total": 60.0,
        "pickup_address": {"location": "Store"},
        "delivery_address": {"location": "Home", "full_address": "Home"},
        "customer_phone": "18680000000",
        "payment_method": "pending"
    }
    r = requests.post(f"{API}/orders", json=body, headers=auth_headers(tok))
    assert r.status_code in (200, 201), f"create order failed: {r.status_code} {r.text}"
    created = r.json()
    oid = created.get("id") or created.get("order_id") or (created.get("order") or {}).get("id")
    assert oid, f"no order id: {created}"

    r2 = requests.get(f"{API}/orders/{oid}", headers=auth_headers(tok))
    assert r2.status_code == 200, r2.text
    order = r2.json()
    print("stored order:", {k: order.get(k) for k in ("subtotal", "delivery_fee", "total", "items")})

    assert abs(order["subtotal"] - 45.0/TTD_PER_USD) < 0.05, f"subtotal not converted: {order['subtotal']}"
    assert abs(order["delivery_fee"] - 15.0/TTD_PER_USD) < 0.05, f"delivery_fee not converted: {order['delivery_fee']}"
    assert abs(order["items"][0]["price"] - 45.0/TTD_PER_USD) < 0.05, f"item price not converted: {order['items'][0]['price']}"
    # total should be subtotal + delivery + 3 service fee
    expected_total = 45.0/TTD_PER_USD + 15.0/TTD_PER_USD + 3.0
    assert abs(order["total"] - expected_total) < 0.2, f"total mismatch: {order['total']} vs {expected_total}"


def test_taxi_order_not_converted(customer_token):
    tok = customer_token["token"]
    body = {
        "customer_id": customer_token["customer_id"] or "x",
        "service_type": "taxi",
        "vendor_id": "standard",
        "items": [],
        "subtotal": 0,
        "delivery_fee": 10.0,
        "tip": 0,
        "total": 0,
        "pickup_address": {"location": "A", "latitude": 10.65, "longitude": -61.51},
        "delivery_address": {"location": "B", "latitude": 10.67, "longitude": -61.52},
        "customer_phone": "18680000000",
        "payment_method": "card"
    }
    r = requests.post(f"{API}/orders", json=body, headers=auth_headers(tok))
    assert r.status_code in (200, 201), f"taxi order create failed: {r.status_code} {r.text}"
    created = r.json()
    oid = created.get("id") or created.get("order_id") or (created.get("order") or {}).get("id")
    r2 = requests.get(f"{API}/orders/{oid}", headers=auth_headers(tok))
    assert r2.status_code == 200
    order = r2.json()
    df = order.get("delivery_fee", 0)
    print("taxi delivery_fee:", df)
    # Not equal to 10/6.78 ≈ 1.47 - must be USD (either 10 or recomputed fare, but definitely > 1.5)
    assert df > 1.5, f"taxi fee appears to have been divided: {df}"


def test_search_featured_sorts_test_names_last():
    r = requests.get(f"{API}/search/featured?limit=15")
    assert r.status_code == 200, r.text
    data = r.json()
    results = data if isinstance(data, list) else (data.get("results") or data.get("businesses") or data.get("data") or [])
    print("featured count:", len(results))
    def is_test_name(name):
        n = (name or "").lower()
        return any(w in n for w in ("test", "demo", "sample", " qa"))
    names = [r.get("name") or r.get("business_name") or "" for r in results]
    print("featured names:", names)
    # Find first test-named and last real-named
    first_test_idx = next((i for i, n in enumerate(names) if is_test_name(n)), None)
    last_real_idx = max((i for i, n in enumerate(names) if n and not is_test_name(n)), default=None)
    if first_test_idx is not None and last_real_idx is not None:
        assert first_test_idx > last_real_idx, f"test-named business at idx {first_test_idx} before last real at {last_real_idx}: {names}"


def test_search_diner_sorts_test_last():
    r = requests.get(f"{API}/search", params={"q": "diner"})
    assert r.status_code == 200, r.text
    data = r.json()
    results = data if isinstance(data, list) else (data.get("results") or data.get("businesses") or data.get("data") or [])
    def is_test_name(name):
        n = (name or "").lower()
        return any(w in n for w in ("test", "demo", "sample"))
    names = [r.get("name") or r.get("business_name") or "" for r in results]
    print("diner search names:", names)
    first_test_idx = next((i for i, n in enumerate(names) if is_test_name(n)), None)
    last_real_idx = max((i for i, n in enumerate(names) if n and not is_test_name(n)), default=None)
    if first_test_idx is not None and last_real_idx is not None:
        assert first_test_idx > last_real_idx, f"test-named business at idx {first_test_idx} before last real at {last_real_idx}: {names}"

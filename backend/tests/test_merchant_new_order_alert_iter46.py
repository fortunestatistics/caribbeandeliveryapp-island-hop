"""Iteration 46 — merchant new-order alert regression.

Covers the three backend fixes:
  1) GET /api/vendors/my-orders returns 200 (was 500 due to ObjectId) for both
     restaurant and business (grocery/pharmacy) merchants, and includes orders
     saved with either restaurant_id or vendor_id.
  2) GET /api/vendors/stats returns non-zero counts for business merchants
     (previously it only matched vendor_id).
  3) _notify_merchant_new_order sends via SMS — the whatsapp_messages record
     for event='merchant_new_order' has channel_used='sms'.
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path
from pymongo import MongoClient

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
assert BASE_URL, "REACT_APP_BACKEND_URL must be configured"


def _mongo():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    cfg = {}
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            cfg[k.strip()] = v.strip().strip('"').strip("'")
    client = MongoClient(cfg["MONGO_URL"])
    return client, client[cfg["DB_NAME"]]


def _register(email, password="Test1234!", name="QA", phone=None):
    payload = {"email": email, "password": password, "name": name}
    if phone:
        payload["phone"] = phone
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    return r


def _login(email, password="Test1234!"):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    return r


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def customer():
    email = f"alert_cust_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = _register(email, name="Alert Customer", phone="+18685550100")
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "token": body["access_token"], "user_id": body["user"]["id"]}


@pytest.fixture(scope="module")
def restaurant_merchant():
    """Register a customer then promote to restaurant via POST /api/restaurants."""
    email = f"alert_resto_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = _register(email, name="Alert Restaurant Owner")
    assert r.status_code == 200, r.text
    body = r.json()
    token = body["access_token"]
    uid = body["user"]["id"]
    # Create restaurant
    r2 = requests.post(f"{BASE_URL}/api/restaurants",
                       headers=_headers(token),
                       json={
                           "user_id": uid,
                           "name": "Alert Test Bistro",
                           "description": "QA restaurant",
                           "cuisine_type": "caribbean",
                           "address": {"street": "1 QA St", "city": "POS", "country": "TT"},
                           "phone": "+18685550111",
                           "email": email,
                       }, timeout=30)
    assert r2.status_code == 200, f"create resto: {r2.status_code} {r2.text}"
    resto = r2.json()
    # Re-login to refresh JWT with restaurant role
    r3 = _login(email)
    assert r3.status_code == 200, r3.text
    token = r3.json()["access_token"]
    return {"email": email, "token": token, "user_id": uid, "vendor_id": resto["id"]}


@pytest.fixture(scope="module")
def business_merchant():
    """Register a customer + insert a businesses doc (grocery) + flip user_type."""
    email = f"alert_biz_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = _register(email, name="Alert Grocer")
    assert r.status_code == 200, r.text
    uid = r.json()["user"]["id"]

    client, db = _mongo()
    biz_id = str(uuid.uuid4())
    db.businesses.insert_one({
        "id": biz_id,
        "user_id": uid,
        "business_name": f"Alert QA Mart {biz_id[:6]}",
        "business_type": "grocery",
        "business_description": "QA grocery for alert test",
        "phone": "+18685550222",
        "email": email,
        "address": {"street": "1 QA Rd", "city": "POS", "country": "TT"},
        "status": "active",
        "subscription_tier": "standard",
    })
    db.users.update_one({"id": uid}, {"$set": {"user_type": "business"}})
    client.close()

    r2 = _login(email)
    assert r2.status_code == 200, r2.text
    token = r2.json()["access_token"]
    return {"email": email, "token": token, "user_id": uid, "vendor_id": biz_id}


# ---------- Tests ----------

def test_my_orders_restaurant_empty_returns_200(restaurant_merchant):
    r = requests.get(f"{BASE_URL}/api/vendors/my-orders",
                     headers=_headers(restaurant_merchant["token"]), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)


def test_my_orders_business_empty_returns_200(business_merchant):
    """Regression: was 500 due to ObjectId. Also validates business branch exists."""
    r = requests.get(f"{BASE_URL}/api/vendors/my-orders",
                     headers=_headers(business_merchant["token"]), timeout=30)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def _place_order(customer_token, vendor_id):
    payload = {
        "customer_id": "will-be-overwritten",
        "customer_phone": "+18685550100",
        "restaurant_id": vendor_id,
        "service_type": "food",
        "items": [{"menu_item_id": "sku-1", "name": "QA Item", "price": 10.0, "quantity": 2}],
        "subtotal": 20.0,
        "delivery_fee": 3.0,
        "total": 23.0,
        "pickup_address": {"street": "Vendor St", "city": "POS", "country": "TT",
                            "location": "1 Vendor", "full_address": "1 Vendor POS"},
        "delivery_address": {"street": "Cust St", "city": "POS", "country": "TT",
                              "location": "1 Cust", "full_address": "1 Cust POS"},
        "payment_method": "cash",
    }
    return requests.post(f"{BASE_URL}/api/orders",
                         headers=_headers(customer_token), json=payload, timeout=30)


def test_business_merchant_sees_order_placed_by_customer(customer, business_merchant):
    """Storefront orders save restaurant_id — business merchant must see them
    (was zero before the $or fix)."""
    r = _place_order(customer["token"], business_merchant["vendor_id"])
    assert r.status_code == 200, r.text
    order_id = r.json()["id"]

    time.sleep(1.0)  # allow async fanout to settle

    r2 = requests.get(f"{BASE_URL}/api/vendors/my-orders",
                      headers=_headers(business_merchant["token"]), timeout=30)
    assert r2.status_code == 200, r2.text
    orders = r2.json()
    ids = [o.get("id") for o in orders]
    assert order_id in ids, f"business merchant did not see order {order_id}; got {ids}"


def test_restaurant_merchant_sees_order_placed_by_customer(customer, restaurant_merchant):
    r = _place_order(customer["token"], restaurant_merchant["vendor_id"])
    assert r.status_code == 200, r.text
    order_id = r.json()["id"]
    time.sleep(1.0)
    r2 = requests.get(f"{BASE_URL}/api/vendors/my-orders",
                      headers=_headers(restaurant_merchant["token"]), timeout=30)
    assert r2.status_code == 200, r2.text
    ids = [o.get("id") for o in r2.json()]
    assert order_id in ids


def test_vendor_stats_business_reflects_orders(business_merchant):
    r = requests.get(f"{BASE_URL}/api/vendors/stats",
                     headers=_headers(business_merchant["token"]), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # required keys
    for k in ("today_orders", "today_revenue", "pending_orders", "total_earnings"):
        assert k in data, f"missing key {k} in {data}"
    # After the previous test placed one order, today_orders should be >= 1
    assert data["today_orders"] >= 1, f"expected >=1 today_orders, got {data}"
    assert data["pending_orders"] >= 1, f"expected >=1 pending_orders, got {data}"


def test_vendor_stats_restaurant_reflects_orders(restaurant_merchant):
    r = requests.get(f"{BASE_URL}/api/vendors/stats",
                     headers=_headers(restaurant_merchant["token"]), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["today_orders"] >= 1


def test_merchant_new_order_alert_channel_is_sms(customer, business_merchant):
    """Place an order and assert a whatsapp_messages record exists with
    event='merchant_new_order' AND channel_used='sms'."""
    r = _place_order(customer["token"], business_merchant["vendor_id"])
    assert r.status_code == 200, r.text
    order_id = r.json()["id"]

    # background asyncio.create_task — poll up to ~10s
    client, db = _mongo()
    try:
        rec = None
        for _ in range(20):
            rec = db.whatsapp_messages.find_one({
                "order_id": order_id,
                "event": "merchant_new_order",
            })
            if rec:
                break
            time.sleep(0.5)
        assert rec is not None, f"no whatsapp_messages record for order {order_id}"
        assert rec.get("channel_used") == "sms", \
            f"channel_used expected 'sms', got {rec.get('channel_used')} — full rec: {rec}"
    finally:
        client.close()


def test_seeded_alert_test_mart_endpoints(customer):
    """Log in as the persisted grocery merchant and verify my-orders + stats work.

    If credentials are no longer valid in this env, skip (not a hard failure)."""
    r = _login("merch_1784954600@gmail.com", "Test1234!")
    if r.status_code != 200:
        pytest.skip(f"seeded grocery merchant login failed ({r.status_code}) — not present in this env")
    token = r.json()["access_token"]

    r1 = requests.get(f"{BASE_URL}/api/vendors/my-orders",
                      headers=_headers(token), timeout=30)
    assert r1.status_code == 200, r1.text
    orders = r1.json()
    assert isinstance(orders, list)
    # Should have >= 1 pending order per credentials.md
    assert len(orders) >= 1, "expected >=1 pending order for seeded Alert Test Mart"

    r2 = requests.get(f"{BASE_URL}/api/vendors/stats",
                      headers=_headers(token), timeout=30)
    assert r2.status_code == 200, r2.text

    r3 = requests.get(f"{BASE_URL}/api/merchant/profile",
                      headers=_headers(token), timeout=30)
    assert r3.status_code == 200, r3.text

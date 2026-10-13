"""
Iteration 60: dispatch edge cases (merchant<->driver bug follow-up)
Covers:
  - Two drivers racing to accept -> only one wins (other gets 400).
  - Driver who declined an order is NOT re-offered when going online again.
  - Accepting an already-assigned order returns 400.
  - Merchant marking an order 'ready' with no driver re-triggers dispatch
    (order.drivers_notified populated).
  - Coordinate tolerance: pickup_address with lat/lng (not latitude/longitude)
    is still dispatchable.
"""
import os, uuid, asyncio, pytest, pytest_asyncio, httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = "http://localhost:8001"
BASE = f"{API}/api"
MONGO = os.environ["MONGO_URL"]
DBNAME = os.environ["DB_NAME"]

pytestmark = pytest.mark.asyncio


async def _mkdriver(client, db, name_hint):
    ts = str(uuid.uuid4().int % 10**9)
    email = f"disp_{name_hint}_{ts}@gmail.com"
    r = await client.post(f"{BASE}/auth/register",
                          json={"email": email, "name": f"D {name_hint}", "password": "Test1234!"})
    j = r.json()
    tok = j["access_token"]; uid = j["user"]["id"]
    did = str(uuid.uuid4())
    await db.drivers.insert_one({"id": did, "user_id": uid, "status": "offline",
                                 "rating": 4.5, "vehicle_type": "car", "name": f"D {name_hint}"})
    await db.users.update_one({"id": uid}, {"$set": {"user_type": "driver"}})
    return {"email": email, "token": tok, "user_id": uid, "driver_id": did}


async def _mkorder(db, status="ready", pickup=None):
    oid = str(uuid.uuid4())
    doc = {
        "id": oid, "customer_id": str(uuid.uuid4()), "status": status,
        "driver_id": None, "service_type": "food", "total": 25.0,
        "created_at": "2026-07-27T00:00:00+00:00",
        "pickup_address": pickup or {"lat": 10.65, "lng": -61.51, "street": "Test", "city": "POS"},
        "delivery_address": {"lat": 10.66, "lng": -61.52},
    }
    await db.orders.insert_one(doc)
    return oid


@pytest_asyncio.fixture
async def env():
    db = AsyncIOMotorClient(MONGO)[DBNAME]
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        created = {"drivers": [], "orders": []}
        yield {"db": db, "client": c, "created": created}
        for d in created["drivers"]:
            await db.users.delete_one({"id": d["user_id"]})
            await db.drivers.delete_one({"id": d["driver_id"]})
        for oid in created["orders"]:
            await db.orders.delete_one({"id": oid})


async def test_race_only_one_driver_wins(env):
    db, c, created = env["db"], env["client"], env["created"]
    d1 = await _mkdriver(c, db, "race1"); created["drivers"].append(d1)
    d2 = await _mkdriver(c, db, "race2"); created["drivers"].append(d2)
    # Both online so both are notified
    for d in (d1, d2):
        await c.put(f"{BASE}/drivers/status",
                    headers={"Authorization": f"Bearer {d['token']}"}, json={"status": "online"})
    oid = await _mkorder(db); created["orders"].append(oid)
    # Both notified
    await db.orders.update_one({"id": oid},
                               {"$set": {"drivers_notified": [d1["driver_id"], d2["driver_id"]]}})

    async def accept(d):
        return await c.post(f"{BASE}/orders/{oid}/accept-driver",
                            headers={"Authorization": f"Bearer {d['token']}"},
                            json={"driver_id": d["driver_id"]})

    r1, r2 = await asyncio.gather(accept(d1), accept(d2))
    codes = sorted([r1.status_code, r2.status_code])
    assert codes == [200, 400], f"Expected one 200/one 400, got {codes} bodies={r1.text} | {r2.text}"

    # exactly one driver assigned, and it's one of the two
    o = await db.orders.find_one({"id": oid}, {"_id": 0, "driver_id": 1})
    assert o["driver_id"] in (d1["driver_id"], d2["driver_id"])


async def test_second_accept_on_assigned_order_returns_400(env):
    db, c, created = env["db"], env["client"], env["created"]
    d = await _mkdriver(c, db, "solo"); created["drivers"].append(d)
    other_driver_id = str(uuid.uuid4())
    oid = await _mkorder(db); created["orders"].append(oid)
    # Pre-assign to a different driver
    await db.orders.update_one({"id": oid}, {"$set": {"driver_id": other_driver_id}})
    r = await c.post(f"{BASE}/orders/{oid}/accept-driver",
                     headers={"Authorization": f"Bearer {d['token']}"},
                     json={"driver_id": d["driver_id"]})
    assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"


async def test_declined_driver_not_reoffered_on_go_online(env):
    db, c, created = env["db"], env["client"], env["created"]
    d = await _mkdriver(c, db, "decline"); created["drivers"].append(d)
    oid = await _mkorder(db); created["orders"].append(oid)
    # Simulate an earlier decline
    await db.orders.update_one({"id": oid},
                               {"$set": {"drivers_declined": [d["driver_id"]]}})
    # Go online -> triggers _offer_open_orders_to_driver
    r = await c.put(f"{BASE}/drivers/status",
                    headers={"Authorization": f"Bearer {d['token']}"}, json={"status": "online"})
    assert r.status_code == 200
    await asyncio.sleep(2.0)
    o = await db.orders.find_one({"id": oid}, {"_id": 0, "drivers_notified": 1})
    notified = o.get("drivers_notified") or []
    assert d["driver_id"] not in notified, \
        f"declined driver should not be re-offered, got notified={notified}"


async def test_coord_tolerance_latlng_key_names_dispatch(env):
    """pickup coords stored as lat/lng (not latitude/longitude) must still dispatch."""
    db, c, created = env["db"], env["client"], env["created"]
    d = await _mkdriver(c, db, "coord"); created["drivers"].append(d)
    oid = await _mkorder(db, pickup={"lat": 10.65, "lng": -61.51, "street": "X", "city": "POS"})
    created["orders"].append(oid)
    r = await c.put(f"{BASE}/drivers/status",
                    headers={"Authorization": f"Bearer {d['token']}"}, json={"status": "online"})
    assert r.status_code == 200
    await asyncio.sleep(2.0)
    o = await db.orders.find_one({"id": oid}, {"_id": 0, "drivers_notified": 1})
    assert d["driver_id"] in (o.get("drivers_notified") or []), \
        f"lat/lng pickup should have been dispatched, got {o}"


async def test_go_online_reoffers_and_order_requests_lists_it(env):
    db, c, created = env["db"], env["client"], env["created"]
    d = await _mkdriver(c, db, "reoffer"); created["drivers"].append(d)
    oid = await _mkorder(db); created["orders"].append(oid)
    r = await c.put(f"{BASE}/drivers/status",
                    headers={"Authorization": f"Bearer {d['token']}"}, json={"status": "online"})
    assert r.status_code == 200
    await asyncio.sleep(2.0)
    rr = await c.get(f"{BASE}/drivers/order-requests",
                     headers={"Authorization": f"Bearer {d['token']}"})
    assert rr.status_code == 200
    ids = [o.get("id") for o in rr.json()]
    assert oid in ids, f"expected {oid} in order-requests, got ids={ids[:10]}"


async def test_merchant_marking_ready_triggers_redispatch(env):
    """Merchant PUT /api/orders/{id}/status to 'preparing' or 'ready' on a
    driver-less order re-triggers dispatch (drivers_notified populated)."""
    db, c, created = env["db"], env["client"], env["created"]
    d = await _mkdriver(c, db, "merchready"); created["drivers"].append(d)
    # Driver is ONLINE and available first
    await c.put(f"{BASE}/drivers/status",
                headers={"Authorization": f"Bearer {d['token']}"}, json={"status": "online"})

    # Create a merchant-owned order in 'pending' with no driver.
    # We need the order attributable to a vendor whose user we can auth as.
    # Simplest path: seed a business & user, then hit update_order_status directly.
    ts = str(uuid.uuid4().int % 10**9)
    m_email = f"disp_merch_{ts}@gmail.com"
    reg = (await c.post(f"{BASE}/auth/register",
                        json={"email": m_email, "name": "Disp Merch", "password": "Test1234!"})).json()
    m_tok = reg["access_token"]; m_uid = reg["user"]["id"]
    await db.users.update_one({"id": m_uid}, {"$set": {"user_type": "merchant"}})
    biz_id = str(uuid.uuid4())
    await db.businesses.insert_one({"id": biz_id, "user_id": m_uid, "name": "Disp Test Biz",
                                    "business_type": "food", "status": "active",
                                    "location": {"lat": 10.65, "lng": -61.51}})
    oid = str(uuid.uuid4())
    await db.orders.insert_one({
        "id": oid, "customer_id": str(uuid.uuid4()), "status": "pending",
        "driver_id": None, "service_type": "food", "total": 20.0,
        "vendor_id": biz_id, "business_id": biz_id, "vendor_user_id": m_uid,
        "created_at": "2026-07-27T00:00:00+00:00",
        "pickup_address": {"lat": 10.65, "lng": -61.51},
        "delivery_address": {"lat": 10.66, "lng": -61.52},
    })
    created["orders"].append(oid)
    try:
        # Merchant marks order 'ready' (endpoint uses query param `status`).
        r = await c.put(f"{BASE}/orders/{oid}/status",
                        headers={"Authorization": f"Bearer {m_tok}"},
                        params={"status": "ready"})
        assert r.status_code in (200, 201), f"status update failed: {r.status_code} {r.text}"
        await asyncio.sleep(2.0)
        o = await db.orders.find_one({"id": oid}, {"_id": 0, "drivers_notified": 1, "status": 1})
        assert o.get("status") == "ready"
        assert d["driver_id"] in (o.get("drivers_notified") or []), \
            f"merchant marking ready should re-dispatch, got {o}"
    finally:
        await db.businesses.delete_one({"id": biz_id})
        await db.users.delete_one({"id": m_uid})

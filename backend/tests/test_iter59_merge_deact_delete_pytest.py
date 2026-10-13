"""Iter59: pytest wrapper for merge/deactivate/delete admin flows against public URL."""
import os, uuid, pytest, httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
load_dotenv('/app/frontend/.env')

BASE = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/api'
MONGO = os.environ['MONGO_URL']; DB = os.environ['DB_NAME']
ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = httpx.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="function")
def db():
    return AsyncIOMotorClient(MONGO)[DB]


@pytest.mark.asyncio
async def test_merge_deactivate_delete_full_flow(admin_token, db):
    H = {"Authorization": f"Bearer {admin_token}"}
    async with httpx.AsyncClient(base_url=BASE, timeout=30, follow_redirects=True) as c:
        ts = str(int(uuid.uuid4().int % 1e9))
        ea = f"TEST_mergeA_{ts}@gmail.com"
        eb = f"TEST_mergeB_{ts}@gmail.com"
        # Use a separate client for register so their session cookies don't override admin auth
        async with httpx.AsyncClient(base_url=BASE, timeout=30) as anon:
            ra = (await anon.post("/auth/register", json={"email": ea, "name": "Merge A", "password": "Test1234!"})).json()
            rb = (await anon.post("/auth/register", json={"email": eb, "name": "Merge B", "password": "Test1234!"})).json()
        c.cookies.clear()
        pid, sid = ra["user"]["id"], rb["user"]["id"]

        vid = f"biz_test_{ts}"
        await db.businesses.insert_one({
            "id": vid, "user_id": sid, "business_name": "TESTMergeMart",
            "business_type": "grocery", "status": "active",
            "address": {"country": "Trinidad & Tobago"}
        })
        await db.users.update_one({"id": sid}, {"$set": {"user_type": "business"}})

        # MERGE
        r = await c.post("/admin/accounts/merge", headers=H,
                         json={"primary_user_id": pid, "secondary_user_id": sid})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "business" in body.get("available_roles", [])
        assert "customer" in body.get("available_roles", [])
        assert await db.users.find_one({"id": sid}) is None
        biz = await db.businesses.find_one({"id": vid})
        assert biz["user_id"] == pid

        # DEACTIVATE non-owner
        r = await c.post(f"/admin/users/{pid}/deactivate", headers=H)
        assert r.status_code == 200
        assert r.json().get("status") == "disabled"
        # login after deactivate — use fresh client to avoid stale admin cookies
        async with httpx.AsyncClient(base_url=BASE, timeout=30) as anon:
            lg = await anon.post("/auth/login", json={"email": ea, "password": "Test1234!"})
            assert lg.status_code == 403

        # REPAIR reactivates
        rr = await c.post("/admin/accounts/repair", headers=H, json={"user_id": pid})
        assert rr.status_code == 200
        async with httpx.AsyncClient(base_url=BASE, timeout=30) as anon:
            lg2 = await anon.post("/auth/login", json={"email": ea, "password": "Test1234!"})
            assert lg2.status_code == 200

        # DELETE BUSINESS demotes owner
        r = await c.delete(f"/admin/merchants/{vid}", headers=H)
        assert r.status_code == 200
        assert r.json().get("demoted_owner") is True
        assert await db.businesses.find_one({"id": vid}) is None
        u = await db.users.find_one({"id": pid})
        assert u["user_type"] == "customer"

        # PROTECT owner
        ow = await db.users.find_one({"is_owner": True})
        r = await c.post(f"/admin/users/{ow['id']}/deactivate", headers=H)
        assert r.status_code == 403

        # cleanup
        await db.users.delete_many({"id": {"$in": [pid, sid]}})
        await db.businesses.delete_many({"id": vid})


@pytest.mark.asyncio
async def test_owner_cannot_be_merged(admin_token, db):
    H = {"Authorization": f"Bearer {admin_token}"}
    ow = await db.users.find_one({"is_owner": True})
    ts = str(int(uuid.uuid4().int % 1e9))
    ea = f"TEST_ownermerge_{ts}@gmail.com"
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        ra = (await c.post("/auth/register", json={"email": ea, "name": "M", "password": "Test1234!"})).json()
        pid = ra["user"]["id"]
        # merging owner as secondary should be blocked
        r = await c.post("/admin/accounts/merge", headers=H,
                         json={"primary_user_id": pid, "secondary_user_id": ow["id"]})
        assert r.status_code in (400, 403), r.text
        await db.users.delete_one({"id": pid})

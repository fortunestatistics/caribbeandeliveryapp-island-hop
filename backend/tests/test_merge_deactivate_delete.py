import os, asyncio, uuid, httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

API = "http://localhost:8001"
BASE = f"{API}/api"
MONGO = os.environ['MONGO_URL']; DB = os.environ['DB_NAME']

async def main():
    db = AsyncIOMotorClient(MONGO)[DB]
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        tok = (await c.post(f"{BASE}/auth/login", json={"email":"tracyfortune@islandhoptt.com","password":"IslandHopAdmin2026!"})).json()["access_token"]
        H = {"Authorization": f"Bearer {tok}"}
        ts = str(int(uuid.uuid4().int % 1e9))
        # two throwaway customers
        ea, eb = f"mergeA_{ts}@gmail.com", f"mergeB_{ts}@gmail.com"
        ra = (await c.post(f"{BASE}/auth/register", json={"email":ea,"name":"Merge A","password":"Test1234!"})).json()
        rb = (await c.post(f"{BASE}/auth/register", json={"email":eb,"name":"Merge B","password":"Test1234!"})).json()
        pid, sid = ra["user"]["id"], rb["user"]["id"]
        # give B a business record
        vid = str(uuid.uuid4())
        await db.businesses.insert_one({"id": vid, "user_id": sid, "business_name":"MergeMart","business_type":"grocery","status":"active","address":{"country":"Trinidad & Tobago"}})
        await db.users.update_one({"id": sid}, {"$set": {"user_type":"business"}})

        print("=== MERGE B(business) -> A(customer) ===")
        r = await c.post(f"{BASE}/admin/accounts/merge", headers=H, json={"primary_user_id":pid,"secondary_user_id":sid})
        print("status", r.status_code, r.json().get("available_roles"), r.json().get("actions"))
        a_after = await db.users.find_one({"id": pid}, {"_id":0,"user_type":1})
        biz_after = await db.businesses.find_one({"id": vid}, {"_id":0,"user_id":1})
        b_gone = await db.users.find_one({"id": sid})
        print("primary user_type:", a_after.get("user_type"), "| business.user_id==primary:", biz_after.get("user_id")==pid, "| secondary deleted:", b_gone is None)

        print("=== DEACTIVATE primary then login blocked ===")
        r = await c.post(f"{BASE}/admin/users/{pid}/deactivate", headers=H)
        print("deactivate:", r.status_code, r.json())
        lg = await c.post(f"{BASE}/auth/login", json={"email":ea,"password":"Test1234!"})
        print("login after deactivate (expect 403):", lg.status_code)
        # reactivate via repair
        rr = await c.post(f"{BASE}/admin/accounts/repair", headers=H, json={"user_id":pid})
        print("repair actions:", rr.json().get("actions"))
        lg2 = await c.post(f"{BASE}/auth/login", json={"email":ea,"password":"Test1234!"})
        print("login after repair (expect 200):", lg2.status_code)

        print("=== DELETE business ===")
        r = await c.delete(f"{BASE}/admin/merchants/{vid}", headers=H)
        print("delete business:", r.status_code, r.json())
        gone = await db.businesses.find_one({"id": vid})
        owner = await db.users.find_one({"id": pid}, {"_id":0,"user_type":1})
        print("business gone:", gone is None, "| owner demoted to customer:", owner.get("user_type"))

        print("=== protect owner ===")
        ow = await db.users.find_one({"is_owner": True}, {"_id":0,"id":1})
        r = await c.post(f"{BASE}/admin/users/{ow['id']}/deactivate", headers=H)
        print("deactivate owner (expect 403):", r.status_code)

        # cleanup
        await db.users.delete_many({"id": {"$in":[pid,sid]}})
        await db.businesses.delete_many({"id": vid})
        print("cleanup done")

asyncio.run(main())

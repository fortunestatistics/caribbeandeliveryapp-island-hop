import os, asyncio, uuid, httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
API="http://localhost:8001"; BASE=f"{API}/api"
MONGO=os.environ['MONGO_URL']; DB=os.environ['DB_NAME']

async def main():
    db=AsyncIOMotorClient(MONGO)[DB]
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        tok=(await c.post(f"{BASE}/auth/login",json={"email":"tracyfortune@islandhoptt.com","password":"IslandHopAdmin2026!"})).json()["access_token"]
        H={"Authorization":f"Bearer {tok}"}
        ts=str(int(uuid.uuid4().int%1e9))
        pid=(await c.post(f"{BASE}/auth/register",json={"email":f"pv_a_{ts}@gmail.com","name":"PV A","password":"Test1234!"})).json()["user"]["id"]
        sid=(await c.post(f"{BASE}/auth/register",json={"email":f"pv_b_{ts}@gmail.com","name":"PV B","password":"Test1234!"})).json()["user"]["id"]
        # give B a driver record + an order
        did=str(uuid.uuid4())
        await db.drivers.insert_one({"id":did,"user_id":sid,"status":"active","vehicle_type":"car"})
        await db.users.update_one({"id":sid},{"$set":{"user_type":"driver"}})
        await db.orders.insert_one({"id":str(uuid.uuid4()),"customer_id":sid,"status":"delivered"})

        print("=== MERGE PREVIEW (B into A) ===")
        pv=(await c.get(f"{BASE}/admin/accounts/merge-preview",headers=H,params={"primary_user_id":pid,"secondary_user_id":sid})).json()
        print("driver:", bool(pv["moves"]["driver"]), "| orders:", pv["moves"]["orders"], "| resulting_roles:", pv["resulting_roles"])

        print("=== BULK DEACTIVATE [A,B,owner] ===")
        ow=(await db.users.find_one({"is_owner":True},{"_id":0,"id":1}))["id"]
        r=(await c.post(f"{BASE}/admin/users/bulk-deactivate",headers=H,json={"user_ids":[pid,sid,ow]})).json()
        print("deactivated:", len(r["deactivated"]), "| skipped:", [s.get("reason") for s in r["skipped"]])
        print("A status:", (await db.users.find_one({"id":pid}))["status"], "| owner still active:", (await db.users.find_one({"id":ow})).get("status") not in ("disabled",))

        print("=== DELETE BUSINESS with reason (email path) ===")
        # make A a business owner with real-ish email
        vid=str(uuid.uuid4())
        await db.businesses.insert_one({"id":vid,"user_id":pid,"business_name":"PVMart","business_type":"grocery","status":"active"})
        await db.users.update_one({"id":pid},{"$set":{"user_type":"business","status":"active"}})
        dr=(await c.request("DELETE",f"{BASE}/admin/merchants/{vid}",headers=H,params={"reason":"Test closure"})).json()
        print("deleted:", dr.get("success"), "| demoted:", dr.get("demoted_owner"), "| emailed:", dr.get("emailed"))

        await db.users.delete_many({"id":{"$in":[pid,sid]}})
        await db.drivers.delete_many({"id":did})
        await db.businesses.delete_many({"id":vid})
        await db.orders.delete_many({"customer_id":sid})
        await db.account_merges.delete_many({"secondary_id":sid})
        print("cleanup done")

asyncio.run(main())

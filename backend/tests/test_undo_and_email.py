import os, asyncio, uuid, httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
API = "http://localhost:8001"; BASE=f"{API}/api"
MONGO=os.environ['MONGO_URL']; DB=os.environ['DB_NAME']

async def main():
    db = AsyncIOMotorClient(MONGO)[DB]
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        tok=(await c.post(f"{BASE}/auth/login",json={"email":"tracyfortune@islandhoptt.com","password":"IslandHopAdmin2026!"})).json()["access_token"]
        H={"Authorization":f"Bearer {tok}"}
        ts=str(int(uuid.uuid4().int%1e9))
        ea,eb=f"undoA_{ts}@gmail.com",f"undoB_{ts}@gmail.com"
        pid=(await c.post(f"{BASE}/auth/register",json={"email":ea,"name":"Undo A","password":"Test1234!"})).json()["user"]["id"]
        sid=(await c.post(f"{BASE}/auth/register",json={"email":eb,"name":"Undo B","password":"Test1234!"})).json()["user"]["id"]
        vid=str(uuid.uuid4())
        await db.businesses.insert_one({"id":vid,"user_id":sid,"business_name":"UndoMart","business_type":"grocery","status":"active"})
        await db.users.update_one({"id":sid},{"$set":{"user_type":"business"}})

        print("=== MERGE B->A ===")
        r=(await c.post(f"{BASE}/admin/accounts/merge",headers=H,json={"primary_user_id":pid,"secondary_user_id":sid})).json()
        mid=r.get("merge_id"); print("merge_id:",bool(mid),"roles:",r.get("available_roles"))
        print("business now on primary:", (await db.businesses.find_one({"id":vid}))["user_id"]==pid, "| secondary deleted:", (await db.users.find_one({"id":sid})) is None)

        print("=== recent-merges lists it ===")
        rm=(await c.get(f"{BASE}/admin/accounts/recent-merges",headers=H)).json()
        print("listed:", any(m["id"]==mid for m in rm.get("merges",[])))

        print("=== UNDO merge ===")
        u=(await c.post(f"{BASE}/admin/accounts/merge/{mid}/undo",headers=H)).json()
        print("undo:", u.get("success"), "restored_records:", u.get("restored_records"))
        print("secondary restored:", (await db.users.find_one({"id":sid})) is not None,
              "| business back on secondary:", (await db.businesses.find_one({"id":vid}))["user_id"]==sid)
        print("primary demoted:", (await db.users.find_one({"id":pid}))["user_type"])
        print("=== double-undo blocked ===")
        u2=await c.post(f"{BASE}/admin/accounts/merge/{mid}/undo",headers=H)
        print("second undo status (expect 400):", u2.status_code)

        print("=== RESET EMAIL to non-real email (expect emailed False) ===")
        re=(await c.put(f"{BASE}/admin/users/{pid}/password",headers=H,json={"generate":True,"send_email":True})).json()
        print("emailed:", re.get("emailed"), "| email_error:", re.get("email_error"))

        # cleanup
        await db.users.delete_many({"id":{"$in":[pid,sid]}})
        await db.businesses.delete_many({"id":vid})
        await db.account_merges.delete_many({"id":mid})
        print("cleanup done")

asyncio.run(main())

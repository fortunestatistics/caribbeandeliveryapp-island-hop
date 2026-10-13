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
        # existing account with a DIFFERENT email than the application
        real_email=f"realmerchant_{ts}@gmail.com"
        uid=(await c.post(f"{BASE}/auth/register",json={"email":real_email,"name":"Real Merchant","password":"Test1234!"})).json()["user"]["id"]
        # approved application with NO user_id and an unmatched email
        appid=str(uuid.uuid4())
        await db.business_applications.insert_one({
            "id":appid, "verification_status":"approved",
            "business_name":"Webnest Test LLC",
            "email":f"nomatch_{ts}@hotmail.com",
            "business_details":{"business_type":"grocery","business_description":"Test"},
            "business_owner":{"name":"Brent","email":f"nomatch_{ts}@hotmail.com"},
        })

        print("=== provision with WRONG email (expect 404) ===")
        r=await c.post(f"{BASE}/admin/accounts/repair",headers=H,json={"application_id":appid,"email":f"nomatch_{ts}@hotmail.com"})
        print("status:", r.status_code, "|", r.json().get("detail","")[:60])

        print("=== LINK to existing account by user_id + provision ===")
        r=await c.post(f"{BASE}/admin/accounts/repair",headers=H,json={"application_id":appid,"link_user_id":uid})
        j=r.json(); print("status:", r.status_code, "| actions:", j.get("actions"), "| url:", j.get("storefront_url"))
        biz=await db.businesses.find_one({"user_id":uid},{"_id":0,"business_name":1})
        appd=await db.business_applications.find_one({"id":appid},{"_id":0,"user_id":1})
        usr=await db.users.find_one({"id":uid},{"_id":0,"user_type":1})
        print("vendor created:", bool(biz), biz, "| app linked to uid:", appd.get("user_id")==uid, "| role:", usr.get("user_type"))

        # cleanup
        await db.users.delete_one({"id":uid})
        await db.businesses.delete_many({"user_id":uid})
        await db.business_applications.delete_one({"id":appid})
        print("cleanup done")

asyncio.run(main())

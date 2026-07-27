import os, asyncio, uuid, httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
API="http://localhost:8001"; BASE=f"{API}/api"
MONGO=os.environ['MONGO_URL']; DB=os.environ['DB_NAME']

async def main():
    db=AsyncIOMotorClient(MONGO)[DB]
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        ts=str(int(uuid.uuid4().int%1e9))
        # driver account
        demail=f"disp_drv_{ts}@gmail.com"
        reg=(await c.post(f"{BASE}/auth/register",json={"email":demail,"name":"Dispatch Driver","password":"Test1234!"})).json()
        dtok=reg["access_token"]; duid=reg["user"]["id"]
        DH={"Authorization":f"Bearer {dtok}"}
        # approved driver doc, ONLINE, NO current_location (the bug scenario)
        did=str(uuid.uuid4())
        await db.drivers.insert_one({"id":did,"user_id":duid,"status":"offline","rating":4.5,
                                     "vehicle_type":"car","name":"Dispatch Driver"})
        await db.users.update_one({"id":duid},{"$set":{"user_type":"driver"}})
        # a ready order awaiting a driver, pickup coords stored as lat/lng (mismatched key format)
        oid=str(uuid.uuid4())
        await db.orders.insert_one({
            "id":oid,"customer_id":str(uuid.uuid4()),"status":"ready","driver_id":None,
            "service_type":"food","total":25.0,"created_at":"2026-07-27T00:00:00+00:00",
            "pickup_address":{"lat":10.65,"lng":-61.51,"street":"Test St","city":"POS"},
            "delivery_address":{"lat":10.66,"lng":-61.52},
        })

        print("=== driver goes ONLINE (should trigger re-offer of open orders) ===")
        r=await c.put(f"{BASE}/drivers/status",headers=DH,json={"status":"online"})
        print("go-online:", r.status_code, r.json())
        await asyncio.sleep(2.0)  # let the fire-and-forget offer task run

        od=await db.orders.find_one({"id":oid},{"_id":0,"drivers_notified":1})
        print("order.drivers_notified includes driver:", did in (od.get("drivers_notified") or []))

        print("=== driver order-requests (ready order should appear) ===")
        rr=(await c.get(f"{BASE}/drivers/order-requests",headers=DH)).json()
        ids=[o.get("id") for o in rr]
        print("order in requests:", oid in ids, "| count:", len(rr))

        print("=== driver accepts ===")
        ac=await c.post(f"{BASE}/orders/{oid}/accept-driver",headers=DH,json={"driver_id":did})
        print("accept:", ac.status_code, ac.json())
        assigned=(await db.orders.find_one({"id":oid},{"_id":0,"driver_id":1})).get("driver_id")
        print("order.driver_id == driver:", assigned==did)

        # cleanup
        await db.users.delete_one({"id":duid})
        await db.drivers.delete_one({"id":did})
        await db.orders.delete_one({"id":oid})
        print("cleanup done")

asyncio.run(main())

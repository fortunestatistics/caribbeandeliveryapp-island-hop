import asyncio, os, uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()

    # Seed a customer + order so fraud hydration populates
    cust_id = "seed-fraud-customer"
    order_id = "seed-fraud-order"
    await db.users.update_one({"id": cust_id}, {"$set": {
        "id": cust_id, "name": "QA Fraud Customer", "email": "qa.fraud@test.com",
        "phone_verified": False, "user_type": "customer", "created_at": now,
    }}, upsert=True)
    await db.orders.update_one({"id": order_id}, {"$set": {
        "id": order_id, "service_type": "food", "total": 640.0, "status": "pending",
        "payment_method": "cash", "payment_status": "pending", "created_at": now,
        "customer_id": cust_id,
    }}, upsert=True)

    # Seed an open fraud flag
    await db.fraud_flags.update_one({"id": "seed-fraud-flag"}, {"$set": {
        "id": "seed-fraud-flag", "order_id": order_id, "customer_id": cust_id,
        "status": "open", "severity": "high", "amount": 640.0,
        "signals": ["high_value", "new_account", "cod_high_value"], "created_at": now,
    }}, upsert=True)

    # Seed an open claim (support_ticket, category=claim) with a proof photo
    await db.support_tickets.update_one({"id": "seed-claim-ticket"}, {"$set": {
        "id": "seed-claim-ticket", "category": "claim", "status": "open",
        "subject": "Order arrived damaged", "claim_type": "damaged_item",
        "description": "Two of the three jerk chicken meals were spilled and the containers were crushed on arrival. Requesting a refund or credit.",
        "order_id": order_id, "customer_id": cust_id, "customer_email": "qa.fraud@test.com",
        "photo_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600",
        "created_at": now,
    }}, upsert=True)

    print("Seeded: 1 open fraud flag (seed-fraud-flag), 1 open claim (seed-claim-ticket)")
    client.close()

asyncio.run(main())

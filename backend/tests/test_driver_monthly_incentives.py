"""Tests for monthly driver-excellence incentives (multi-area + tiered payout).

Seeds data with a fresh Motor client (own loop) and verifies through the
admin HTTP endpoints (server process), avoiding shared event-loop issues.
"""
import os
import sys
import uuid
import asyncio
import requests

import pytest

from conftest import BASE_URL

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402 (loads dotenv → MONGO_URL/DB_NAME)

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

TEST_MONTH = "2099-12"
MONTH_TS = "2099-12-15T12:00:00+00:00"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")


def _fresh_db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client, client[os.environ["DB_NAME"]]


async def _seed(driver_id, user_id):
    client, db = _fresh_db()
    try:
        # Pre-clean any leftover data for this synthetic month (own unique timestamp).
        await db.ratings.delete_many({"created_at": MONTH_TS})
        await db.orders.delete_many({"delivered_at": MONTH_TS})
        await db.driver_incentives.delete_many({"period": TEST_MONTH})
        await db.users.insert_one({"id": user_id, "name": "Star Driver", "email": f"{user_id}@gmail.com"})
        await db.drivers.insert_one({"id": driver_id, "user_id": user_id, "name": "Star Driver"})
        for _ in range(10):
            await db.ratings.insert_one({
                "id": str(uuid.uuid4()), "order_id": str(uuid.uuid4()),
                "customer_id": str(uuid.uuid4()), "driver_id": driver_id,
                "driver_rating": 5, "delivery_speed": 5, "driver_professionalism": 5,
                "driver_care": 5, "driver_communication": 5, "created_at": MONTH_TS,
            })
        for _ in range(20):
            await db.orders.insert_one({
                "id": str(uuid.uuid4()), "driver_id": driver_id,
                "status": "delivered", "delivered_at": MONTH_TS,
            })
    finally:
        client.close()


async def _cleanup(driver_id, user_id):
    client, db = _fresh_db()
    try:
        await db.ratings.delete_many({"driver_id": driver_id})
        await db.orders.delete_many({"driver_id": driver_id})
        await db.drivers.delete_one({"id": driver_id})
        await db.users.delete_one({"id": user_id})
        await db.driver_incentives.delete_many({"period": TEST_MONTH})
        await db.wallets.delete_many({"user_id": user_id})
    finally:
        client.close()


def _admin_hdr():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.skipif(not (ADMIN_EMAIL and ADMIN_PASSWORD), reason="admin creds not set")
def test_monthly_leaderboard_and_payout():
    driver_id = f"drv_{uuid.uuid4().hex[:8]}"
    user_id = f"usr_{uuid.uuid4().hex[:8]}"
    try:
        asyncio.run(_seed(driver_id, user_id))
        hdr = _admin_hdr()

        # Leaderboard via HTTP
        board = requests.get(f"{BASE_URL}/api/admin/driver-incentives/leaderboard",
                             headers=hdr, params={"month": TEST_MONTH}, timeout=30).json()
        mine = next((d for d in board["drivers"] if d["driver_id"] == driver_id), None)
        assert mine is not None, "seeded driver missing from leaderboard"
        assert mine["qualified"] is True
        assert mine["rank"] == 1
        assert mine["composite"] == 5.0
        assert mine["deliveries"] == 20
        assert mine["ratings_count"] == 10
        assert mine["areas"]["professionalism"] == 5.0

        # Payout
        data = requests.post(f"{BASE_URL}/api/admin/driver-incentives/run-monthly",
                             headers=hdr, json={"month": TEST_MONTH}, timeout=60).json()
        assert data["success"] is True, data
        awarded = {a["driver_id"]: a for a in data["awarded"]}
        assert driver_id in awarded
        assert awarded[driver_id]["rank"] == 1
        assert awarded[driver_id]["amount"] == 200.0
        assert awarded[driver_id]["currency"] == "USD"

        # Idempotency
        again = requests.post(f"{BASE_URL}/api/admin/driver-incentives/run-monthly",
                              headers=hdr, json={"month": TEST_MONTH}, timeout=60).json()
        assert again.get("already_awarded") is True
    finally:
        asyncio.run(_cleanup(driver_id, user_id))


def test_leaderboard_requires_admin():
    email = f"nd_{uuid.uuid4().hex[:6]}@gmail.com"
    tok = requests.post(f"{BASE_URL}/api/auth/register",
                        json={"email": email, "password": "Test1234!", "name": "X"}, timeout=30).json()["access_token"]
    r = requests.get(f"{BASE_URL}/api/admin/driver-incentives/leaderboard",
                     headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert r.status_code == 403, r.text

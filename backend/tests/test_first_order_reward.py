import asyncio, uuid, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server


async def main():
    db = server.db
    suffix = uuid.uuid4().hex[:8]
    promoter_id = f"promo_{suffix}"
    driver_user_id = f"drvuser_{suffix}"
    driver_id = f"drv_{suffix}"

    # eligible promoter (admin)
    await db.users.insert_one({"id": promoter_id, "email": f"promo_{suffix}@test.com", "name": "Promoter P",
                               "user_type": "admin", "created_at": "2026-01-01T00:00:00+00:00"})
    # referred driver user
    await db.users.insert_one({"id": driver_user_id, "email": f"drv_{suffix}@test.com", "name": "Driver D",
                               "user_type": "driver", "referred_by": promoter_id,
                               "created_at": "2026-06-01T00:00:00+00:00"})
    await db.drivers.insert_one({"id": driver_id, "user_id": driver_user_id, "status": "active"})

    results = {}

    # 1) award as pending_first_order
    await server._award_promo_reward(driver_user_id, "driver", "driver_approved", require_first_order=True)
    r = await db.promo_rewards.find_one({"referred_user_id": driver_user_id}, {"_id": 0})
    results["1_created_status"] = r and r.get("status")
    results["1_has_signup_date"] = bool(r and r.get("signup_date"))
    results["1_first_order_at"] = r and r.get("first_order_at")
    results["1_entity_type"] = r and r.get("referred_entity_type")

    # wallet should NOT be credited yet
    w = await db.wallets.find_one({"user_id": promoter_id}, {"_id": 0})
    results["2_wallet_before"] = (w or {}).get("balances") or (w or {}).get("balance") if w else None

    # 2) driver completes first order -> settle
    order = {"id": f"ord_{suffix}", "driver_id": driver_id, "customer_id": "c1", "status": "delivered"}
    await server._settle_partner_first_order_rewards(order)
    r2 = await db.promo_rewards.find_one({"referred_user_id": driver_user_id}, {"_id": 0})
    results["3_after_first_order_status"] = r2 and r2.get("status")
    results["3_first_order_at_set"] = bool(r2 and r2.get("first_order_at"))

    # wallet credited now
    w2 = await db.wallets.find_one({"user_id": promoter_id}, {"_id": 0})
    results["4_wallet_after"] = w2.get("balances") if w2 else None

    # 3) idempotency: settle again should not double-credit
    await server._settle_partner_first_order_rewards(order)
    txns = await db.wallet_transactions.count_documents({"user_id": promoter_id, "type": "promoter_reward"})
    results["5_reward_txn_count"] = txns

    # cleanup
    await db.users.delete_many({"id": {"$in": [promoter_id, driver_user_id]}})
    await db.drivers.delete_many({"id": driver_id})
    await db.promo_rewards.delete_many({"referred_user_id": driver_user_id})
    await db.wallets.delete_many({"user_id": promoter_id})
    await db.wallet_transactions.delete_many({"user_id": promoter_id})

    print("RESULTS:")
    for k, v in results.items():
        print(f"  {k}: {v}")

    ok = (results["1_created_status"] == "pending_first_order"
          and results["3_after_first_order_status"] == "paid"
          and results["3_first_order_at_set"]
          and results["5_reward_txn_count"] == 1)
    print("PASS" if ok else "FAIL")


asyncio.run(main())

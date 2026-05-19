"""
Backend tests for iteration-6 features:
- GET /api/currency/rates (TTD primary, USD base, invalid base)
- New-user wallet default balances {USD:0, TTD:0}
- POST /api/ratings (review submission + 5-star driver bonus)
- GET /api/orders/{order_id}/rating
- GET /api/drivers/{driver_id}/incentives
- POST /api/admin/run-weekly-driver-bonus (admin-only + idempotency)

DB seeding: Uses pymongo (sync) directly against MONGO_URL/DB_NAME to seed
fake delivered orders + driver rows, since there's no public API to mint a
delivered order with an assigned driver.
"""
import os
import time
import uuid
import pytest
import requests
import pymongo
from datetime import datetime, timezone, timedelta


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

MONGO_URL = None
DB_NAME = None
with open("/app/backend/.env") as fh:
    for line in fh:
        if line.startswith("MONGO_URL="):
            MONGO_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        elif line.startswith("DB_NAME="):
            DB_NAME = line.split("=", 1)[1].strip().strip('"').strip("'")

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
assert MONGO_URL and DB_NAME, "MONGO_URL / DB_NAME must be set"


@pytest.fixture(scope="module")
def db():
    client = pymongo.MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    yield client[DB_NAME]
    client.close()


def _register(email, password="Test1234!", name="QA", user_type="customer"):
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "user_type": user_type},
        timeout=30,
    )
    assert r.status_code == 200, f"register {email}: {r.status_code} {r.text}"
    return r.json()


def _uniq(prefix):
    return f"{prefix}_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"


# ---------- currency rates ----------
class TestCurrencyRates:
    def test_default_base_usd(self):
        r = requests.get(f"{BASE_URL}/api/currency/rates", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("base", "rates", "updated_at", "source"):
            assert k in body, f"missing key {k}"
        assert body["base"] == "USD"
        # TTD must be the first key in rates dict (insertion order)
        assert list(body["rates"].keys())[0] == "TTD", f"first key should be TTD, got {list(body['rates'].keys())[:3]}"
        assert list(body["rates"].keys())[1] == "USD"
        assert body["rates"]["USD"] == 1.0
        assert abs(body["rates"]["TTD"] - 6.78) < 0.01

    def test_base_ttd(self):
        r = requests.get(f"{BASE_URL}/api/currency/rates", params={"base": "TTD"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["base"] == "TTD"
        assert body["rates"]["TTD"] == 1.0
        # 1 TTD ≈ 1/6.78 USD ≈ 0.1475
        assert abs(body["rates"]["USD"] - (1.0 / 6.78)) < 0.001

    def test_lowercase_base_is_normalized(self):
        r = requests.get(f"{BASE_URL}/api/currency/rates", params={"base": "ttd"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["base"] == "TTD"

    def test_invalid_base_400(self):
        r = requests.get(f"{BASE_URL}/api/currency/rates", params={"base": "XYZ"}, timeout=15)
        assert r.status_code == 400


# ---------- wallet defaults ----------
class TestWalletDefaultsTTD:
    def test_new_user_has_usd_and_ttd_zero(self):
        creds = _register(_uniq("walletdef"))
        h = {"Authorization": f"Bearer {creds['access_token']}"}
        r = requests.get(f"{BASE_URL}/api/wallet", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        balances = r.json().get("balances", {})
        assert "USD" in balances and "TTD" in balances, f"got {balances}"
        assert balances["USD"] == 0
        assert balances["TTD"] == 0
        # JMD should NOT be in defaults anymore
        assert "JMD" not in balances or balances.get("JMD", 0) == 0


# ---------- shared seed for review tests ----------
@pytest.fixture(scope="module")
def review_world(db):
    """
    Seed:
      - customer user (via API)
      - driver-user + drivers row (db.drivers with user_id=driver_user.id)
      - vendor restaurant row
      - delivered order assigned to driver
      - second delivered order (for the 'already rated' path? no - for incentives list reuse)
      - extra customer (not the order owner) for 403 check
    """
    cust = _register(_uniq("rev_cust"))
    cust_h = {"Authorization": f"Bearer {cust['access_token']}"}

    driver_user = _register(_uniq("rev_drvuser"), user_type="driver")
    driver_h = {"Authorization": f"Bearer {driver_user['access_token']}"}

    other_cust = _register(_uniq("rev_other"))
    other_h = {"Authorization": f"Bearer {other_cust['access_token']}"}

    # Driver row (matches what /api/drivers/register would create)
    driver_id = str(uuid.uuid4())
    db.drivers.insert_one({
        "id": driver_id,
        "user_id": driver_user["user"]["id"],
        "name": driver_user["user"]["name"],
        "rating": 0,
        "total_ratings": 0,
        "status": "available",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Vendor (restaurant) row
    vendor_id = str(uuid.uuid4())
    db.restaurants.insert_one({
        "id": vendor_id,
        "name": "QA Restaurant",
        "rating": 0,
        "total_ratings": 0,
    })

    def _make_order(status="delivered"):
        oid = str(uuid.uuid4())
        db.orders.insert_one({
            "id": oid,
            "customer_id": cust["user"]["id"],
            "restaurant_id": vendor_id,
            "vendor_id": vendor_id,
            "driver_id": driver_id,
            "status": status,
            "total": 25.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return oid

    order_5star = _make_order()       # for 5-star bonus test
    order_3star = _make_order()       # for non-bonus rating test
    order_already = _make_order()     # for "already rated" check
    order_pending = _make_order(status="pending")  # for "not delivered" check
    order_404 = str(uuid.uuid4())     # never inserted

    yield {
        "cust": cust, "cust_h": cust_h,
        "driver_user": driver_user, "driver_h": driver_h,
        "other_h": other_h,
        "driver_id": driver_id,
        "driver_user_id": driver_user["user"]["id"],
        "vendor_id": vendor_id,
        "order_5star": order_5star,
        "order_3star": order_3star,
        "order_already": order_already,
        "order_pending": order_pending,
        "order_404": order_404,
    }

    # Cleanup: best-effort
    db.drivers.delete_one({"id": driver_id})
    db.restaurants.delete_one({"id": vendor_id})
    db.orders.delete_many({"id": {"$in": [order_5star, order_3star, order_already, order_pending]}})
    db.ratings.delete_many({"order_id": {"$in": [order_5star, order_3star, order_already, order_pending]}})
    db.driver_incentives.delete_many({"driver_id": driver_id})


# ---------- POST /api/ratings ----------
class TestRatingSubmission:
    def test_unauth_401(self, review_world):
        r = requests.post(
            f"{BASE_URL}/api/ratings",
            json={"order_id": review_world["order_3star"], "driver_rating": 4},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_not_owner_403(self, review_world):
        r = requests.post(
            f"{BASE_URL}/api/ratings",
            headers=review_world["other_h"],
            json={"order_id": review_world["order_3star"], "driver_rating": 4},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_unknown_order_404(self, review_world):
        r = requests.post(
            f"{BASE_URL}/api/ratings",
            headers=review_world["cust_h"],
            json={"order_id": review_world["order_404"], "driver_rating": 4},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_not_delivered_400(self, review_world):
        r = requests.post(
            f"{BASE_URL}/api/ratings",
            headers=review_world["cust_h"],
            json={"order_id": review_world["order_pending"], "driver_rating": 4},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_non_five_star_no_bonus(self, review_world, db):
        order_id = review_world["order_3star"]
        r = requests.post(
            f"{BASE_URL}/api/ratings",
            headers=review_world["cust_h"],
            json={
                "order_id": order_id,
                "driver_rating": 3,
                "vendor_rating": 4,
                "driver_review": "ok",
                "vendor_review": "good",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["driver_rating"] == 3
        # no incentive row for this order
        inc = db.driver_incentives.find_one({"order_id": order_id})
        assert inc is None, f"unexpected bonus on 3-star: {inc}"

    def test_already_rated_400(self, review_world):
        oid = review_world["order_already"]
        # First rate succeeds
        r1 = requests.post(
            f"{BASE_URL}/api/ratings",
            headers=review_world["cust_h"],
            json={"order_id": oid, "driver_rating": 4},
            timeout=15,
        )
        assert r1.status_code == 200, r1.text
        # Second rate fails
        r2 = requests.post(
            f"{BASE_URL}/api/ratings",
            headers=review_world["cust_h"],
            json={"order_id": oid, "driver_rating": 5},
            timeout=15,
        )
        assert r2.status_code == 400, r2.text


# ---------- 5-star bonus flow ----------
class TestFiveStarBonus:
    def test_5star_credits_wallet_and_records_incentive(self, review_world, db):
        order_id = review_world["order_5star"]
        driver_user_id = review_world["driver_user_id"]
        driver_id = review_world["driver_id"]
        driver_h = review_world["driver_h"]

        # Driver wallet balance BEFORE (auto-creates wallet on first GET)
        wb = requests.get(f"{BASE_URL}/api/wallet", headers=driver_h, timeout=15).json()
        before = float(wb.get("balances", {}).get("USD", 0))

        # Customer submits 5-star
        r = requests.post(
            f"{BASE_URL}/api/ratings",
            headers=review_world["cust_h"],
            json={
                "order_id": order_id,
                "driver_rating": 5,
                "vendor_rating": 5,
                "driver_review": "amazing driver",
                "vendor_review": "great food",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text

        # Incentive row inserted
        inc = db.driver_incentives.find_one({"order_id": order_id, "type": "five_star_bonus"})
        assert inc is not None, "missing five_star_bonus row"
        assert inc["driver_id"] == driver_id
        assert float(inc["amount"]) == 1.00
        assert inc["currency"] == "USD"

        # Driver wallet USD balance increased by exactly $1.00
        wa = requests.get(f"{BASE_URL}/api/wallet", headers=driver_h, timeout=15).json()
        after = float(wa.get("balances", {}).get("USD", 0))
        assert abs((after - before) - 1.00) < 0.001, f"expected +1.00, got before={before} after={after}"

        # Wallet transaction recorded
        txns = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=driver_h, timeout=15).json()
        tip_txns = [t for t in txns if t.get("order_id") == order_id and t.get("type") in ("tip_in", "tip")]
        assert len(tip_txns) >= 1, f"no tip_in txn for order {order_id}; got {[t.get('type') for t in txns][:10]}"


# ---------- GET /api/orders/{order_id}/rating ----------
class TestOrderRatingGet:
    def test_rated_true_after_submission(self, review_world):
        r = requests.get(
            f"{BASE_URL}/api/orders/{review_world['order_5star']}/rating",
            headers=review_world["cust_h"], timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["rated"] is True
        assert body["rating"] is not None
        assert body["rating"]["driver_rating"] == 5

    def test_404_unknown_order(self, review_world):
        r = requests.get(
            f"{BASE_URL}/api/orders/{review_world['order_404']}/rating",
            headers=review_world["cust_h"], timeout=15,
        )
        assert r.status_code == 404

    def test_403_non_owner(self, review_world):
        r = requests.get(
            f"{BASE_URL}/api/orders/{review_world['order_5star']}/rating",
            headers=review_world["other_h"], timeout=15,
        )
        assert r.status_code == 403


# ---------- GET /api/drivers/{driver_id}/incentives ----------
class TestDriverIncentivesGet:
    def test_unauth_401(self, review_world):
        r = requests.get(f"{BASE_URL}/api/drivers/{review_world['driver_id']}/incentives", timeout=15)
        assert r.status_code in (401, 403)

    def test_driver_can_view_self(self, review_world):
        r = requests.get(
            f"{BASE_URL}/api/drivers/{review_world['driver_id']}/incentives",
            headers=review_world["driver_h"], timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "incentives" in body and "total_earned" in body
        # We awarded $1 above
        assert body["total_earned"] >= 1.00 - 0.001
        # Ensure no Mongo _id leaks
        for inc in body["incentives"]:
            assert "_id" not in inc

    def test_other_user_forbidden_403(self, review_world):
        r = requests.get(
            f"{BASE_URL}/api/drivers/{review_world['driver_id']}/incentives",
            headers=review_world["other_h"], timeout=15,
        )
        assert r.status_code == 403


# ---------- POST /api/admin/run-weekly-driver-bonus ----------
class TestWeeklyBonus:
    def test_non_admin_forbidden(self, review_world):
        r = requests.post(
            f"{BASE_URL}/api/admin/run-weekly-driver-bonus",
            headers=review_world["cust_h"], timeout=20,
        )
        assert r.status_code == 403

    def test_admin_runs_and_is_idempotent(self, db):
        # Build a dedicated world: register admin + driver user, seed driver row + 10 ratings with avg=5
        admin = _register(_uniq("wkadmin"), user_type="admin")
        admin_h = {"Authorization": f"Bearer {admin['access_token']}"}

        drv_user = _register(_uniq("wkdrv"), user_type="driver")
        drv_user_id = drv_user["user"]["id"]
        drv_id = str(uuid.uuid4())
        db.drivers.insert_one({
            "id": drv_id, "user_id": drv_user_id, "name": "WK Driver",
            "rating": 0, "total_ratings": 0,
        })

        # Seed 12 ratings with driver_rating=5 in the last 7 days
        now = datetime.now(timezone.utc)
        seeded_rating_ids = []
        for _ in range(12):
            rid = str(uuid.uuid4())
            seeded_rating_ids.append(rid)
            db.ratings.insert_one({
                "id": rid,
                "order_id": str(uuid.uuid4()),
                "customer_id": str(uuid.uuid4()),
                "driver_id": drv_id,
                "driver_rating": 5,
                "vendor_rating": None,
                "created_at": (now - timedelta(hours=1)).isoformat(),
            })

        # First run
        r1 = requests.post(f"{BASE_URL}/api/admin/run-weekly-driver-bonus", headers=admin_h, timeout=30)
        assert r1.status_code == 200, r1.text
        body1 = r1.json()
        assert body1.get("success") is True
        assert body1.get("drivers_awarded", 0) >= 1

        week_key = now.strftime("%G-W%V")
        rows_after_first = list(db.driver_incentives.find(
            {"driver_id": drv_id, "type": "weekly_top_driver", "week": week_key}, {"_id": 0}
        ))
        assert len(rows_after_first) == 1, f"expected exactly 1 weekly bonus row, got {len(rows_after_first)}"
        assert float(rows_after_first[0]["amount"]) == 25.00

        # Second run within same week -> idempotent (no new row, drivers_awarded for this driver=0)
        r2 = requests.post(f"{BASE_URL}/api/admin/run-weekly-driver-bonus", headers=admin_h, timeout=30)
        assert r2.status_code == 200, r2.text
        rows_after_second = list(db.driver_incentives.find(
            {"driver_id": drv_id, "type": "weekly_top_driver", "week": week_key}, {"_id": 0}
        ))
        assert len(rows_after_second) == 1, (
            f"idempotency broken — got {len(rows_after_second)} rows after rerun"
        )

        # Driver's wallet credited exactly once with $25
        h = {"Authorization": f"Bearer {drv_user['access_token']}"}
        txns = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=h, timeout=15).json()
        weekly_txns = [t for t in txns if "weekly bonus" in (t.get("note") or "").lower()]
        assert len(weekly_txns) == 1, f"expected 1 weekly bonus txn, got {len(weekly_txns)}"

        # Cleanup
        db.drivers.delete_one({"id": drv_id})
        db.ratings.delete_many({"id": {"$in": seeded_rating_ids}})
        db.driver_incentives.delete_many({"driver_id": drv_id})

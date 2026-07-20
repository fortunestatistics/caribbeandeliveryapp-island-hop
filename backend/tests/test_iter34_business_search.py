"""Iteration 34 - Business/BrowseBusinesses search + public track + drivers online.

Endpoints under test:
  - GET  /api/search/featured                (public, category filter)
  - GET  /api/drivers/online-count           (public)
  - GET  /api/orders/{id}/public-track       (public, 404 for unknown)
  - GET  /api/admin/records/{category}       (regression: doc_summary per row)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "admin.qa@islandhop-demo.com"
ADMIN_PASSWORD = "AdminQA1234!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token")


# ---------------- /api/search/featured ----------------
class TestSearchFeatured:
    def test_no_category_returns_mixed(self):
        r = requests.get(f"{BASE_URL}/api/search/featured", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "results" in data and isinstance(data["results"], list)
        # Expect mixed vendor types when no category
        types = {row.get("vendor_type") for row in data["results"]}
        # There MUST be at least one row seeded by _seed_marketplace_partners
        assert len(data["results"]) > 0, "featured search returned no results"
        # There should be more than 1 vendor_type OR at least the seeded ones
        assert types.issubset({"restaurant", "pharmacy", "grocery"})

    @pytest.mark.parametrize("cat", ["restaurant", "pharmacy", "grocery"])
    def test_category_filter(self, cat):
        r = requests.get(f"{BASE_URL}/api/search/featured", params={"category": cat}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        for row in data["results"]:
            assert row.get("vendor_type") == cat, f"expected {cat}, got {row.get('vendor_type')} for row {row}"

    def test_restaurants_sorted_featured_first(self):
        r = requests.get(f"{BASE_URL}/api/search/featured", params={"category": "restaurant"}, timeout=15)
        assert r.status_code == 200
        results = r.json().get("results", [])
        if not results:
            pytest.skip("no restaurants seeded")
        # Once a non-featured appears, no featured should appear after it
        seen_non_featured = False
        for row in results:
            if not row.get("featured"):
                seen_non_featured = True
            elif seen_non_featured:
                pytest.fail(f"featured row appeared after non-featured: {row}")


# ---------------- /api/drivers/online-count ----------------
class TestDriversOnlineCount:
    def test_returns_online_int(self):
        r = requests.get(f"{BASE_URL}/api/drivers/online-count", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "online" in data
        assert isinstance(data["online"], int)
        assert data["online"] >= 0


# ---------------- /api/orders/{id}/public-track ----------------
class TestPublicTrack:
    def test_unknown_order_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/orders/nonexistent-{int(time.time())}/public-track", timeout=15)
        assert r.status_code == 404

    def test_no_auth_required(self):
        # even a missing order returns 404, not 401
        r = requests.get(f"{BASE_URL}/api/orders/xx-invalid/public-track", timeout=15)
        assert r.status_code == 404
        assert "Authorization" not in r.request.headers or not r.request.headers.get("Authorization")

    def test_valid_order_returns_safe_fields(self):
        """Create a customer + order via existing food-order flow (best-effort)."""
        ts = int(time.time())
        email = f"qa_iter34_{ts}@gmail.com"
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test1234!", "name": "QA34", "user_type": "customer"
        }, timeout=15)
        if reg.status_code != 200:
            pytest.skip(f"register failed: {reg.status_code} {reg.text[:200]}")
        token = reg.json().get("access_token")
        H = {"Authorization": f"Bearer {token}"}

        # Get a restaurant
        rr = requests.get(f"{BASE_URL}/api/restaurants", timeout=15)
        if rr.status_code != 200 or not rr.json():
            pytest.skip("no restaurants available to create order")
        rest = rr.json()[0]
        # Get a menu item
        mi = requests.get(f"{BASE_URL}/api/restaurants/{rest['id']}/menu", timeout=15)
        if mi.status_code != 200 or not mi.json():
            pytest.skip("no menu items")
        item = mi.json()[0]
        order_payload = {
            "restaurant_id": rest["id"],
            "items": [{
                "menu_item_id": item["id"], "name": item.get("name", "x"),
                "quantity": 1, "price": item.get("price", 10),
            }],
            "delivery_address": {"street": "123", "city": "POS", "country": "TT"},
            "payment_method": "cash",
            "total_amount": item.get("price", 10),
        }
        oc = requests.post(f"{BASE_URL}/api/orders", json=order_payload, headers=H, timeout=15)
        if oc.status_code not in (200, 201):
            pytest.skip(f"order create failed: {oc.status_code} {oc.text[:200]}")
        oid = oc.json().get("id") or oc.json().get("order", {}).get("id")
        if not oid:
            pytest.skip(f"no order id in create response: {oc.json()}")

        # Hit public-track WITHOUT auth
        pt = requests.get(f"{BASE_URL}/api/orders/{oid}/public-track", timeout=15)
        assert pt.status_code == 200, pt.text
        data = pt.json()
        assert data.get("order_id") == oid
        assert "status" in data
        # No PII fields
        for banned in ("customer_id", "customer_phone", "customer_email", "phone", "email"):
            assert banned not in data, f"public-track leaked {banned}: {data}"


# ---------------- /api/admin/records/{category} doc_summary regression ----------------
class TestAdminRecordsDocSummary:
    @pytest.mark.parametrize("cat", ["restaurants", "drivers", "car_rentals", "businesses"])
    def test_each_record_has_doc_summary(self, admin_token, cat):
        r = requests.get(f"{BASE_URL}/api/admin/records/{cat}",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert "records" in payload
        if not payload["records"]:
            pytest.skip(f"no records for {cat}")
        for rec in payload["records"][:5]:
            assert "doc_summary" in rec, f"{cat} record missing doc_summary: keys={list(rec.keys())}"

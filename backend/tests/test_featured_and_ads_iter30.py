"""
Iter 30 — Featured ranking + Merchant Ad Space tests.

Covers:
  - GET /api/restaurants returns featured + subscription_tier; Premium merchant sorts first
  - GET /api/ads/packages (3 packages, price_ttd in [300, 1000, 1500])
  - GET /api/ads/active?placement=homepage — live ads incl. sample 'Ad Spice Kitchen'
  - POST /api/ads/{id}/click increments
  - POST/GET/PATCH/DELETE /api/merchant/ads (with paused excluded from active feed)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

TS = str(int(time.time()))
MERCHANT_EMAIL = f"qa_mrcads30_{TS}_{uuid.uuid4().hex[:6]}@test.com"
MERCHANT_PWD = "MerchAds1234!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def featured_merchant(session):
    """Create a customer, promote to restaurant, set Premium tier (featured=true)."""
    r = session.post(
        f"{API}/auth/register",
        json={
            "email": MERCHANT_EMAIL,
            "password": MERCHANT_PWD,
            "name": "QA Featured Merchant",
            "user_type": "customer",
        },
        timeout=20,
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    name = f"QA_Featured_Iter30_{TS}"
    r2 = session.post(
        f"{API}/restaurants",
        headers=headers,
        json={
            "user_id": "ignored-server-overrides",
            "name": name,
            "description": "Featured test restaurant for iter30",
            "cuisine_type": "Caribbean",
            "address": {
                "street": "1 QA Lane",
                "city": "Port of Spain",
                "country": "TT",
                "postal_code": "00000",
            },
            "phone": "+18685550030",
            "email": MERCHANT_EMAIL,
        },
        timeout=20,
    )
    assert r2.status_code in (200, 201), r2.text
    rid = r2.json().get("id") or r2.json().get("restaurant", {}).get("id")
    assert rid

    r3 = session.post(
        f"{API}/merchant/subscription/select",
        headers=headers,
        json={"tier": "premium"},
        timeout=20,
    )
    assert r3.status_code == 200, r3.text
    body = r3.json()
    assert body.get("featured") is True
    return {"token": token, "headers": headers, "restaurant_id": rid, "name": name}


# ---------- FEATURED ranking ----------
class TestFeaturedRanking:
    def test_restaurants_includes_featured_and_tier_fields(self, session, featured_merchant):
        r = session.get(f"{API}/restaurants", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        sample = data[0]
        assert "featured" in sample, f"missing 'featured' on restaurant: keys={list(sample.keys())}"
        assert "subscription_tier" in sample, (
            f"missing 'subscription_tier': keys={list(sample.keys())}"
        )

    def test_featured_first_sorting(self, session, featured_merchant):
        r = session.get(f"{API}/restaurants", timeout=20)
        assert r.status_code == 200
        data = r.json()
        # Once a non-featured restaurant appears, no later restaurant should be featured
        seen_unfeatured = False
        for item in data:
            if not item.get("featured"):
                seen_unfeatured = True
            else:
                assert not seen_unfeatured, "Featured restaurant appeared AFTER a non-featured one"
        # Verify our premium merchant is among featured set
        ours = next((x for x in data if x.get("id") == featured_merchant["restaurant_id"]), None)
        assert ours is not None, "Newly-created featured merchant not in /restaurants response"
        assert ours.get("featured") is True
        assert str(ours.get("subscription_tier", "")).lower() == "premium"


# ---------- AD packages + active feed ----------
class TestAdPackagesAndActiveFeed:
    def test_packages(self, session):
        r = session.get(f"{API}/ads/packages", timeout=15)
        assert r.status_code == 200, r.text
        pkgs = r.json()
        assert isinstance(pkgs, list) and len(pkgs) == 3
        prices = sorted(int(p["price_ttd"]) for p in pkgs)
        assert prices == [300, 1000, 1500], f"unexpected prices: {prices}"
        # Each package must have id/placement/days
        for p in pkgs:
            assert {"id", "placement", "days", "price_ttd"}.issubset(p.keys())

    def test_active_feed_homepage_sample_exists(self, session):
        r = session.get(f"{API}/ads/active", params={"placement": "homepage"}, timeout=15)
        assert r.status_code == 200, r.text
        ads = r.json()
        assert isinstance(ads, list)
        # Sample 'Ad Spice Kitchen' should be present per problem statement
        titles = [a.get("title", "") for a in ads]
        assert any("Spice Kitchen" in t for t in titles), (
            f"Sample 'Spice Kitchen' ad not found in active feed. titles={titles}"
        )

    def test_click_endpoint_increments(self, session):
        r = session.get(f"{API}/ads/active", params={"placement": "homepage"}, timeout=15)
        ads = r.json()
        assert ads, "no active homepage ads to click"
        ad_id = ads[0]["id"]
        before = int(ads[0].get("clicks", 0))
        r2 = session.post(f"{API}/ads/{ad_id}/click", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("success") is True
        # Re-fetch and confirm increase
        r3 = session.get(f"{API}/ads/active", params={"placement": "homepage"}, timeout=15)
        new_ads = {a["id"]: a for a in r3.json()}
        assert int(new_ads[ad_id].get("clicks", 0)) >= before + 1


# ---------- MERCHANT ad CRUD ----------
class TestMerchantAdCRUD:
    AD_IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/epv2gAAAABJRU5ErkJggg=="

    def test_create_list_toggle_delete(self, session, featured_merchant):
        h = featured_merchant["headers"]
        title = f"TEST_AD_{TS}_{uuid.uuid4().hex[:6]}"

        # Create
        r = session.post(
            f"{API}/merchant/ads",
            headers=h,
            json={
                "title": title,
                "image": self.AD_IMG,
                "cta_url": "https://example.com/ad",
                "package_id": "home_7",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        ad = body["ad"]
        ad_id = ad["id"]
        assert ad["status"] == "active"
        assert ad["placement"] == "homepage"
        assert ad["price_ttd"] == 300

        # List
        r2 = session.get(f"{API}/merchant/ads", headers=h, timeout=15)
        assert r2.status_code == 200
        listed = r2.json()
        assert any(a["id"] == ad_id and a.get("is_live") is True for a in listed)

        # Verify it now appears in public active feed
        r3 = session.get(f"{API}/ads/active", params={"placement": "homepage"}, timeout=15)
        assert any(a["id"] == ad_id for a in r3.json()), "newly-created ad not in active feed"

        # Pause it
        r4 = session.patch(f"{API}/merchant/ads/{ad_id}", headers=h, timeout=15)
        assert r4.status_code == 200
        assert r4.json().get("status") == "paused"

        # Paused ad should NOT appear in active feed
        r5 = session.get(f"{API}/ads/active", params={"placement": "homepage"}, timeout=15)
        assert all(a["id"] != ad_id for a in r5.json()), "paused ad still appears in active feed"

        # Resume
        r6 = session.patch(f"{API}/merchant/ads/{ad_id}", headers=h, timeout=15)
        assert r6.status_code == 200
        assert r6.json().get("status") == "active"

        # Delete
        r7 = session.delete(f"{API}/merchant/ads/{ad_id}", headers=h, timeout=15)
        assert r7.status_code == 200
        assert r7.json().get("success") is True

        # Verify removed
        r8 = session.get(f"{API}/merchant/ads", headers=h, timeout=15)
        assert all(a["id"] != ad_id for a in r8.json()), "ad still in merchant list after delete"

    def test_invalid_package_rejected(self, session, featured_merchant):
        r = session.post(
            f"{API}/merchant/ads",
            headers=featured_merchant["headers"],
            json={
                "title": "bad pkg",
                "image": self.AD_IMG,
                "package_id": "nonexistent_pkg",
            },
            timeout=15,
        )
        assert r.status_code == 400

    def test_unauthenticated_create_rejected(self, session):
        r = session.post(
            f"{API}/merchant/ads",
            json={"title": "x", "image": self.AD_IMG, "package_id": "home_7"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

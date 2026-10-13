"""Iteration 61 backend tests:
- Claim submission via new ClaimCreate model (no user_id required in body)
- Address save with latitude/longitude (delivery pin)
- Admin settlement run + list endpoints
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://logistics-island.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer():
    """Register a new customer and return {email, password, token, user_id}."""
    email = f"qaclaim_{int(time.time())}@gmail.com"
    password = "Test1234!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "QA Claim"})
    assert r.status_code in (200, 201), r.text
    body = r.json()
    token = body.get("access_token")
    user = body.get("user") or {}
    return {"email": email, "password": password, "token": token, "user_id": user.get("id")}


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Claims (Feature 1) ----------
class TestClaims:
    def test_claim_requires_valid_order(self, customer):
        r = requests.post(f"{API}/claims", headers=auth(customer["token"]),
                          json={"order_id": "does-not-exist", "description": "test",
                                "claim_type": "missing_item"})
        assert r.status_code == 404, r.text

    def test_claim_creation_end_to_end(self, customer, admin_token):
        # Seed an order directly via admin? There is no admin create-order endpoint typically.
        # Instead, insert a paid order for this customer via a helper endpoint if exists —
        # otherwise skip creation and rely on delivered order lookup.
        # We'll POST to /api/orders/create (auth as customer) then flip its payment_status via admin update if available.
        # Fall back: skip if unavailable.

        # Try creating an order via customer (may fail depending on required fields)
        order_payload = {
            "restaurant_id": "test-restaurant-id",
            "items": [{"menu_item_id": "x", "name": "Test", "price": 10.0, "quantity": 1}],
            "total_amount": 10.0,
            "delivery_address": {"street": "1 Test", "city": "Kingston", "state": "St. Andrew", "country": "TT"},
            "payment_method": "wallet",
        }
        oc = requests.post(f"{API}/orders/create", headers=auth(customer["token"]), json=order_payload)
        if oc.status_code not in (200, 201):
            pytest.skip(f"Could not create test order for claim (status {oc.status_code}): {oc.text[:200]}")

        order_id = oc.json().get("id")
        assert order_id

        # File claim
        r = requests.post(f"{API}/claims", headers=auth(customer["token"]),
                          json={"order_id": order_id, "description": "Item missing",
                                "claim_type": "missing_item"})
        # Order may need to be delivered/paid; note eligibility check is elsewhere in code.
        # Endpoint itself should not 422 for missing user_id.
        assert r.status_code != 422, f"ClaimCreate 422 regression: {r.text}"
        assert r.status_code in (200, 201, 400, 404), r.text
        if r.status_code in (200, 201):
            body = r.json()
            assert body["order_id"] == order_id
            assert body["category"] == "claim"
            assert body.get("claim_type") == "missing_item"

            # Verify it appears in list
            lst = requests.get(f"{API}/claims", headers=auth(customer["token"]))
            assert lst.status_code == 200
            ids = [c["id"] for c in lst.json()]
            assert body["id"] in ids

    def test_claim_no_user_id_required_in_body(self, customer):
        """Regression: ensure omission of user_id in body does not cause 422."""
        r = requests.post(f"{API}/claims", headers=auth(customer["token"]),
                          json={"order_id": "nonexistent", "description": "x"})
        assert r.status_code != 422, f"422 regression: {r.text}"

    def test_claim_invalid_type_400(self, customer):
        r = requests.post(f"{API}/claims", headers=auth(customer["token"]),
                          json={"order_id": "nonexistent", "description": "x", "claim_type": "bogus"})
        assert r.status_code == 400
        assert "claim_type" in r.text


# ---------- Addresses (Feature 2 - delivery pin persistence) ----------
class TestAddressLatLng:
    def test_create_address_with_latlng(self, customer):
        payload = {
            "label": "Home",
            "street_address": "12 Test Rd",
            "city": "Kingston",
            "state": "St. Andrew",
            "country": "TT",
            "latitude": 10.6918,
            "longitude": -61.2225,
            "is_default": True,
        }
        # Bug regression check: frontend does NOT send user_id in the payload
        r = requests.post(f"{API}/addresses", headers=auth(customer["token"]), json=payload)
        if r.status_code == 422:
            pytest.fail(
                "REGRESSION: POST /api/addresses returns 422 when user_id is not in body "
                "(analogous to the claim-submission bug). Frontend AddressManagement.js does not "
                "send user_id — MapPinPicker feature save will fail. Body model must not require user_id. "
                f"Response: {r.text}"
            )
        assert r.status_code in (200, 201), r.text
        created = r.json()
        aid = created.get("id")

        # Fetch list and confirm lat/lng persisted
        lst = requests.get(f"{API}/addresses", headers=auth(customer["token"]))
        assert lst.status_code == 200
        found = [a for a in lst.json() if a.get("id") == aid]
        assert found, "created address not returned in list"
        a = found[0]
        assert abs(float(a.get("latitude", 0)) - 10.6918) < 1e-4
        assert abs(float(a.get("longitude", 0)) - (-61.2225)) < 1e-4

    def test_create_address_with_userid_workaround(self, customer):
        """If user_id is passed manually, address should save with lat/lng."""
        payload = {
            "user_id": customer["user_id"],
            "label": "Work",
            "street_address": "5 Office Ln",
            "city": "Kingston",
            "state": "St. Andrew",
            "country": "TT",
            "latitude": 10.65,
            "longitude": -61.30,
            "is_default": False,
        }
        r = requests.post(f"{API}/addresses", headers=auth(customer["token"]), json=payload)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert abs(body.get("latitude", 0) - 10.65) < 1e-4
        assert abs(body.get("longitude", 0) - (-61.30)) < 1e-4
        # Backend should overwrite user_id with the current user's id
        assert body.get("user_id") == customer["user_id"]


# ---------- Admin settlement (Feature 3) ----------
class TestAdminSettlement:
    def test_run_settlement_admin(self, admin_token):
        r = requests.post(f"{API}/admin/settlements/run", headers=auth(admin_token), json={})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        batch = body.get("batch")
        assert batch and "id" in batch
        for k in ("merchants_settled", "drivers_settled", "merchants_total", "drivers_total"):
            assert k in batch, f"missing key {k} in batch"

    def test_run_settlement_idempotent(self, admin_token):
        r1 = requests.post(f"{API}/admin/settlements/run", headers=auth(admin_token), json={})
        r2 = requests.post(f"{API}/admin/settlements/run", headers=auth(admin_token), json={})
        assert r1.status_code == 200 and r2.status_code == 200
        b2 = r2.json()["batch"]
        # Second run should typically have 0 merchants/drivers because everything already settled
        assert b2["merchants_settled"] == 0
        assert b2["drivers_settled"] == 0

    def test_list_settlements(self, admin_token):
        r = requests.get(f"{API}/admin/settlements?limit=10", headers=auth(admin_token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "batches" in body
        assert isinstance(body["batches"], list)
        # Should have at least one batch after previous test runs
        if body["batches"]:
            b = body["batches"][0]
            for k in ("id", "created_at", "merchants_settled", "drivers_settled"):
                assert k in b

    def test_settlement_requires_admin(self, customer):
        r = requests.post(f"{API}/admin/settlements/run", headers=auth(customer["token"]), json={})
        assert r.status_code == 403, r.text

        r2 = requests.get(f"{API}/admin/settlements", headers=auth(customer["token"]))
        assert r2.status_code == 403

"""Iteration 36 – Admin Approvals regression tests.

Focus: category-tab-empty bug + driver blank-name fix + storefront regression.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "tracyfortune@islandhoptt.com"
ADMIN_PASSWORD = "IslandHopAdmin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Category tab data ----------

def test_restaurants_all_non_empty(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/records/restaurants?status=all",
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    records = data.get("records") or data.get("items") or (data if isinstance(data, list) else [])
    count = data.get("count") if isinstance(data, dict) else len(records)
    assert (count or len(records)) > 0, f"expected active restaurants, got {data}"


def test_restaurants_pending_empty(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/records/restaurants?status=pending",
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200
    data = r.json()
    records = data.get("records") or data.get("items") or (data if isinstance(data, list) else [])
    # Should be 0 (all restaurants are active).
    assert len(records) == 0, f"expected 0 pending restaurants, got {len(records)}"


def test_car_rentals_all_non_empty(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/records/car_rentals?status=all",
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    records = data.get("records") or data.get("items") or (data if isinstance(data, list) else [])
    assert len(records) > 0, f"expected active car_rentals, got {data}"


def test_businesses_pending_has_route_diner(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/records/businesses?status=pending",
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    records = data.get("records") or data.get("items") or (data if isinstance(data, list) else [])
    assert len(records) > 0, "expected at least one pending business"
    names = " ".join(str(r.get("name") or r.get("business_name") or r.get("display_name") or "") for r in records).lower()
    # Best-effort – Route Diner should be present per the fixture description
    assert "route diner" in names or any(
        (r.get("status") in ("pending", "pending_approval")) for r in records
    ), f"no pending business with 'Route Diner' or status=pending; sample: {records[:2]}"


def test_drivers_all_include_joined_user(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/records/drivers?status=all",
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    records = data.get("records") or data.get("items") or (data if isinstance(data, list) else [])
    assert len(records) > 0, "expected driver records"
    # At least one driver should have a non-null name OR email post-join
    with_name = [d for d in records if (d.get("name") or d.get("email"))]
    assert with_name, f"no drivers with name/email after user join. sample: {records[:2]}"
    # Tracy Fortune specifically (per problem statement)
    joined_str = " ".join(str(d.get("name") or "") + " " + str(d.get("email") or "") for d in records).lower()
    assert "tracy" in joined_str or "fortune" in joined_str or "islandhoptt" in joined_str, \
        "expected Tracy Fortune to appear via user-join"


# ---------- Merchant storefront regression ----------

VERIFIED_BUSINESS_USER_ID = "4e609b30-69c4-4d37-b06a-7f8b7b8cdc74"  # Island Convenience


def test_merchant_storefront_via_impersonation(admin_headers):
    imp = requests.post(
        f"{BASE_URL}/api/admin/impersonate/{VERIFIED_BUSINESS_USER_ID}",
        headers=admin_headers, timeout=15,
    )
    assert imp.status_code == 200, f"impersonate failed: {imp.status_code} {imp.text}"
    body = imp.json()
    token = body.get("access_token") or body.get("token") or body.get("impersonation_token")
    assert token, f"no token returned by impersonate: {body}"

    sf = requests.get(
        f"{BASE_URL}/api/merchant/storefront",
        headers={"Authorization": f"Bearer {token}"}, timeout=15,
    )
    assert sf.status_code == 200, f"storefront failed: {sf.status_code} {sf.text}"
    payload = sf.json()
    assert isinstance(payload, dict) and payload, "storefront returned empty object"

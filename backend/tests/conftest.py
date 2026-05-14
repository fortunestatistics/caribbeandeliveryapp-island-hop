"""Shared fixtures for backend API tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback - parse from frontend env
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass


@pytest.fixture(scope="session")
def base_url():
    assert BASE_URL, "REACT_APP_BACKEND_URL must be configured"
    return BASE_URL


def _register_user(email: str, password: str = "Test1234!", name: str = "QA Tester", user_type: str = "customer"):
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "user_type": user_type},
        timeout=30,
    )
    return r


@pytest.fixture(scope="session")
def customer_creds():
    email = f"sched_test_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    password = "Test1234!"
    r = _register_user(email, password)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return {
        "email": email,
        "password": password,
        "user_id": body["user"]["id"],
        "token": body["access_token"],
    }


@pytest.fixture(scope="session")
def restaurant_creds():
    email = f"resto_test_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    password = "Test1234!"
    r = _register_user(email, password, name="QA Restaurant", user_type="restaurant")
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return {
        "email": email,
        "password": password,
        "user_id": body["user"]["id"],
        "token": body["access_token"],
    }


@pytest.fixture(scope="session")
def driver_creds():
    email = f"driver_test_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    password = "Test1234!"
    r = _register_user(email, password, name="QA Driver", user_type="driver")
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return {
        "email": email,
        "password": password,
        "user_id": body["user"]["id"],
        "token": body["access_token"],
    }


@pytest.fixture
def auth_headers(customer_creds):
    return {"Authorization": f"Bearer {customer_creds['token']}", "Content-Type": "application/json"}


@pytest.fixture
def restaurant_headers(restaurant_creds):
    return {"Authorization": f"Bearer {restaurant_creds['token']}", "Content-Type": "application/json"}


@pytest.fixture
def driver_headers(driver_creds):
    return {"Authorization": f"Bearer {driver_creds['token']}", "Content-Type": "application/json"}

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


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_users():
    """After the test session, purge any users this suite created so they never
    leak into the admin user list / messaging flows."""
    yield
    try:
        import os
        from pathlib import Path
        from pymongo import MongoClient

        env_path = Path(__file__).resolve().parent.parent / ".env"
        cfg = {}
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                cfg[k.strip()] = v.strip().strip('"').strip("'")
        client = MongoClient(cfg["MONGO_URL"])
        db = client[cfg["DB_NAME"]]
        db.users.delete_many({
            "$or": [
                {"email": {"$regex": r"^(id_start_|id_noapp_|id_session_|id_kyc_|sched_test_|resto_test_|driver_test_|qa_test_|auth_test_|dup_|fix_test_|pay_test_|checkout)", "$options": "i"}},
                {"email": {"$regex": r"@(test\.com|example\.(com|org|net)|test\.test)$", "$options": "i"}},
            ]
        })
        client.close()
    except Exception as exc:  # never fail the suite on cleanup
        print(f"[conftest] test-user cleanup skipped: {exc}")

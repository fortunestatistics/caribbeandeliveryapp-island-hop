"""Login must not crash for OAuth-only accounts (no password hash)."""
import os
import sys
import uuid
import asyncio
import requests

from conftest import BASE_URL

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server  # noqa: E402 (loads dotenv)
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def _fresh_db():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return c, c[os.environ["DB_NAME"]]


async def _set_provider(email, provider):
    c, db = _fresh_db()
    try:
        await db.users.update_one(
            {"email": email},
            {"$set": {"auth_provider": provider}, "$unset": {"hashed_password": ""}},
        )
    finally:
        c.close()


def _register(email):
    return requests.post(f"{BASE_URL}/api/auth/register",
                         json={"email": email, "password": "Test1234!", "name": "OAuth User"}, timeout=30)


def test_password_login_for_google_account_returns_clear_message():
    email = f"oauth_{uuid.uuid4().hex[:8]}@gmail.com"
    assert _register(email).status_code == 200
    asyncio.run(_set_provider(email, "google"))

    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": "anything"}, timeout=30)
    assert r.status_code == 401, r.text  # NOT 500
    assert "Google" in r.json()["detail"]
    assert "Continue with Google" in r.json()["detail"]


def test_password_login_for_microsoft_account_message():
    email = f"oauthms_{uuid.uuid4().hex[:8]}@gmail.com"
    assert _register(email).status_code == 200
    asyncio.run(_set_provider(email, "microsoft"))

    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": "anything"}, timeout=30)
    assert r.status_code == 401, r.text
    assert "Microsoft" in r.json()["detail"]


def test_normal_password_login_still_works():
    email = f"normal_{uuid.uuid4().hex[:8]}@gmail.com"
    assert _register(email).status_code == 200
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": "Test1234!"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]


def test_wrong_password_still_401_generic():
    email = f"wrong_{uuid.uuid4().hex[:8]}@gmail.com"
    assert _register(email).status_code == 200
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": "WrongPass!"}, timeout=30)
    assert r.status_code == 401, r.text
    assert "Invalid email or password" in r.json()["detail"]

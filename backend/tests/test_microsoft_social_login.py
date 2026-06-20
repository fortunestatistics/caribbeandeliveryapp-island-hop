"""Tests for Microsoft (Azure AD) social login endpoints.

Preview uses placeholder Azure creds, so the live endpoints respond 503
(graceful "not configured"). The configured create-or-link happy-path is
verified in-process with mocks via asyncio.run (no pytest-asyncio needed).
"""
import os
import sys
import uuid
import asyncio
import requests
from unittest.mock import AsyncMock, patch

from conftest import BASE_URL


# ---- HTTP behaviour in preview (unconfigured) ----

def test_login_url_unconfigured_returns_503():
    r = requests.get(
        f"{BASE_URL}/api/auth/social/microsoft/login-url",
        params={"redirect_uri": "https://x/auth/microsoft/callback", "state": "s"},
        timeout=30,
    )
    assert r.status_code == 503, r.text


def test_login_url_missing_params_returns_422():
    r = requests.get(f"{BASE_URL}/api/auth/social/microsoft/login-url", timeout=30)
    assert r.status_code == 422, r.text


def test_code_exchange_unconfigured_returns_503():
    r = requests.post(
        f"{BASE_URL}/api/auth/social/microsoft",
        json={"code": "junk", "redirect_uri": "https://x/auth/microsoft/callback"},
        timeout=30,
    )
    assert r.status_code == 503, r.text


# ---- In-process happy-path (configured, mocked Microsoft) ----

def test_code_exchange_creates_user_and_mints_jwt():
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import server

    email = f"mstest_{uuid.uuid4().hex[:8]}@example.com"

    async def _run():
        mock_resp = type("R", (), {"status_code": 200, "json": lambda self: {"id_token": "fake"}})()
        mock_client = AsyncMock()
        mock_client.post.return_value = mock_resp
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__.return_value = mock_client

        with patch.object(server, "_ms_configured", return_value=True), \
             patch.object(server, "MS_TENANT_ID", "tenant-123"), \
             patch.object(server, "MS_CLIENT_ID", "client-abc"), \
             patch.object(server, "MS_CLIENT_SECRET", "secret"), \
             patch("server.httpx.AsyncClient", return_value=mock_ctx), \
             patch.object(server, "_verify_ms_id_token", new=AsyncMock(return_value={
                 "email": email, "name": "MS Tester", "sub": "ms-sub-1"})):
            payload = server.MicrosoftAuthRequest(code="goodcode", redirect_uri="https://app/cb")
            result = await server.microsoft_social_auth(payload)

        assert result["token_type"] == "bearer"
        assert result["access_token"]
        assert result["user"]["email"] == email
        assert result["user"]["user_type"] == "customer"
        await server.db.users.delete_one({"email": email})

    asyncio.run(_run())


def test_login_url_builds_authorize_url_when_configured():
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import server

    async def _run():
        with patch.object(server, "_ms_configured", return_value=True), \
             patch.object(server, "MS_TENANT_ID", "tenant-123"), \
             patch.object(server, "MS_CLIENT_ID", "client-abc"):
            res = await server.microsoft_login_url(
                redirect_uri="https://app/auth/microsoft/callback", state="xyz")
        url = res["url"]
        assert url.startswith("https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize")
        assert "client_id=client-abc" in url
        assert "response_type=code" in url
        assert "scope=openid+profile+email" in url
        assert "state=xyz" in url

    asyncio.run(_run())

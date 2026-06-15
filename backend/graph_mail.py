"""Microsoft Graph email client (application permissions / client-credentials flow).

Reads and replies to Microsoft 365 / Outlook mailboxes for the admin support
inbox. Credentials come from the environment (read lazily so import order vs.
load_dotenv never matters):
  - M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET
  - M365_GRAPH_SCOPE (defaults to https://graph.microsoft.com/.default)
  - SUPPORT_MAILBOXES (comma-separated list of mailbox addresses)
"""
import os
import base64
import json
import logging
from typing import Dict, Any, List, Optional

import httpx
import msal

logger = logging.getLogger(__name__)

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"

# MSAL apps are cheap but we cache one per (tenant, client) so token caching works.
_msal_app: Optional[msal.ConfidentialClientApplication] = None
_msal_key: Optional[str] = None


class GraphNotConfigured(Exception):
    """Raised when M365 env vars are missing."""


class GraphConsentMissing(Exception):
    """Raised when the app token has no Mail.* roles (admin consent not granted)."""


def _conf() -> Dict[str, str]:
    tenant = os.environ.get("M365_TENANT_ID")
    client = os.environ.get("M365_CLIENT_ID")
    secret = os.environ.get("M365_CLIENT_SECRET")
    if not (tenant and client and secret):
        raise GraphNotConfigured("M365_TENANT_ID / M365_CLIENT_ID / M365_CLIENT_SECRET not set")
    scope = os.environ.get("M365_GRAPH_SCOPE", "https://graph.microsoft.com/.default")
    return {"tenant": tenant, "client": client, "secret": secret, "scope": scope}


def get_support_mailboxes() -> List[str]:
    raw = os.environ.get("SUPPORT_MAILBOXES", "")
    return [m.strip() for m in raw.split(",") if m.strip()]


def _get_msal_app() -> msal.ConfidentialClientApplication:
    global _msal_app, _msal_key
    c = _conf()
    key = f"{c['tenant']}:{c['client']}"
    if _msal_app is None or _msal_key != key:
        _msal_app = msal.ConfidentialClientApplication(
            client_id=c["client"],
            client_credential=c["secret"],
            authority=f"https://login.microsoftonline.com/{c['tenant']}",
        )
        _msal_key = key
    return _msal_app


def _token_roles(token: str) -> List[str]:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return claims.get("roles", []) or []
    except Exception:
        return []


def acquire_app_token() -> str:
    c = _conf()
    app = _get_msal_app()
    result = app.acquire_token_for_client(scopes=[c["scope"]])
    if "access_token" not in result:
        raise RuntimeError(
            f"Token error: {result.get('error')} - {result.get('error_description', '')[:200]}"
        )
    return result["access_token"]


def graph_status() -> Dict[str, Any]:
    """Lightweight health/readiness probe for the admin UI."""
    try:
        token = acquire_app_token()
    except GraphNotConfigured:
        return {"configured": False, "consent_granted": False, "roles": [], "mailboxes": []}
    except Exception as exc:  # invalid secret, etc.
        return {"configured": True, "consent_granted": False, "error": str(exc)[:200], "roles": [], "mailboxes": get_support_mailboxes()}
    roles = _token_roles(token)
    has_mail = any(r.startswith("Mail.") for r in roles)
    return {
        "configured": True,
        "consent_granted": has_mail,
        "roles": roles,
        "mailboxes": get_support_mailboxes(),
    }


async def _graph_get(path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    token = acquire_app_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=GRAPH_BASE_URL, headers=headers, timeout=30.0) as client:
        resp = await client.get(path, params=params)
        if resp.status_code == 403:
            raise GraphConsentMissing(resp.json().get("error", {}).get("message", "Access denied"))
        resp.raise_for_status()
        return resp.json()


async def _graph_post(path: str, body: Optional[Dict[str, Any]] = None) -> None:
    token = acquire_app_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(base_url=GRAPH_BASE_URL, headers=headers, timeout=30.0) as client:
        resp = await client.post(path, json=body)
        if resp.status_code == 403:
            raise GraphConsentMissing(resp.json().get("error", {}).get("message", "Access denied"))
        resp.raise_for_status()


async def list_messages(mailbox: str, top: int = 25, skip_token: Optional[str] = None,
                        folder: str = "inbox") -> Dict[str, Any]:
    params = {
        "$top": top,
        "$select": "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments",
        "$orderby": "receivedDateTime desc",
    }
    if skip_token:
        params["$skiptoken"] = skip_token
    data = await _graph_get(f"/users/{mailbox}/mailFolders/{folder}/messages", params=params)
    # surface a clean next skip token for the frontend
    next_link = data.get("@odata.nextLink")
    next_skip = None
    if next_link and "$skiptoken=" in next_link:
        next_skip = next_link.split("$skiptoken=")[1].split("&")[0]
    return {"value": data.get("value", []), "next_skip_token": next_skip}


async def get_message(mailbox: str, message_id: str) -> Dict[str, Any]:
    params = {"$select": "id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,isRead,hasAttachments,conversationId"}
    msg = await _graph_get(f"/users/{mailbox}/messages/{message_id}", params=params)
    # mark as read (best effort)
    try:
        await _graph_patch(f"/users/{mailbox}/messages/{message_id}", {"isRead": True})
    except Exception:
        pass
    return msg


async def _graph_patch(path: str, body: Dict[str, Any]) -> None:
    token = acquire_app_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(base_url=GRAPH_BASE_URL, headers=headers, timeout=30.0) as client:
        resp = await client.patch(path, json=body)
        resp.raise_for_status()


async def reply_to_message(mailbox: str, message_id: str, reply_html: str) -> None:
    """Send a threaded reply to the original sender using Graph's reply action."""
    body = {"message": {"body": {"contentType": "HTML", "content": reply_html}}}
    await _graph_post(f"/users/{mailbox}/messages/{message_id}/reply", body=body)


def default_sender_mailbox() -> Optional[str]:
    """Mailbox used as the From address for outbound notifications.

    Prefers DRIVER_NOTIFY_MAILBOX, else the first configured support mailbox.
    """
    explicit = os.environ.get("DRIVER_NOTIFY_MAILBOX")
    if explicit:
        return explicit.strip()
    boxes = get_support_mailboxes()
    return boxes[0] if boxes else None


async def send_mail(to_email: str, subject: str, html_body: str, mailbox: Optional[str] = None) -> None:
    """Send a standalone email from one of the support mailboxes via Graph."""
    sender = mailbox or default_sender_mailbox()
    if not sender:
        raise GraphNotConfigured("No sender mailbox configured (SUPPORT_MAILBOXES/DRIVER_NOTIFY_MAILBOX)")
    body = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html_body},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": True,
    }
    await _graph_post(f"/users/{sender}/sendMail", body=body)


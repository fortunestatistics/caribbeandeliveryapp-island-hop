"""Web Push (VAPID) helper.

Thin wrapper around pywebpush so the rest of the app can fire browser push
notifications without dealing with encryption details. Keys come from the
environment (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CLAIM_EMAIL).
"""
import os
import json
import logging

from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)


def send_web_push(subscription_info: dict, payload: dict) -> dict:
    """Send a single web push.

    Returns {"ok": True} on success, or {"ok": False, "gone": bool} on failure.
    `gone` is True when the subscription is expired/invalid (HTTP 404/410) and
    should be removed from storage. Env is read lazily so it works regardless of
    import vs. load_dotenv ordering.
    """
    vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
    claim_email = os.environ.get("VAPID_CLAIM_EMAIL", "mailto:support@islandhoptt.com")
    if not vapid_private_key:
        logger.warning("VAPID_PRIVATE_KEY not configured; skipping push")
        return {"ok": False, "gone": False}
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_private_key,
            vapid_claims={"sub": claim_email},
        )
        return {"ok": True, "gone": False}
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        gone = status in (404, 410)
        logger.warning(f"WebPush failed (status={status}): {exc}")
        return {"ok": False, "gone": gone}

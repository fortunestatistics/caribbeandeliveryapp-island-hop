"""Pytest suite for IslandHop P1 MVP features:
- OTP verification (Twilio mocked)
- Referral engine
- Delivery proof (driver POD)
- Service-zone management
- WhatsApp support bridge
- Admin approvals
"""
import os
import time
import uuid

import pytest
import requests

API_URL = os.environ.get("API_URL", "http://localhost:8001")
API = f"{API_URL}/api"


def _ts():
    return f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}"


def _register(suffix: str, **overrides):
    payload = {
        "email": f"{suffix}@test.com",
        "password": "Test1234!",
        "name": suffix.capitalize(),
        "user_type": "customer",
    }
    payload.update(overrides)
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


OWNER_EMAIL = "tracyfortune@islandhoptt.com"
OWNER_PASSWORD = "IslandHopAdmin2026!"


def _admin_login():
    """Public register can no longer create admins — log in as the seeded owner admin."""
    r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"owner admin login failed: {r.status_code} {r.text}"
    return r.json()


def _make_driver(suffix: str):
    """Register a customer, submit a driver application, admin-approve it, then re-login
    so the account is a real user_type=driver (new applicants are NOT auto-promoted)."""
    u = _register(suffix)
    dr = requests.post(
        f"{API}/drivers",
        json={"user_id": u["user"]["id"], "license_number": "L", "vehicle_type": "car", "vehicle_plate": "P"},
        headers=_auth(u["access_token"]), timeout=15,
    ).json()
    admin = _admin_login()
    requests.post(f"{API}/admin/drivers/{dr['id']}/approve", json={"notes": "qa"},
                  headers=_auth(admin["access_token"]), timeout=15)
    lg = requests.post(f"{API}/auth/login", json={"email": f"{suffix}@test.com", "password": "Test1234!"}, timeout=15)
    return lg.json()


# ----------------------------------------------------------------------
# OTP
# ----------------------------------------------------------------------
class TestOTP:
    def test_send_returns_dev_code_in_mock_mode(self):
        phone = f"+1868555{int(time.time()) % 10000:04d}"
        r = requests.post(f"{API}/otp/send", json={"phone": phone, "purpose": "signup"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data.get("dev_code") and len(data["dev_code"]) == 6

    def test_verify_with_correct_code(self):
        phone = f"+1868554{int(time.time()) % 10000:04d}"
        send = requests.post(f"{API}/otp/send", json={"phone": phone}).json()
        code = send["dev_code"]
        r = requests.post(f"{API}/otp/verify", json={"phone": phone, "code": code}, timeout=10)
        assert r.status_code == 200
        assert r.json()["verified"] is True

    def test_verify_with_wrong_code_fails(self):
        phone = f"+1868553{int(time.time()) % 10000:04d}"
        requests.post(f"{API}/otp/send", json={"phone": phone})
        r = requests.post(f"{API}/otp/verify", json={"phone": phone, "code": "000000"})
        assert r.status_code == 400

    def test_register_with_otp_marks_phone_verified(self):
        phone = f"+1868552{int(time.time()) % 10000:04d}"
        send = requests.post(f"{API}/otp/send", json={"phone": phone}).json()
        code = send["dev_code"]
        suffix = f"otp_user_{_ts()}"
        user = _register(suffix, phone=phone, otp_code=code)
        assert user["user"]["phone_verified"] is True


# ----------------------------------------------------------------------
# Referrals
# ----------------------------------------------------------------------
class TestReferrals:
    def test_my_code_is_generated(self):
        user = _register(f"ref_alice_{_ts()}")
        r = requests.get(f"{API}/referrals/my-code", headers=_auth(user["access_token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["code"] and len(body["code"]) >= 6
        assert body["total_referrals"] == 0

    def test_apply_referral_at_signup_links_users(self):
        alice = _register(f"refmom_{_ts()}")
        code_resp = requests.get(f"{API}/referrals/my-code", headers=_auth(alice["access_token"])).json()
        alice_code = code_resp["code"]
        bob = _register(f"refson_{_ts()}", referral_code=alice_code)
        assert bob["user"]["referral_code_used"] == alice_code
        assert bob["user"]["referred_by"] == alice["user"]["id"]

    def test_my_referrals_lists_pending(self):
        alice = _register(f"refparent_{_ts()}")
        alice_code = requests.get(f"{API}/referrals/my-code", headers=_auth(alice["access_token"])).json()["code"]
        _register(f"refchild_{_ts()}", referral_code=alice_code)
        r = requests.get(f"{API}/referrals/my-referrals", headers=_auth(alice["access_token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["total_referrals"] >= 1
        assert any(ref["status"] == "pending" for ref in data["referrals"])

    def test_cannot_apply_own_referral_code(self):
        u = _register(f"refself_{_ts()}")
        code = requests.get(f"{API}/referrals/my-code", headers=_auth(u["access_token"])).json()["code"]
        r = requests.post(f"{API}/referrals/apply", json={"code": code}, headers=_auth(u["access_token"]))
        assert r.status_code == 400

    def test_invalid_code_returns_404(self):
        u = _register(f"refbad_{_ts()}")
        r = requests.post(f"{API}/referrals/apply", json={"code": "NOPECODE"}, headers=_auth(u["access_token"]))
        assert r.status_code == 404


# ----------------------------------------------------------------------
# Proof of Delivery
# ----------------------------------------------------------------------
class TestProofOfDelivery:
    PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    def test_only_drivers_can_upload(self):
        customer = _register(f"pod_cust_{_ts()}", user_type="customer")
        r = requests.post(
            f"{API}/orders/order_fake/proof",
            json={"photo_base64": self.PX},
            headers=_auth(customer["access_token"]),
        )
        assert r.status_code == 403

    def test_missing_order_returns_404(self):
        driver = _make_driver(f"pod_drv_{_ts()}")
        r = requests.post(
            f"{API}/orders/order_missing/proof",
            json={"photo_base64": self.PX},
            headers=_auth(driver["access_token"]),
        )
        assert r.status_code == 404


# ----------------------------------------------------------------------
# Service zones
# ----------------------------------------------------------------------
class TestServiceZones:
    def _admin_token(self):
        admin = _admin_login()
        return admin["access_token"]

    def test_list_zones_is_public(self):
        r = requests.get(f"{API}/service-zones")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_can_create_zone(self):
        token = self._admin_token()
        payload = {
            "name": "POS Central",
            "polygon": [[10.6, -61.6], [10.7, -61.6], [10.7, -61.45], [10.6, -61.45]],
            "allowed_services": ["food", "taxi"],
            "active": True,
        }
        r = requests.post(f"{API}/service-zones", json=payload, headers=_auth(token))
        assert r.status_code == 200, r.text
        zone = r.json()
        assert zone["name"] == "POS Central"
        # cleanup
        requests.delete(f"{API}/service-zones/{zone['id']}", headers=_auth(token))

    def test_non_admin_cannot_create_zone(self):
        user = _register(f"zone_user_{_ts()}", user_type="customer")
        payload = {
            "name": "Test",
            "polygon": [[0, 0], [0, 1], [1, 1]],
            "allowed_services": [],
        }
        r = requests.post(f"{API}/service-zones", json=payload, headers=_auth(user["access_token"]))
        assert r.status_code == 403

    def test_point_in_polygon_check(self):
        token = self._admin_token()
        # Use coordinates far from any existing test zones to avoid cross-test contamination
        lat0, lng0 = 5.111, 5.222
        z = requests.post(
            f"{API}/service-zones",
            json={
                "name": f"Zone {_ts()}",
                "polygon": [[lat0, lng0], [lat0 + 0.1, lng0], [lat0 + 0.1, lng0 + 0.1], [lat0, lng0 + 0.1]],
                "allowed_services": ["food"],
                "active": True,
            },
            headers=_auth(token),
        ).json()

        inside_lat, inside_lng = lat0 + 0.05, lng0 + 0.05
        inside = requests.post(
            f"{API}/service-zones/check",
            json={"latitude": inside_lat, "longitude": inside_lng, "service": "food"},
        ).json()
        assert inside["in_service_area"] is True

        outside = requests.post(
            f"{API}/service-zones/check",
            json={"latitude": -89.9, "longitude": -179.9},
        ).json()
        assert outside["in_service_area"] is False

        # filtered by unsupported service — only our zone covers this point, and it doesn't allow courier
        wrong_service = requests.post(
            f"{API}/service-zones/check",
            json={"latitude": inside_lat, "longitude": inside_lng, "service": "courier"},
        ).json()
        assert wrong_service["in_service_area"] is False

        requests.delete(f"{API}/service-zones/{z['id']}", headers=_auth(token))


# ----------------------------------------------------------------------
# WhatsApp bridge
# ----------------------------------------------------------------------
class TestWhatsApp:
    def test_inbound_webhook_records_message(self):
        phone = f"+186811{int(time.time()) % 100000:05d}"
        r = requests.post(
            f"{API}/webhook/whatsapp",
            data={"From": f"whatsapp:{phone}", "Body": "Hello support", "MessageSid": f"SM{_ts()}"},
        )
        # Twilio expects a TwiML (XML) 200 response, not JSON.
        assert r.status_code == 200
        assert "<Response" in r.text
        # Verify the inbound message was actually recorded (admin can see the conversation).
        admin = _admin_login()
        convos = requests.get(f"{API}/whatsapp/conversations", headers=_auth(admin["access_token"])).json()
        assert any(phone[-7:] in (c.get("phone") or "") for c in convos), \
            f"inbound message from {phone} not recorded in conversations"

    def test_only_admin_can_send_outbound(self):
        user = _register(f"wa_user_{_ts()}", user_type="customer")
        r = requests.post(
            f"{API}/whatsapp/send",
            json={"to": "+18681112222", "body": "test"},
            headers=_auth(user["access_token"]),
        )
        assert r.status_code == 403

    def test_admin_can_send_outbound(self):
        admin = _admin_login()
        r = requests.post(
            f"{API}/whatsapp/send",
            json={"to": "+18681113333", "body": "Hi from support"},
            headers=_auth(admin["access_token"]),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["message"]["direction"] == "outbound"

    def test_admin_can_list_conversations(self):
        admin = _admin_login()
        # seed one inbound
        phone = f"+186812{int(time.time()) % 100000:05d}"
        requests.post(f"{API}/webhook/whatsapp", data={"From": f"whatsapp:{phone}", "Body": "hi"})
        r = requests.get(f"{API}/whatsapp/conversations", headers=_auth(admin["access_token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----------------------------------------------------------------------
# Admin approvals
# ----------------------------------------------------------------------
class TestAdminApprovals:
    def test_pending_approvals_endpoint(self):
        admin = _admin_login()
        r = requests.get(f"{API}/admin/pending-approvals", headers=_auth(admin["access_token"]))
        assert r.status_code == 200
        body = r.json()
        for k in ("drivers", "restaurants", "car_rentals", "businesses", "total"):
            assert k in body

    def test_non_admin_blocked(self):
        user = _register(f"appr_user_{_ts()}", user_type="customer")
        r = requests.get(f"{API}/admin/pending-approvals", headers=_auth(user["access_token"]))
        assert r.status_code == 403

    def test_approve_missing_driver_returns_404(self):
        admin = _admin_login()
        r = requests.post(
            f"{API}/admin/drivers/nope_id/approve",
            json={"notes": "test"},
            headers=_auth(admin["access_token"]),
        )
        assert r.status_code == 404

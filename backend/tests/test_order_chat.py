"""Tests for the 3-party order chat (customer ↔ driver ↔ merchant)."""
import time
import uuid
import requests


def _register(base_url, user_type="customer", name=None):
    email = f"chat_{user_type}_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
    r = requests.post(
        f"{base_url}/api/auth/register",
        json={
            "email": email,
            "password": "Test1234!",
            "name": name or f"QA {user_type.title()}",
            "user_type": user_type,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return {"email": email, "user_id": body["user"]["id"], "token": body["access_token"]}


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _make_restaurant(base_url, token, user_id):
    r = requests.post(
        f"{base_url}/api/restaurants",
        headers=_hdr(token),
        json={
            "user_id": user_id,
            "name": "Test Pizza",
            "description": "x",
            "cuisine_type": "x",
            "address": {"street": "x"},
            "phone": "1",
            "email": f"r_{uuid.uuid4().hex[:6]}@x.com",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _make_driver(base_url, token, user_id):
    r = requests.post(
        f"{base_url}/api/drivers",
        headers=_hdr(token),
        json={
            "user_id": user_id,
            "license_number": "L1",
            "vehicle_type": "car",
            "vehicle_plate": "P1",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _make_order(base_url, cust_token, restaurant_id, driver_id, total=23.0):
    r = requests.post(
        f"{base_url}/api/orders",
        headers=_hdr(cust_token),
        json={
            "customer_id": "x",
            "restaurant_id": restaurant_id,
            "driver_id": driver_id,
            "service_type": "food",
            "items": [{"menu_item_id": "a", "name": "P", "quantity": 1, "price": total}],
            "subtotal": total,
            "delivery_fee": 3,
            "total": total + 3,
            "pickup_address": {},
            "delivery_address": {},
            "customer_phone": "+1",
            "payment_method": "card",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _setup_three_party(base_url):
    cust = _register(base_url, "customer", "ChatCustomer")
    rest_owner = _register(base_url, "restaurant", "ChatMerchant")
    drv_owner = _register(base_url, "driver", "ChatDriver")
    rid = _make_restaurant(base_url, rest_owner["token"], rest_owner["user_id"])
    did = _make_driver(base_url, drv_owner["token"], drv_owner["user_id"])
    oid = _make_order(base_url, cust["token"], rid, did)
    return {"customer": cust, "merchant": rest_owner, "driver": drv_owner, "order_id": oid}


class TestOrderChat:
    def test_three_parties_can_send_and_read(self, base_url):
        ctx = _setup_three_party(base_url)
        oid = ctx["order_id"]

        # Customer sends
        r = requests.post(
            f"{base_url}/api/chat/send",
            headers=_hdr(ctx["customer"]["token"]),
            json={"order_id": oid, "message": "Hi, please rush"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["sender_user_type"] == "customer"

        # Merchant sends
        r = requests.post(
            f"{base_url}/api/chat/send",
            headers=_hdr(ctx["merchant"]["token"]),
            json={"order_id": oid, "message": "Cooking now"},
        )
        assert r.status_code == 200
        assert r.json()["sender_user_type"] == "vendor"

        # Driver sends
        r = requests.post(
            f"{base_url}/api/chat/send",
            headers=_hdr(ctx["driver"]["token"]),
            json={"order_id": oid, "message": "Picking up"},
        )
        assert r.status_code == 200
        assert r.json()["sender_user_type"] == "driver"

        # All three can read all three messages
        for party_key in ("customer", "merchant", "driver"):
            r = requests.get(
                f"{base_url}/api/chat/{oid}/messages",
                headers=_hdr(ctx[party_key]["token"]),
            )
            assert r.status_code == 200, r.text
            msgs = r.json()
            assert len(msgs) == 3, f"{party_key} sees {len(msgs)} msgs"
            roles = [m["sender_user_type"] for m in msgs]
            assert roles == ["customer", "vendor", "driver"]

    def test_non_participant_403(self, base_url):
        ctx = _setup_three_party(base_url)
        oid = ctx["order_id"]
        stranger = _register(base_url, "customer", "Stranger")

        r = requests.get(f"{base_url}/api/chat/{oid}/messages", headers=_hdr(stranger["token"]))
        assert r.status_code == 403

        r = requests.post(
            f"{base_url}/api/chat/send",
            headers=_hdr(stranger["token"]),
            json={"order_id": oid, "message": "hack"},
        )
        assert r.status_code == 403

    def test_unread_count_drops_after_read(self, base_url):
        ctx = _setup_three_party(base_url)
        oid = ctx["order_id"]
        # Driver sends a message
        requests.post(
            f"{base_url}/api/chat/send",
            headers=_hdr(ctx["driver"]["token"]),
            json={"order_id": oid, "message": "Outside"},
        )
        # Customer's unread count is 1
        r = requests.get(f"{base_url}/api/chat/{oid}/unread-count", headers=_hdr(ctx["customer"]["token"]))
        assert r.status_code == 200
        assert r.json()["unread"] == 1
        # Customer reads thread
        requests.get(f"{base_url}/api/chat/{oid}/messages", headers=_hdr(ctx["customer"]["token"]))
        # Now unread = 0
        r = requests.get(f"{base_url}/api/chat/{oid}/unread-count", headers=_hdr(ctx["customer"]["token"]))
        assert r.json()["unread"] == 0

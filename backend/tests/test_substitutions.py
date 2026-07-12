"""Tests for vendor substitution proposals (chat-integrated)."""
import time
import uuid
import requests


def _register(base_url, user_type="customer", name=None):
    email = f"sub_{user_type}_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
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


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _setup(base_url):
    cust = _register(base_url, "customer")
    rest_owner = _register(base_url, "restaurant")
    drv_owner = _register(base_url, "driver")
    rid = requests.post(
        f"{base_url}/api/restaurants",
        headers=_hdr(rest_owner["token"]),
        json={
            "user_id": rest_owner["user_id"],
            "name": "Sub Pizza",
            "description": "x",
            "cuisine_type": "x",
            "address": {"street": "x"},
            "phone": "1",
            "email": f"r_{uuid.uuid4().hex[:6]}@x.com",
        },
        timeout=30,
    ).json()["id"]
    did = requests.post(
        f"{base_url}/api/drivers",
        headers=_hdr(drv_owner["token"]),
        json={"user_id": drv_owner["user_id"], "license_number": "L", "vehicle_type": "car", "vehicle_plate": "P"},
        timeout=30,
    ).json()["id"]
    oid = requests.post(
        f"{base_url}/api/orders",
        headers=_hdr(cust["token"]),
        json={
            "customer_id": "x",
            "restaurant_id": rid,
            "driver_id": did,
            "service_type": "food",
            "items": [{"menu_item_id": "a", "name": "Margherita Pizza", "quantity": 1, "price": 20}],
            "subtotal": 20,
            "delivery_fee": 3,
            "total": 23,
            "pickup_address": {},
            "delivery_address": {},
            "customer_phone": "+1",
            "payment_method": "card",
        },
        timeout=30,
    ).json()["id"]
    return {"customer": cust, "merchant": rest_owner, "driver": drv_owner, "order_id": oid}


def _order_total(base_url, oid, token):
    return round(requests.get(f"{base_url}/api/orders/{oid}", headers=_hdr(token)).json()["total"], 2)


class TestSubstitutions:
    def test_merchant_proposes_then_customer_accepts(self, base_url):
        ctx = _setup(base_url)
        oid = ctx["order_id"]
        base_total = _order_total(base_url, oid, ctx["customer"]["token"])

        # Merchant proposes a swap (+$1.50)
        r = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions",
            headers=_hdr(ctx["merchant"]["token"]),
            json={
                "order_id": oid,
                "original_item_name": "Margherita Pizza",
                "proposed_item_name": "Pepperoni Pizza",
                "price_delta": 1.50,
                "note": "Same toppings, fresher batch",
            },
        )
        assert r.status_code == 200, r.text
        prop = r.json()
        assert prop["status"] == "pending"
        assert prop["proposed_item_name"] == "Pepperoni Pizza"

        # System message should have been posted to chat
        msgs = requests.get(f"{base_url}/api/chat/{oid}/messages", headers=_hdr(ctx["customer"]["token"])).json()
        assert any(m["sender_user_type"] == "system" and "Pepperoni Pizza" in m["message"] for m in msgs)

        # Customer accepts
        r = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions/{prop['id']}/respond?accept=true",
            headers=_hdr(ctx["customer"]["token"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"

        # Order should reflect new item + total = base + 1.50
        order = requests.get(f"{base_url}/api/orders/{oid}", headers=_hdr(ctx["customer"]["token"])).json()
        assert any(i["name"] == "Pepperoni Pizza" for i in order["items"])
        assert round(order["total"], 2) == round(base_total + 1.50, 2)

    def test_customer_declines_no_total_change(self, base_url):
        ctx = _setup(base_url)
        oid = ctx["order_id"]
        base_total = _order_total(base_url, oid, ctx["customer"]["token"])

        prop = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions",
            headers=_hdr(ctx["merchant"]["token"]),
            json={
                "order_id": oid,
                "original_item_name": "Margherita Pizza",
                "proposed_item_name": "Calzone",
                "price_delta": 0,
                "note": None,
            },
        ).json()

        r = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions/{prop['id']}/respond?accept=false",
            headers=_hdr(ctx["customer"]["token"]),
        )
        assert r.status_code == 200
        assert r.json()["status"] == "declined"
        # Order unchanged
        order = requests.get(f"{base_url}/api/orders/{oid}", headers=_hdr(ctx["customer"]["token"])).json()
        assert any(i["name"] == "Margherita Pizza" for i in order["items"])
        assert round(order["total"], 2) == base_total

    def test_only_merchant_can_propose(self, base_url):
        ctx = _setup(base_url)
        oid = ctx["order_id"]
        # Customer tries to propose -> 403
        r = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions",
            headers=_hdr(ctx["customer"]["token"]),
            json={"order_id": oid, "original_item_name": "x"},
        )
        assert r.status_code == 403

    def test_only_customer_can_respond(self, base_url):
        ctx = _setup(base_url)
        oid = ctx["order_id"]
        prop = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions",
            headers=_hdr(ctx["merchant"]["token"]),
            json={"order_id": oid, "original_item_name": "Margherita Pizza"},
        ).json()
        # Driver tries to respond -> 403
        r = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions/{prop['id']}/respond?accept=true",
            headers=_hdr(ctx["driver"]["token"]),
        )
        assert r.status_code == 403

    def test_unavailable_item_marker(self, base_url):
        ctx = _setup(base_url)
        oid = ctx["order_id"]
        base_total = _order_total(base_url, oid, ctx["customer"]["token"])
        prop = requests.post(
            f"{base_url}/api/orders/{oid}/substitutions",
            headers=_hdr(ctx["merchant"]["token"]),
            json={
                "order_id": oid,
                "original_item_name": "Margherita Pizza",
                "proposed_item_name": None,
                "price_delta": -20,
            },
        ).json()
        # Customer accepts unavailable -> item quantity 0, total drops
        requests.post(
            f"{base_url}/api/orders/{oid}/substitutions/{prop['id']}/respond?accept=true",
            headers=_hdr(ctx["customer"]["token"]),
        )
        order = requests.get(f"{base_url}/api/orders/{oid}", headers=_hdr(ctx["customer"]["token"])).json()
        assert round(order["total"], 2) == round(base_total - 20, 2)  # remove a $20 item

    def test_unread_summary_aggregates_orders(self, base_url):
        ctx = _setup(base_url)
        oid = ctx["order_id"]
        # Driver sends 2 messages
        for body in ("Hi", "On my way"):
            requests.post(
                f"{base_url}/api/chat/send",
                headers=_hdr(ctx["driver"]["token"]),
                json={"order_id": oid, "message": body},
            )
        # Customer's summary should show 2 unread on 1 order
        r = requests.get(f"{base_url}/api/chat/unread/summary", headers=_hdr(ctx["customer"]["token"]))
        assert r.status_code == 200
        summary = r.json()
        assert summary["unread_total"] == 2
        assert any(o["order_id"] == oid and o["unread"] == 2 for o in summary["orders_with_unread"])

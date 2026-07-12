"""Admin Partner-Approvals & records domain.

Extracted from server.py. Owns the admin endpoints for browsing partner/user
records, viewing their order history & documents, the pending-approvals
aggregate, and the approve/reject actions for drivers, restaurants, car-rental
companies and businesses.

Domain-local helpers live here. A few widely-shared helpers (WhatsApp/driver
notifications and promoter-reward settlement) remain in server.py and are
imported lazily inside the handlers to avoid an import cycle.
"""
import os
import re
import uuid
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

import graph_mail
from core import db, get_current_user_from_request, promote_user_role

router = APIRouter(prefix="/api")


class ApprovalAction(BaseModel):
    notes: Optional[str] = None


def _flatten_pending(items: List[dict], kind: str) -> List[dict]:
    rows = []
    for item in items:
        item.pop("_id", None)
        rows.append({
            "id": item.get("id"),
            "kind": kind,
            "name": item.get("name") or item.get("company_name") or item.get("business_name") or item.get("business_details", {}).get("business_name"),
            "email": item.get("email") or item.get("contact_info", {}).get("email") or item.get("business_owner", {}).get("email"),
            "phone": item.get("phone") or item.get("contact_info", {}).get("phone") or item.get("business_owner", {}).get("phone"),
            "status": item.get("status") or item.get("verification_status"),
            "user_id": item.get("user_id"),
            "source": item.get("source"),
            "is_external_lead": item.get("is_external_lead", False),
            "created_at": item.get("created_at") or item.get("application_date"),
            "raw": item,
        })
    return rows


# ============================================================
# ADMIN "APPROVALS" — full records by category + order history
# ============================================================
_RECORD_CATEGORIES = {
    "restaurants": {"collection": "restaurants", "status_field": "status"},
    "drivers": {"collection": "drivers", "status_field": "status"},
    "car_rentals": {"collection": "car_rental_companies", "status_field": "status"},
    "businesses": {"collection": "business_applications", "status_field": "verification_status"},
    "shops": {"collection": "businesses", "status_field": "status"},
    "users": {"collection": "users", "status_field": "status"},
}
_USER_SENSITIVE_FIELDS = ("hashed_password", "password", "session_token")


def _record_summary(doc: dict, category: str) -> dict:
    """Curated top-line fields for the list row; `full` carries every submitted field."""
    pi = doc.get("personal_info") or {}
    bd = doc.get("business_details") or {}
    bo = doc.get("business_owner") or {}
    ci = doc.get("contact_info") or {}
    status = doc.get(_RECORD_CATEGORIES[category]["status_field"])
    base = {
        "id": doc.get("id"),
        "user_id": doc.get("user_id"),
        "status": status,
        "is_external_lead": bool(doc.get("is_external_lead")),
        "source": doc.get("source"),
        "created_at": doc.get("created_at") or doc.get("application_date"),
    }
    if category == "restaurants":
        base.update({"name": doc.get("name"), "email": doc.get("email"), "phone": doc.get("phone"),
                     "subtitle": doc.get("cuisine_type"), "subscription_tier": doc.get("subscription_tier"),
                     "featured": bool(doc.get("featured"))})
    elif category == "drivers":
        base.update({"name": doc.get("name") or pi.get("name"), "email": doc.get("email") or pi.get("email"),
                     "phone": doc.get("phone") or pi.get("phone"),
                     "subtitle": " · ".join([x for x in [doc.get("vehicle_type"), doc.get("vehicle_plate")] if x]) or None})
    elif category == "car_rentals":
        base.update({"name": doc.get("company_name"), "email": ci.get("email"), "phone": ci.get("phone"),
                     "subtitle": f"{len(doc.get('fleet') or [])} vehicles"})
    elif category == "businesses":
        base.update({"name": doc.get("business_name") or bd.get("business_name"),
                     "email": doc.get("email") or bo.get("email"), "phone": doc.get("phone") or bo.get("phone"),
                     "subtitle": bd.get("business_type") or doc.get("business_type"),
                     "owner_name": bo.get("name")})
    elif category == "shops":
        base.update({"name": doc.get("business_name"),
                     "email": doc.get("email"), "phone": doc.get("phone"),
                     "subtitle": doc.get("business_type")})
    elif category == "users":
        base.update({"name": doc.get("name"), "email": doc.get("email"), "phone": doc.get("phone"),
                     "subtitle": doc.get("user_type"), "user_type": doc.get("user_type")})
        base["status"] = doc.get("status") or "active"
    return base


def _clean_full(doc: dict, category: str) -> dict:
    full = {k: v for k, v in doc.items() if k != "_id"}
    if category == "users":
        for f in _USER_SENSITIVE_FIELDS:
            full.pop(f, None)
    return full


@router.get("/admin/records/{category}")
async def admin_list_records(category: str, request: Request, q: Optional[str] = None, status: Optional[str] = None, limit: int = 500):
    """Admin: all records of a category (any status) with full submitted data.
    category ∈ restaurants | drivers | car_rentals | businesses | users.
    Optional `status` filter: 'pending' (new applications) or a specific status; ignored for users."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin access required")
    if category not in _RECORD_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown category")
    coll = db[_RECORD_CATEGORIES[category]["collection"]]
    query: Dict[str, Any] = {}
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        fields = {
            "restaurants": ["name", "email", "phone"],
            "drivers": ["name", "email", "phone", "license_number", "vehicle_plate"],
            "car_rentals": ["company_name"],
            "businesses": ["business_name", "email", "phone"],
            "shops": ["business_name", "email", "phone"],
            "users": ["name", "email", "phone"],
        }[category]
        query = {"$or": [{f: rx} for f in fields]}
    st = (status or "").lower().strip()
    if st and st != "all" and category != "users":
        sf = _RECORD_CATEGORIES[category]["status_field"]
        query[sf] = {"$in": ["pending", "pending_approval"]} if st == "pending" else st
    cap = min(limit, 2000)
    records = []
    async for doc in coll.find(query, {"_id": 0}).sort("created_at", -1).limit(cap):
        rec = _record_summary(doc, category)
        rec["full"] = _clean_full(doc, category)
        records.append(rec)

    # Per-row document summary so reviewers can spot incomplete applications at a glance.
    # Batched: one aggregation for all applicants' personal (user_account) docs.
    acct_by_user: Dict[str, int] = {}
    if category != "users":
        uids = [r.get("user_id") for r in records if r.get("user_id")]
        # Driver docs carry no name/email — enrich each row from the linked user account.
        if category == "drivers" and uids:
            users_by_id: Dict[str, dict] = {}
            async for u in db.users.find(
                {"id": {"$in": uids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}
            ):
                users_by_id[u["id"]] = u
            for r in records:
                u = users_by_id.get(r.get("user_id"))
                if u:
                    r["name"] = r.get("name") or u.get("name")
                    r["email"] = r.get("email") or u.get("email")
                    r["phone"] = r.get("phone") or u.get("phone")
        if uids:
            agg = db.driver_documents.aggregate([
                {"$match": {"user_id": {"$in": uids}, "is_deleted": False}},
                {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
            ])
            async for row in agg:
                acct_by_user[row["_id"]] = row["count"]
        for r in records:
            full = r.get("full") or {}
            if category == "drivers":
                merchant_count = 0
            else:
                raw = full.get("documents") or (full.get("business_details") or {}).get("documents") or {}
                merchant_count = _count_url_docs(raw)
            account_count = acct_by_user.get(r.get("user_id"), 0)
            r["doc_summary"] = {
                "merchant_count": merchant_count,
                "user_account_count": account_count,
                "total": merchant_count + account_count,
                # merchant applicants should attach a personal ID/licence; flag when missing
                "has_account_doc": account_count > 0,
            }
    return {"category": category, "count": len(records), "records": records}


@router.get("/admin/records/{category}/{record_id}/orders")
async def admin_record_orders(category: str, record_id: str, request: Request, limit: int = 500):
    """Admin: full order (or rental booking) history associated with a record."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin access required")
    if category not in _RECORD_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown category")
    cap = min(limit, 2000)
    if category == "car_rentals":
        bookings = await db.rental_bookings.find(
            {"rental_company_id": record_id}, {"_id": 0}
        ).sort("created_at", -1).limit(cap).to_list(length=cap)
        return {"type": "rental", "count": len(bookings), "orders": bookings}
    order_query = {
        "restaurants": {"restaurant_id": record_id},
        "drivers": {"driver_id": record_id},
        "businesses": {"$or": [{"vendor_id": record_id}, {"restaurant_id": record_id}]},
        "shops": {"$or": [{"vendor_id": record_id}, {"business_id": record_id}]},
        "users": {"customer_id": record_id},
    }[category]
    orders = await db.orders.find(order_query, {"_id": 0}).sort("created_at", -1).limit(cap).to_list(length=cap)
    return {"type": "order", "count": len(orders), "orders": orders}


_IMAGE_EXTS = ("png", "jpg", "jpeg", "webp", "gif", "heic", "heif")


def _looks_like_image(name: str) -> bool:
    if not name:
        return False
    tail = name.split("?")[0].lower().rsplit(".", 1)
    return len(tail) == 2 and tail[1] in _IMAGE_EXTS


def _count_url_docs(raw) -> int:
    """Count non-empty merchant/application document URLs from a dict or list field."""
    if isinstance(raw, dict):
        return sum(1 for v in raw.values() if v)
    if isinstance(raw, list):
        n = 0
        for it in raw:
            if isinstance(it, dict):
                if it.get("url") or it.get("value") or it.get("file_url"):
                    n += 1
            elif it:
                n += 1
        return n
    return 0


@router.get("/admin/records/{category}/{record_id}/documents")
async def admin_record_documents(category: str, record_id: str, request: Request):
    """Admin: list uploaded documents for an applicant, split into two groups:
      - group='merchant': the business/restaurant/rental application documents
        (Business Registration, Health Permits, Store Photos, etc.) — direct URLs.
      - group='user_account': the applicant/owner's personal account documents
        (Personal ID, Driver's License) from driver_documents, streamed via
        /drivers/documents/{id}/download.
    """
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin access required")
    if category not in _RECORD_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown category")

    def _url_docs(raw, group: str):
        out = []
        items = []
        if isinstance(raw, dict):
            items = [{"label": k, "url": v} for k, v in raw.items() if v]
        elif isinstance(raw, list):
            for it in raw:
                if isinstance(it, dict):
                    items.append({
                        "label": it.get("label") or it.get("doc_type") or it.get("type") or "document",
                        "url": it.get("url") or it.get("value") or it.get("file_url"),
                    })
                elif it:
                    items.append({"label": "document", "url": it})
        for it in items:
            url = it.get("url") or ""
            if url:
                out.append({"kind": "url", "label": it.get("label"), "url": url,
                            "is_image": _looks_like_image(url), "group": group})
        return out

    async def _user_account_docs(uid: str):
        out = []
        async for d in db.driver_documents.find(
            {"user_id": uid, "is_deleted": False},
            {"_id": 0, "id": 1, "doc_type": 1, "original_filename": 1, "content_type": 1},
        ):
            fn = d.get("original_filename") or ""
            out.append({
                "kind": "driver_doc",
                "document_id": d["id"],
                "doc_type": d.get("doc_type"),
                "filename": fn,
                "is_image": (str(d.get("content_type") or "").startswith("image/") or _looks_like_image(fn)),
                "group": "user_account",
            })
        return out

    coll_name = _RECORD_CATEGORIES[category]["collection"]
    rec = await db[coll_name].find_one({"id": record_id}, {"_id": 0})
    uid = rec.get("user_id") if rec else None
    docs = []

    if category == "drivers":
        # A driver's uploaded docs (license/ID) ARE their account documents.
        if uid:
            docs += await _user_account_docs(uid)
    else:
        # Merchant / restaurant / rental application documents.
        if rec:
            raw = rec.get("documents") or (rec.get("business_details") or {}).get("documents") or {}
            docs += _url_docs(raw, "merchant")
        # PLUS the owner/applicant's personal account documents (Personal ID, Licence).
        if uid:
            docs += await _user_account_docs(uid)

    merchant_count = sum(1 for d in docs if d.get("group") == "merchant")
    account_count = sum(1 for d in docs if d.get("group") == "user_account")
    return {
        "documents": docs,
        "count": len(docs),
        "merchant_count": merchant_count,
        "user_account_count": account_count,
    }


@router.get("/admin/users/{user_id}/documents")
async def admin_user_documents(user_id: str, request: Request):
    """Admin: all uploaded documents for a user (driver docs + business/restaurant docs),
    plus the linked applicant record (for the review-gated Approve/Reject in User Management)."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin access required")
    docs = []
    async for d in db.driver_documents.find(
        {"user_id": user_id, "is_deleted": False},
        {"_id": 0, "id": 1, "doc_type": 1, "original_filename": 1, "content_type": 1},
    ):
        fn = d.get("original_filename") or ""
        docs.append({
            "kind": "driver_doc", "document_id": d["id"], "doc_type": d.get("doc_type"),
            "filename": fn,
            "is_image": (str(d.get("content_type") or "").startswith("image/") or _looks_like_image(fn)),
        })
    for coll in ("business_applications", "restaurants"):
        rec = await db[coll].find_one({"user_id": user_id}, {"_id": 0})
        if not rec:
            continue
        raw = rec.get("documents") or (rec.get("business_details") or {}).get("documents") or {}
        if isinstance(raw, dict):
            for k, v in raw.items():
                if v:
                    docs.append({"kind": "url", "label": k, "url": v, "is_image": _looks_like_image(v)})
        elif isinstance(raw, list):
            for it in raw:
                url = (it.get("url") or it.get("value") or it.get("file_url")) if isinstance(it, dict) else it
                if url:
                    label = (it.get("label") or it.get("doc_type") or it.get("type") or "document") if isinstance(it, dict) else "document"
                    docs.append({"kind": "url", "label": label, "url": url, "is_image": _looks_like_image(url)})
    # Resolve the applicant record so the profile can offer review-gated Approve/Reject.
    applicant = None
    drv = await db.drivers.find_one({"user_id": user_id}, {"_id": 0, "id": 1, "status": 1})
    if drv:
        applicant = {"kind": "driver", "record_id": drv["id"], "status": drv.get("status")}
    else:
        rest = await db.restaurants.find_one({"user_id": user_id}, {"_id": 0, "id": 1, "status": 1})
        if rest:
            applicant = {"kind": "restaurant", "record_id": rest["id"], "status": rest.get("status")}
        else:
            biz = await db.business_applications.find_one({"user_id": user_id}, {"_id": 0, "id": 1, "verification_status": 1})
            if biz:
                applicant = {"kind": "business", "record_id": biz["id"], "status": biz.get("verification_status")}
    return {"documents": docs, "count": len(docs), "applicant": applicant}


@router.get("/admin/pending-approvals")
async def admin_pending_approvals(request: Request):
    """Aggregate pending drivers, restaurants, car rentals, and business onboarding applications."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    drivers = await db.drivers.find({"status": {"$in": ["pending", "pending_approval"]}}).limit(1000).to_list(length=1000)
    restaurants = await db.restaurants.find({"status": {"$in": ["pending", "pending_approval"]}}).limit(1000).to_list(length=1000)
    rentals = await db.car_rental_companies.find({"status": {"$in": ["pending", "pending_approval"]}}).limit(1000).to_list(length=1000)
    businesses = await db.business_applications.find({"verification_status": "pending"}).limit(1000).to_list(length=1000)

    return {
        "drivers": _flatten_pending(drivers, "driver"),
        "restaurants": _flatten_pending(restaurants, "restaurant"),
        "car_rentals": _flatten_pending(rentals, "car_rental"),
        "businesses": _flatten_pending(businesses, "business"),
        "total": len(drivers) + len(restaurants) + len(rentals) + len(businesses),
    }


async def _set_partner_status(collection_name: str, entity_id: str, new_status: str, current_user_id: str, notes: Optional[str], status_field: str = "status"):
    coll = db[collection_name]
    existing = await coll.find_one({"id": entity_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"{collection_name[:-1]} not found")
    update = {status_field: new_status, "reviewed_by": current_user_id, "reviewed_at": datetime.now(timezone.utc).isoformat()}
    if notes is not None:
        update["review_notes"] = notes
    await coll.update_one({"id": entity_id}, {"$set": update})
    return {"success": True, "id": entity_id, status_field: new_status}


@router.post("/admin/drivers/{driver_id}/approve")
async def admin_approve_driver(driver_id: str, payload: ApprovalAction, request: Request):
    from server import _notify_driver_status, _award_promo_reward, _release_held_promo_rewards
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("drivers", driver_id, "active", current_user.id, payload.notes)
    # Promote the user to a driver now that identity has been reviewed & approved.
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "user_id": 1})
    if driver and driver.get("user_id"):
        await promote_user_role(driver["user_id"], "driver")
        await _notify_driver_status(driver["user_id"], "approved")
        await _award_promo_reward(driver["user_id"], "driver", "driver_approved", require_first_order=True)
        await _release_held_promo_rewards(driver["user_id"])
    return result


@router.post("/admin/drivers/{driver_id}/reject")
async def admin_reject_driver(driver_id: str, payload: ApprovalAction, request: Request):
    from server import _notify_driver_status
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("drivers", driver_id, "rejected", current_user.id, payload.notes)
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "user_id": 1})
    if driver and driver.get("user_id"):
        await _notify_driver_status(driver["user_id"], "rejected", payload.notes)
    return result


@router.post("/admin/restaurants/{restaurant_id}/approve")
async def admin_approve_restaurant(restaurant_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("restaurants", restaurant_id, "active", current_user.id, payload.notes)


@router.post("/admin/restaurants/{restaurant_id}/reject")
async def admin_reject_restaurant(restaurant_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("restaurants", restaurant_id, "rejected", current_user.id, payload.notes)


@router.post("/admin/car-rentals/{company_id}/approve")
async def admin_approve_rental(company_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("car_rental_companies", company_id, "active", current_user.id, payload.notes)


@router.post("/admin/car-rentals/{company_id}/reject")
async def admin_reject_rental(company_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("car_rental_companies", company_id, "rejected", current_user.id, payload.notes)


@router.post("/admin/businesses/{application_id}/approve")
async def admin_approve_business(application_id: str, payload: ApprovalAction, request: Request):
    from server import _award_promo_reward, _release_held_promo_rewards
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("business_applications", application_id, "verified", current_user.id, payload.notes, status_field="verification_status")
    app_doc = await db.business_applications.find_one({"id": application_id}, {"_id": 0})
    if app_doc:
        await _provision_merchant_vendor(app_doc)
    await _notify_merchant_status(application_id, "verified", payload.notes)
    if app_doc and app_doc.get("user_id"):
        btype = str((app_doc.get("business_details", {}) or {}).get("business_type", "") or app_doc.get("business_type", "")).lower()
        rtype = "supplier" if "supplier" in btype else "merchant"
        await _award_promo_reward(app_doc["user_id"], rtype, "business_approved", require_first_order=True)
        await _release_held_promo_rewards(app_doc["user_id"])
    return result


@router.post("/admin/businesses/{application_id}/reject")
async def admin_reject_business(application_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("business_applications", application_id, "rejected", current_user.id, payload.notes, status_field="verification_status")
    await _notify_merchant_status(application_id, "rejected", payload.notes)
    return result


async def _notify_merchant_status(application_id: str, decision: str, notes: Optional[str] = None):
    """WhatsApp-first notification to a merchant on an application decision. Never raises."""
    from server import _wa_notify
    try:
        app_doc = await db.business_applications.find_one({"id": application_id}, {"_id": 0})
        if not app_doc:
            return
        phone = app_doc.get("phone") or app_doc.get("business_owner", {}).get("phone")
        biz = app_doc.get("business_name") or app_doc.get("name") or "your business"
        bodies = {
            "verified": (f"🎉 Great news! {biz} is now APPROVED on IslandHop. You can log in to manage your menu/listings "
                         f"and receive orders. Reply to this WhatsApp to stay connected for future updates. 🌴"),
            "rejected": (f"Update on your IslandHop application for {biz}: we're unable to approve it at this time."
                         + (f" Reason: {notes}" if notes else "") + " Reply here if you'd like to reapply."),
        }
        body = bodies.get(decision)
        if phone and body:
            await _wa_notify(phone, body, user_id=app_doc.get("user_id"), event=f"merchant_{decision}")
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"Merchant WhatsApp notification ({decision}) failed for {application_id}: {exc}")

    # Email fallback/parallel — WhatsApp requires the customer to have messaged first
    # (24h window), so email is the reliable channel for the approval notice.
    try:
        app_doc = await db.business_applications.find_one({"id": application_id}, {"_id": 0})
        if not app_doc:
            return
        email = app_doc.get("email") or (app_doc.get("business_owner", {}) or {}).get("email")
        if not email or not graph_mail.is_real_email(email):
            return
        biz = app_doc.get("business_name") or app_doc.get("name") or "your business"
        portal_url = f"{os.environ.get('FRONTEND_URL', '').rstrip('/')}/vendor-dashboard"
        if decision == "verified":
            subject = f"You're approved on IslandHop — set up {biz} 🎉"
            html = (
                f"<p>Great news! <strong>{biz}</strong> has been approved on IslandHop.</p>"
                f"<p>Log in and open your <strong>Merchant Portal</strong> to build your storefront, "
                f"add your menu/listings and start receiving orders:</p>"
                f'<p><a href="{portal_url}" style="background:#FF6A00;color:#fff;padding:10px 18px;'
                f'border-radius:8px;text-decoration:none;">Open my Merchant Portal</a></p>'
                f'<p>Or go to <a href="{portal_url}">{portal_url}</a> after signing in.</p>'
                f"<p>Welcome aboard! 🌴<br/>The IslandHop Team</p>"
            )
        elif decision == "rejected":
            subject = f"Update on your IslandHop application for {biz}"
            html = (
                f"<p>Thanks for applying to IslandHop with <strong>{biz}</strong>.</p>"
                f"<p>Unfortunately we're unable to approve your application at this time."
                + (f" Reason: {notes}" if notes else "")
                + "</p><p>Reply to this email if you'd like to reapply or need clarification.</p>"
            )
        else:
            return
        await graph_mail.send_mail(email, subject, html, mailbox=graph_mail.notify_mailbox("merchant"))
    except graph_mail.GraphNotConfigured:
        pass
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"Merchant email notification ({decision}) failed for {application_id}: {exc}")


async def _provision_merchant_vendor(app_doc: dict):
    """On approval, create the actual vendor record (so the Merchant Portal & storefront
    work) and promote the applicant's account role. Idempotent — never duplicates."""
    uid = app_doc.get("user_id")
    if not uid:
        return  # external lead with no account yet — nothing to provision
    details = app_doc.get("business_details", {}) or {}
    btype = str(details.get("business_type") or app_doc.get("business_type") or "").lower().strip()
    owner = app_doc.get("business_owner", {}) or {}
    name = app_doc.get("business_name") or details.get("business_name") or owner.get("name") or "My Business"
    description = details.get("business_description") or details.get("description") or ""
    email = app_doc.get("email") or owner.get("email") or ""
    phone = app_doc.get("phone") or owner.get("phone") or ""
    address = details.get("address") if isinstance(details.get("address"), dict) else {
        "street": details.get("address") or "", "city": details.get("city") or "",
        "parish": "", "country": "Trinidad & Tobago",
    }
    now = datetime.now(timezone.utc).isoformat()
    food_types = {"restaurant", "food", "cafe", "bakery", "bar", "eatery"}

    if btype in food_types:
        if not await db.restaurants.find_one({"user_id": uid}, {"_id": 1}):
            await db.restaurants.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "name": name,
                "description": description, "cuisine_type": details.get("cuisine_type") or "Caribbean",
                "address": address, "phone": phone, "email": email,
                "status": "active", "rating": 0.0, "delivery_fee": 8.0,
                "minimum_order": 30.0, "estimated_delivery_time": 35, "menu_items": [],
                "subscription_tier": "standard", "featured": False, "created_at": now,
            })
        await promote_user_role(uid, "restaurant")
    else:
        if not await db.businesses.find_one({"user_id": uid}, {"_id": 1}):
            await db.businesses.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "business_name": name,
                "business_type": btype or "business", "business_description": description,
                "email": email, "phone": phone, "address": address,
                "status": "active", "created_at": now,
            })
        await promote_user_role(uid, "business")

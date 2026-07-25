"""IslandHop in-app wallet routes.

Covers the customer wallet (balance/transactions), payment methods, admin-approved
funding (deposit/withdraw) requests, P2P send, money requests, and paying an order
from wallet balance. Shared wallet helpers live in wallet_service.py.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core import db, prepare_for_mongo, get_current_user_from_request
from models import SUPPORTED_WALLET_CURRENCIES
from wallet_service import (
    _round_money, _get_or_create_wallet, _credit_wallet, _debit_wallet, _record_txn,
)

router = APIRouter(prefix="/api")


async def _require_admin(request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/wallet")
async def get_my_wallet(request: Request):
    current_user = await get_current_user_from_request(request)
    return await _get_or_create_wallet(current_user.id)


@router.get("/wallet/transactions")
async def get_wallet_transactions(request: Request, limit: int = 50):
    current_user = await get_current_user_from_request(request)
    cursor = db.wallet_transactions.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("created_at", -1).limit(min(max(limit, 1), 200))
    return await cursor.to_list(length=limit)


class WalletAmountRequest(BaseModel):
    amount: float
    currency: str = "USD"
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Customer payment methods + bank/PayPal deposit & withdrawal requests
# (admin-approved real-money workflow; automated PayPal/WiPay added later)
# ---------------------------------------------------------------------------
FUNDING_METHODS = {"bank", "paypal", "card", "wipay"}


class PaymentMethodRequest(BaseModel):
    type: str                      # 'bank_account' | 'paypal'
    label: Optional[str] = None
    details: Dict[str, str] = {}   # bank: bank_name/account_name/account_number/branch ; paypal: {email}


class FundingRequestBody(BaseModel):
    direction: str                 # 'deposit' | 'withdraw'
    method: str                    # 'bank' | 'paypal' | 'wipay'
    amount: float
    currency: str = "USD"
    reference: Optional[str] = None        # deposit: transfer ref / proof
    payment_method_id: Optional[str] = None  # withdraw: where to send
    destination: Optional[str] = None        # withdraw: free-text (e.g. paypal email)
    note: Optional[str] = None


@router.get("/wallet/payment-methods")
async def list_payment_methods(request: Request):
    current_user = await get_current_user_from_request(request)
    methods = await db.wallet_payment_methods.find(
        {"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(length=50)
    return {"payment_methods": methods}


@router.post("/wallet/payment-methods")
async def add_payment_method(payload: PaymentMethodRequest, request: Request):
    current_user = await get_current_user_from_request(request)
    if payload.type not in {"bank_account", "paypal"}:
        raise HTTPException(status_code=400, detail="type must be 'bank_account' or 'paypal'")
    if payload.type == "paypal" and not payload.details.get("email"):
        raise HTTPException(status_code=400, detail="PayPal email is required")
    if payload.type == "bank_account" and not payload.details.get("account_number"):
        raise HTTPException(status_code=400, detail="Bank account number is required")
    now = datetime.now(timezone.utc).isoformat()
    label = payload.label or (
        payload.details.get("email") if payload.type == "paypal"
        else f"{payload.details.get('bank_name','Bank')} ••••{payload.details.get('account_number','')[-4:]}")
    doc = {"id": str(uuid.uuid4()), "user_id": current_user.id, "type": payload.type,
           "label": label, "details": payload.details, "created_at": now}
    await db.wallet_payment_methods.insert_one({**doc})
    doc.pop("_id", None)
    return {"success": True, "payment_method": doc}


@router.delete("/wallet/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, request: Request):
    current_user = await get_current_user_from_request(request)
    res = await db.wallet_payment_methods.delete_one({"id": method_id, "user_id": current_user.id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"success": True}


@router.post("/wallet/funding-request")
async def create_funding_request(payload: FundingRequestBody, request: Request):
    current_user = await get_current_user_from_request(request)
    if payload.direction not in {"deposit", "withdraw"}:
        raise HTTPException(status_code=400, detail="direction must be 'deposit' or 'withdraw'")
    if payload.method not in FUNDING_METHODS:
        raise HTTPException(status_code=400, detail=f"method must be one of {sorted(FUNDING_METHODS)}")
    amount = _round_money(payload.amount)
    if amount <= 0 or amount > 50000:
        raise HTTPException(status_code=400, detail="Amount must be between 0.01 and 50,000")
    currency = (payload.currency or "USD").upper()
    if currency not in SUPPORTED_WALLET_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    wallet = await _get_or_create_wallet(current_user.id)
    if payload.direction == "withdraw":
        if float(wallet.get("balances", {}).get(currency, 0)) < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance for this withdrawal")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "user_email": current_user.email,
        "user_name": getattr(current_user, "name", None),
        "direction": payload.direction,
        "method": payload.method,
        "amount": amount,
        "currency": currency,
        "status": "pending",
        "reference": payload.reference,
        "payment_method_id": payload.payment_method_id,
        "destination": payload.destination,
        "note": payload.note,
        "created_at": now,
        "processed_at": None,
        "processed_by": None,
    }
    await db.wallet_funding_requests.insert_one({**doc})
    doc.pop("_id", None)
    return {"success": True, "request": doc,
            "message": "Your request was submitted and is pending review by our team."}


@router.get("/wallet/funding-requests")
async def my_funding_requests(request: Request):
    current_user = await get_current_user_from_request(request)
    reqs = await db.wallet_funding_requests.find(
        {"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(length=100)
    return {"requests": reqs}


@router.get("/admin/wallet/funding-requests")
async def admin_list_funding_requests(request: Request, status: Optional[str] = "pending"):
    await _require_admin(request)
    query = {} if status in (None, "all") else {"status": status}
    reqs = await db.wallet_funding_requests.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(length=200)
    return {"requests": reqs}


@router.post("/admin/wallet/funding-requests/{request_id}/approve")
async def admin_approve_funding_request(request_id: str, request: Request):
    admin = await _require_admin(request)
    fr = await db.wallet_funding_requests.find_one({"id": request_id}, {"_id": 0})
    if not fr:
        raise HTTPException(status_code=404, detail="Request not found")
    if fr["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {fr['status']}")
    wallet = await _get_or_create_wallet(fr["user_id"])
    amount, currency = fr["amount"], fr["currency"]
    if fr["direction"] == "deposit":
        await _credit_wallet(fr["user_id"], amount, currency)
        txn_type = "deposit"
    else:  # withdraw — re-check balance then debit
        if float(wallet.get("balances", {}).get(currency, 0)) < amount:
            raise HTTPException(status_code=400, detail="User no longer has sufficient balance")
        await _debit_wallet(fr["user_id"], amount, currency)
        txn_type = "withdraw"
    await _record_txn(user_id=fr["user_id"], wallet_id=wallet["id"], type=txn_type,
                      amount=amount, currency=currency, status="completed",
                      note=f"{fr['method']} {fr['direction']} (admin-approved)")
    now = datetime.now(timezone.utc).isoformat()
    await db.wallet_funding_requests.update_one(
        {"id": request_id}, {"$set": {"status": "approved", "processed_at": now, "processed_by": admin.email}})
    new_bal = (await db.wallets.find_one({"user_id": fr["user_id"]}, {"_id": 0}))["balances"]
    return {"success": True, "status": "approved", "balance": new_bal}


@router.post("/admin/wallet/funding-requests/{request_id}/reject")
async def admin_reject_funding_request(request_id: str, request: Request):
    admin = await _require_admin(request)
    fr = await db.wallet_funding_requests.find_one({"id": request_id}, {"_id": 0})
    if not fr:
        raise HTTPException(status_code=404, detail="Request not found")
    if fr["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {fr['status']}")
    now = datetime.now(timezone.utc).isoformat()
    await db.wallet_funding_requests.update_one(
        {"id": request_id}, {"$set": {"status": "rejected", "processed_at": now, "processed_by": admin.email}})
    return {"success": True, "status": "rejected"}


class WalletSendRequest(BaseModel):
    recipient_email: str  # IslandHop user's email
    amount: float
    currency: str = "USD"
    note: Optional[str] = None


@router.post("/wallet/send")
async def wallet_p2p_send(payload: WalletSendRequest, request: Request):
    """Send funds wallet → wallet between two IslandHop users."""
    current_user = await get_current_user_from_request(request)
    payload.amount = _round_money(payload.amount)
    if payload.amount <= 0 or payload.amount > 10000:
        raise HTTPException(status_code=400, detail="Amount must be between $0.01 and $10,000")
    currency = (payload.currency or "USD").upper()
    if currency not in SUPPORTED_WALLET_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")

    recipient = await db.users.find_one(
        {"email": {"$regex": f"^{re.escape(payload.recipient_email.strip())}$", "$options": "i"}},
        {"_id": 0},
    )
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found on IslandHop")
    if recipient["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send to yourself")

    sender_wallet = await _get_or_create_wallet(current_user.id)
    if float(sender_wallet.get("balances", {}).get(currency, 0)) < payload.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    await _get_or_create_wallet(recipient["id"])
    await _debit_wallet(current_user.id, payload.amount, currency)
    await _credit_wallet(recipient["id"], payload.amount, currency)

    sender_txn = await _record_txn(user_id=current_user.id, wallet_id=sender_wallet["id"], type="p2p_send",
                                   amount=payload.amount, currency=currency, status="completed",
                                   counterparty_user_id=recipient["id"], note=payload.note)
    recipient_wallet = await db.wallets.find_one({"user_id": recipient["id"]}, {"_id": 0})
    await _record_txn(user_id=recipient["id"], wallet_id=recipient_wallet["id"], type="p2p_receive",
                      amount=payload.amount, currency=currency, status="completed",
                      counterparty_user_id=current_user.id, note=payload.note)
    return {"success": True, "transaction": sender_txn.dict(),
            "balance": (await db.wallets.find_one({"user_id": current_user.id}, {"_id": 0}))["balances"]}


class PayOrderWithWalletRequest(BaseModel):
    order_id: str


# --- Request money (Venmo/Cash-App style) ---
class MoneyRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_user_id: str
    requester_email: str
    payer_user_id: str
    payer_email: str
    amount: float
    currency: str = "USD"
    note: Optional[str] = None
    status: str = "pending"  # pending | approved | declined | cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    p2p_transaction_id: Optional[str] = None


class CreateMoneyRequest(BaseModel):
    payer_email: str
    amount: float
    currency: str = "USD"
    note: Optional[str] = Field(default=None, max_length=200)


@router.post("/wallet/requests")
async def create_money_request(payload: CreateMoneyRequest, request: Request):
    """Ask another IslandHop user for money. They see it in their /wallet page."""
    current_user = await get_current_user_from_request(request)
    amount = _round_money(payload.amount)
    if amount <= 0 or amount > 10000:
        raise HTTPException(status_code=400, detail="Amount must be between $0.01 and $10,000")
    currency = (payload.currency or "USD").upper()
    if currency not in SUPPORTED_WALLET_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")

    payer = await db.users.find_one(
        {"email": {"$regex": f"^{re.escape(payload.payer_email.strip())}$", "$options": "i"}},
        {"_id": 0},
    )
    if not payer:
        raise HTTPException(status_code=404, detail="Recipient of request not found on IslandHop")
    if payer["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot request from yourself")

    req = MoneyRequest(
        requester_user_id=current_user.id,
        requester_email=current_user.email,
        payer_user_id=payer["id"],
        payer_email=payer["email"],
        amount=amount,
        currency=currency,
        note=payload.note,
    )
    await db.money_requests.insert_one(prepare_for_mongo(req.dict()))
    return req.dict()


@router.get("/wallet/requests")
async def list_money_requests(request: Request):
    """List both incoming (someone asked me for money) and outgoing (I asked someone)."""
    current_user = await get_current_user_from_request(request)
    incoming = await db.money_requests.find(
        {"payer_user_id": current_user.id}, {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(length=100)
    outgoing = await db.money_requests.find(
        {"requester_user_id": current_user.id}, {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(length=100)
    return {"incoming": incoming, "outgoing": outgoing}


@router.post("/wallet/requests/{request_id}/approve")
async def approve_money_request(request_id: str, request: Request):
    """Approve an incoming request — executes the P2P transfer."""
    current_user = await get_current_user_from_request(request)
    req = await db.money_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["payer_user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the payer of this request")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req['status']}")

    amount = _round_money(req["amount"])
    currency = req["currency"]

    sender_wallet = await _get_or_create_wallet(current_user.id)
    if float(sender_wallet.get("balances", {}).get(currency, 0)) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Lock the request first to prevent double-approval (race)
    lock = await db.money_requests.update_one(
        {"id": request_id, "status": "pending"},
        {"$set": {"status": "approved", "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )
    if lock.matched_count == 0:
        raise HTTPException(status_code=400, detail="Request already resolved")

    try:
        await _debit_wallet(current_user.id, amount, currency)
    except HTTPException:
        # Revert lock if the debit failed
        await db.money_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "pending"}, "$unset": {"resolved_at": ""}},
        )
        raise

    await _get_or_create_wallet(req["requester_user_id"])
    await _credit_wallet(req["requester_user_id"], amount, currency)

    sender_txn = await _record_txn(
        user_id=current_user.id, wallet_id=sender_wallet["id"], type="p2p_send",
        amount=amount, currency=currency, status="completed",
        counterparty_user_id=req["requester_user_id"],
        note=f"Paid request: {req.get('note') or ''}".strip(),
    )
    req_wallet = await db.wallets.find_one({"user_id": req["requester_user_id"]}, {"_id": 0})
    await _record_txn(
        user_id=req["requester_user_id"], wallet_id=req_wallet["id"], type="p2p_receive",
        amount=amount, currency=currency, status="completed",
        counterparty_user_id=current_user.id,
        note=f"Request paid: {req.get('note') or ''}".strip(),
    )
    await db.money_requests.update_one(
        {"id": request_id},
        {"$set": {"p2p_transaction_id": sender_txn.id}},
    )
    return {"success": True, "request_id": request_id, "amount": amount, "currency": currency}


@router.post("/wallet/requests/{request_id}/decline")
async def decline_money_request(request_id: str, request: Request):
    """Decline an incoming request — no funds move."""
    current_user = await get_current_user_from_request(request)
    req = await db.money_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["payer_user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the payer of this request")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req['status']}")
    await db.money_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "declined", "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "request_id": request_id, "status": "declined"}


@router.delete("/wallet/requests/{request_id}")
async def cancel_money_request(request_id: str, request: Request):
    """Requester cancels their own outgoing request."""
    current_user = await get_current_user_from_request(request)
    req = await db.money_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["requester_user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You did not create this request")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Request already {req['status']}")
    await db.money_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "cancelled", "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "request_id": request_id, "status": "cancelled"}


@router.post("/wallet/pay-order")
async def wallet_pay_order(payload: PayOrderWithWalletRequest, request: Request):
    """Pay for an IslandHop order using the customer's wallet balance (USD)."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": payload.order_id, "customer_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    amount = float(order.get("total", 0) or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid order total")

    wallet = await _get_or_create_wallet(current_user.id)
    if float(wallet.get("balances", {}).get("USD", 0)) < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance (USD)")

    # Acquire the order lock FIRST (compare-and-set on payment_status) so two
    # concurrent pay-order calls can't both debit the wallet for the same order.
    lock_result = await db.orders.update_one(
        {"id": payload.order_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"payment_status": "paid", "payment_method": "wallet",
                  "paid_at": datetime.now(timezone.utc).isoformat()}},
    )
    if lock_result.matched_count == 0:
        raise HTTPException(status_code=400, detail="Order already paid")

    try:
        await _debit_wallet(current_user.id, amount, "USD")
    except HTTPException:
        # Revert the order lock if the debit failed (race after the check above)
        await db.orders.update_one(
            {"id": payload.order_id},
            {"$set": {"payment_status": "pending"},
             "$unset": {"paid_at": "", "payment_method": ""}},
        )
        raise
    txn = await _record_txn(user_id=current_user.id, wallet_id=wallet["id"], type="order_payment",
                            amount=amount, currency="USD", status="completed",
                            order_id=payload.order_id, note="Paid order from wallet")
    # Offer the now-paid order to available drivers (best-effort).
    try:
        import asyncio
        from server import _ensure_dispatch
        asyncio.create_task(_ensure_dispatch(payload.order_id))
    except Exception:  # noqa: BLE001
        pass
    return {"success": True, "transaction": txn.dict(),
            "balance": (await db.wallets.find_one({"user_id": current_user.id}, {"_id": 0}))["balances"]}

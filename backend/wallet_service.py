"""Shared IslandHop in-app wallet helpers.

These are used by the wallet routes (routers/wallet.py) AND by the order,
refund and promo flows in server.py — so they live in a standalone service
module to avoid an import cycle.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from core import db, prepare_for_mongo
from models import Wallet, WalletTransaction


def _round_money(amount: float) -> float:
    """Round to 2 decimal places (cents) — call on every external amount."""
    return round(float(amount or 0), 2)


async def _get_or_create_wallet(user_id: str) -> dict:
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    if wallet:
        return wallet
    w = Wallet(user_id=user_id)
    await db.wallets.insert_one(prepare_for_mongo(w.dict()))
    return w.dict()


async def _credit_wallet(user_id: str, amount: float, currency: str) -> dict:
    """Atomically add to a user's wallet balance for the given currency."""
    await db.wallets.update_one(
        {"user_id": user_id},
        {"$inc": {f"balances.{currency}": float(amount)},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return await db.wallets.find_one({"user_id": user_id}, {"_id": 0})


async def _debit_wallet(user_id: str, amount: float, currency: str) -> dict:
    """Atomically subtract from a user's wallet balance — fails if insufficient."""
    res = await db.wallets.update_one(
        {"user_id": user_id, f"balances.{currency}": {"$gte": float(amount)}},
        {"$inc": {f"balances.{currency}": -float(amount)},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    return await db.wallets.find_one({"user_id": user_id}, {"_id": 0})


async def _record_txn(**fields) -> WalletTransaction:
    txn = WalletTransaction(**fields)
    await db.wallet_transactions.insert_one(prepare_for_mongo(txn.dict()))
    return txn


async def _credit_wallet_with_txn(user_id: str, amount: float, currency: str, *,
                                  txn_type: str, order_id: Optional[str] = None,
                                  counterparty_user_id: Optional[str] = None,
                                  counterparty_handle: Optional[str] = None,
                                  external_transfer_id: Optional[str] = None,
                                  note: Optional[str] = None) -> None:
    """Credit a wallet AND log a wallet_transaction in one helper."""
    if amount <= 0:
        return
    wallet = await _get_or_create_wallet(user_id)
    await _credit_wallet(user_id, _round_money(amount), currency)
    await _record_txn(
        user_id=user_id, wallet_id=wallet["id"], type=txn_type,
        amount=_round_money(amount), currency=currency, status="completed",
        order_id=order_id, counterparty_user_id=counterparty_user_id,
        counterparty_handle=counterparty_handle,
        external_transfer_id=external_transfer_id, note=note,
    )

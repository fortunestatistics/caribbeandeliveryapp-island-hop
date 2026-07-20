"""Unit tests for Mercury <-> Stripe payout reconciliation logic."""
from datetime import datetime, timezone, timedelta

from server import _reconcile_payouts, _parse_mercury_dt


def _payout(amount_cents, arrival_dt, pid="po_1", status="paid"):
    return {
        "id": pid,
        "amount": amount_cents,
        "currency": "usd",
        "arrival_date": int(arrival_dt.timestamp()),
        "status": status,
        "description": "STRIPE PAYOUT",
    }


def _tx(amount, posted_dt, tid="tx_1"):
    return {
        "id": tid,
        "account_id": "acct_1",
        "amount": amount,
        "description": "Stripe transfer",
        "posted_at": posted_dt.isoformat(),
    }


def test_exact_match_within_window():
    now = datetime.now(timezone.utc)
    payouts = [_payout(10000, now)]  # $100.00
    txs = [_tx(100.0, now + timedelta(days=1))]
    result = _reconcile_payouts(payouts, txs)
    assert len(result) == 1
    assert result[0]["reconciled"] is True
    assert result[0]["mercury_transaction"]["id"] == "tx_1"


def test_no_match_outside_date_window():
    now = datetime.now(timezone.utc)
    payouts = [_payout(10000, now)]
    txs = [_tx(100.0, now + timedelta(days=10))]  # too far
    result = _reconcile_payouts(payouts, txs)
    assert result[0]["reconciled"] is False


def test_no_match_on_amount_mismatch():
    now = datetime.now(timezone.utc)
    payouts = [_payout(10000, now)]
    txs = [_tx(99.0, now)]
    result = _reconcile_payouts(payouts, txs)
    assert result[0]["reconciled"] is False


def test_debit_transactions_ignored():
    now = datetime.now(timezone.utc)
    payouts = [_payout(10000, now)]
    txs = [_tx(-100.0, now)]  # a debit, not a credit/deposit
    result = _reconcile_payouts(payouts, txs)
    assert result[0]["reconciled"] is False


def test_parse_mercury_dt_handles_z_suffix():
    dt = _parse_mercury_dt("2026-06-01T12:00:00Z")
    assert dt is not None
    assert dt.tzinfo is not None

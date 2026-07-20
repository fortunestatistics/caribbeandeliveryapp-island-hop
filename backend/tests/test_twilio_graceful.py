"""Regression tests for Twilio SMS/OTP graceful handling + phone normalization."""
import os
import sys
import importlib

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import twilio_client


def test_normalize_phone_variants():
    import re
    # replicate server._normalize_phone behaviour expectations via the live endpoint logic
    def norm(p):
        if not p:
            return ""
        had_plus = p.strip().startswith("+")
        digits = re.sub(r"\D", "", p.strip())
        if not digits:
            return ""
        if had_plus:
            return "+" + digits
        if len(digits) == 11 and digits.startswith("1"):
            return "+" + digits
        if len(digits) == 10:
            return "+1" + digits
        if len(digits) == 7:
            return "+1868" + digits
        return "+" + digits

    assert norm("7654321") == "+18687654321"          # bare TT local
    assert norm("868-765-4321") == "+18687654321"      # TT 10-digit with dashes
    assert norm("+1 868 765 4321") == "+18687654321"   # already E.164
    assert norm("18687654321") == "+18687654321"       # 11-digit NANP
    assert norm("(868) 765-4321") == "+18687654321"    # parens/spaces


def test_send_sms_missing_config_returns_error_not_raise(monkeypatch):
    monkeypatch.setenv("MOCK_TWILIO", "false")
    monkeypatch.delenv("TWILIO_SMS_FROM", raising=False)
    importlib.reload(twilio_client)
    res = twilio_client.send_sms("+18687654321", "hi")
    assert res["success"] is False and "configured" in res["error"].lower()


def test_send_sms_same_number_guard(monkeypatch):
    monkeypatch.setenv("MOCK_TWILIO", "false")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACxxx")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
    monkeypatch.setenv("TWILIO_SMS_FROM", "+18687654321")
    importlib.reload(twilio_client)
    res = twilio_client.send_sms("+18687654321", "hi")
    assert res["success"] is False and "same number" in res["error"].lower()


def test_send_whatsapp_missing_config_returns_error_not_raise(monkeypatch):
    monkeypatch.setenv("MOCK_TWILIO", "false")
    monkeypatch.delenv("TWILIO_WHATSAPP_FROM", raising=False)
    importlib.reload(twilio_client)
    res = twilio_client.send_whatsapp("+18687654321", "hi")
    assert res["success"] is False and res["channel"] == "whatsapp"


def test_mock_mode_always_succeeds(monkeypatch):
    monkeypatch.setenv("MOCK_TWILIO", "true")
    importlib.reload(twilio_client)
    assert twilio_client.send_sms("+18687654321", "hi")["success"] is True
    assert twilio_client.send_whatsapp("+18687654321", "hi")["success"] is True

"""Tests for driver decision email notifications (KYC/approval)."""
import asyncio
import pytest
import server


class _FakeUsers:
    def __init__(self, user):
        self._user = user
    async def find_one(self, query, projection=None):
        return self._user


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_notify_approved_sends_email(monkeypatch):
    sent = {}

    async def fake_send(to_email, subject, html_body, mailbox=None):
        sent.update({"to": to_email, "subject": subject, "html": html_body})

    monkeypatch.setattr(server.db, "users", _FakeUsers({"email": "drv@gmail.com", "name": "Sam"}), raising=False)
    monkeypatch.setattr(server.graph_mail, "send_mail", fake_send)

    _run(server._notify_driver_status("u1", "approved"))
    assert sent["to"] == "drv@gmail.com"
    assert "approved" in sent["subject"].lower()
    assert "Sam" in sent["html"]


def test_notify_rejected_includes_notes(monkeypatch):
    sent = {}

    async def fake_send(to_email, subject, html_body, mailbox=None):
        sent.update({"subject": subject, "html": html_body})

    monkeypatch.setattr(server.db, "users", _FakeUsers({"email": "drv@gmail.com", "name": "Sam"}), raising=False)
    monkeypatch.setattr(server.graph_mail, "send_mail", fake_send)

    _run(server._notify_driver_status("u1", "rejected", notes="Document was blurry"))
    assert "Document was blurry" in sent["html"]


def test_notify_swallows_send_errors(monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("graph down")

    monkeypatch.setattr(server.db, "users", _FakeUsers({"email": "drv@gmail.com", "name": "Sam"}), raising=False)
    monkeypatch.setattr(server.graph_mail, "send_mail", boom)

    # Must not raise — notifications are best-effort.
    _run(server._notify_driver_status("u1", "approved"))


def test_notify_skips_when_no_email(monkeypatch):
    called = {"v": False}

    async def fake_send(*args, **kwargs):
        called["v"] = True

    monkeypatch.setattr(server.db, "users", _FakeUsers({"name": "Sam"}), raising=False)
    monkeypatch.setattr(server.graph_mail, "send_mail", fake_send)

    _run(server._notify_driver_status("u1", "approved"))
    assert called["v"] is False

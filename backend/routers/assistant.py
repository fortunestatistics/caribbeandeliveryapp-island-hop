"""IslandHop AI Assistant — a customer-facing conversational helper.

Multi-turn: each turn's messages are persisted in `assistant_messages` (keyed by
session_id) and the recent history is fed back as context so the model remembers
the conversation across HTTP requests. Powered by OpenAI via the Emergent
universal key (emergentintegrations).
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from emergentintegrations.llm.chat import LlmChat, UserMessage

from core import db, EMERGENT_LLM_KEY

router = APIRouter(prefix="/api")

ASSISTANT_MODEL = ("openai", "gpt-5.4")
HISTORY_TURNS = 12  # how many recent messages to feed back as context

SYSTEM_PROMPT = (
    "You are the IslandHop Assistant — the friendly in-app helper for IslandHop, a "
    "multi-service delivery & logistics marketplace in Trinidad & Tobago (and the wider "
    "Caribbean). IslandHop lets customers order food from restaurants, shop from local "
    "shops, pharmacies and groceries, book car rentals, and get things delivered by local "
    "drivers.\n\n"
    "Help customers: find the right kind of vendor, understand how ordering & delivery "
    "works, track orders, use promo codes, and learn how to sign up as a customer, become "
    "a driver, or list their business/shop/restaurant as a merchant.\n\n"
    "Style: warm, upbeat and concise with a light Caribbean tone. Keep replies short "
    "(2-4 sentences) unless asked for detail. Use simple language.\n\n"
    "Important: do NOT invent specific vendor names, live prices, menus, or a specific "
    "order's status — you don't have that data. Instead, guide the customer to the right "
    "place in the app: browsing/search for finding vendors, their Orders page for tracking, "
    "the merchant/driver sign-up for partners. If unsure, say so and point them to Support."
)


class ChatRequest(BaseModel):
    session_id: str
    message: str


def _clean(docs):
    return [{"role": d["role"], "content": d["content"], "created_at": d.get("created_at")} for d in docs]


@router.post("/assistant/chat")
async def assistant_chat(payload: ChatRequest):
    """Send a message to the IslandHop Assistant and get a reply (multi-turn)."""
    sid = (payload.session_id or "").strip()
    text = (payload.message or "").strip()
    if not sid:
        raise HTTPException(status_code=400, detail="session_id is required")
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Message is too long (max 2000 characters)")

    # Recent history → context so the model remembers the conversation.
    history = await db.assistant_messages.find(
        {"session_id": sid}, {"_id": 0, "role": 1, "content": 1}
    ).sort("created_at", 1).to_list(length=200)
    recent = history[-HISTORY_TURNS:]
    system = SYSTEM_PROMPT
    if recent:
        convo = "\n".join(f"{m['role'].capitalize()}: {m['content']}" for m in recent)
        system = f"{SYSTEM_PROMPT}\n\nConversation so far:\n{convo}"

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY, session_id=sid, system_message=system
        ).with_model(*ASSISTANT_MODEL)
        reply = await chat.send_message(UserMessage(text=text))
    except Exception as exc:  # noqa: BLE001
        logging.error(f"Assistant chat failed for session {sid}: {exc}")
        raise HTTPException(status_code=502, detail="The assistant is unavailable right now. Please try again.")

    now = datetime.now(timezone.utc).isoformat()
    await db.assistant_messages.insert_many([
        {"session_id": sid, "role": "user", "content": text, "created_at": now},
        {"session_id": sid, "role": "assistant", "content": reply, "created_at": now},
    ])
    return {"reply": reply, "session_id": sid}


@router.get("/assistant/history/{session_id}")
async def assistant_history(session_id: str, limit: int = 100):
    """Return the stored conversation for a session (to restore the chat on reload)."""
    docs = await db.assistant_messages.find(
        {"session_id": session_id}, {"_id": 0, "role": 1, "content": 1, "created_at": 1}
    ).sort("created_at", 1).limit(min(limit, 500)).to_list(length=min(limit, 500))
    return {"session_id": session_id, "messages": _clean(docs)}

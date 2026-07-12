"""IslandHop AI Assistant — a customer-facing conversational helper.

Multi-turn: each turn's messages are persisted in `assistant_messages` (keyed by
session_id) and the recent history is fed back as context so the model remembers
the conversation across HTTP requests. Powered by OpenAI via the Emergent
universal key (emergentintegrations).
"""
import logging
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict

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
    "order's status — you don't have that data. When the system provides a 'LIVE vendors' "
    "list below, you MAY recommend those real vendors by name and share their link path "
    "(e.g. /restaurant/<id>) so the customer can tap through. If no live vendors are listed "
    "for a request, guide the customer to browse/search in the app instead. For tracking an "
    "order send them to their Orders page; for partners, the merchant/driver sign-up. Never "
    "claim a vendor is 'open now' or state exact prices — tell them to check in the app."
)


# Stopwords stripped before keyword-matching a customer message against live vendors.
_STOPWORDS = {
    "the", "and", "for", "you", "your", "can", "get", "want", "need", "have", "with", "near",
    "some", "any", "find", "help", "please", "there", "that", "this", "from", "what", "where",
    "how", "does", "islandhop", "island", "hop", "order", "deliver", "delivery", "tonight",
    "today", "now", "open", "close", "me", "my", "a", "an", "is", "are", "to", "of", "on", "in",
}
# Broad category → search terms, so "I have a cold" surfaces pharmacies, etc.
_CATEGORY_HINTS = {
    "pharmacy": ["pharmacy", "pharmacies", "medicine", "medication", "drug", "prescription",
                 "cold", "flu", "fever", "pain", "cough", "sick", "vitamin"],
    "grocery": ["grocery", "groceries", "supermarket", "market", "vegetable", "produce",
                "milk", "bread", "eggs", "snack"],
    "food": ["food", "restaurant", "eat", "meal", "lunch", "dinner", "breakfast", "hungry",
             "roti", "doubles", "bake", "shark", "pizza", "burger", "chicken", "cuisine"],
}


async def _find_relevant_vendors(message: str, limit: int = 8) -> List[Dict]:
    """Retrieval: match the customer's message against live (active) vendors so the
    assistant can recommend real shops/restaurants with tap-through links."""
    text = (message or "").lower()
    tokens = [t for t in re.findall(r"[a-z]{3,}", text) if t not in _STOPWORDS]
    for cat, hints in _CATEGORY_HINTS.items():
        if any(h in text for h in hints):
            tokens.append(cat)
    tokens = list(dict.fromkeys(tokens))[:8]
    if not tokens:
        return []
    rxs = [{"$regex": re.escape(t), "$options": "i"} for t in tokens]
    vendors: List[Dict] = []

    rest_or = []
    for rx in rxs:
        rest_or += [{"name": rx}, {"cuisine": rx}, {"cuisine_type": rx}, {"description": rx}]
    async for r in db.restaurants.find(
        {"status": "active", "$or": rest_or},
        {"_id": 0, "id": 1, "name": 1, "cuisine_type": 1, "rating": 1, "delivery_fee": 1},
    ).limit(limit):
        vendors.append({
            "id": r.get("id"), "name": r.get("name"), "type": "restaurant", "rating": r.get("rating"),
            "subtitle": r.get("cuisine_type"), "link": f"/restaurant/{r.get('id')}", "cta": "Start order",
        })

    biz_or = []
    for rx in rxs:
        biz_or += [{"business_name": rx}, {"business_description": rx}, {"business_type": rx}]
    async for b in db.businesses.find(
        {"status": "active", "$or": biz_or},
        {"_id": 0, "id": 1, "business_name": 1, "business_type": 1},
    ).limit(limit):
        btype = (b.get("business_type") or "shop").lower()
        link = "/pharmacy-order" if "pharm" in btype else "/grocery-order" if "grocer" in btype else "/businesses"
        vendors.append({
            "id": b.get("id"), "name": b.get("business_name"), "type": b.get("business_type") or "shop",
            "rating": None, "subtitle": b.get("business_type"), "link": link, "cta": "View shop",
        })
    return vendors[:limit]


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
        system = f"{system}\n\nConversation so far:\n{convo}"

    # Retrieval: surface real, active vendors matching this request.
    vendors = await _find_relevant_vendors(text)
    if vendors:
        lines = []
        for v in vendors:
            star = f" ★{v['rating']}" if v.get("rating") else ""
            sub = f" — {v['subtitle']}" if v.get("subtitle") else ""
            lines.append(f"- {v['name']} ({v['type']}){star}{sub} → link: {v['link']}")
        system = f"{system}\n\nLIVE vendors on IslandHop matching this request:\n" + "\n".join(lines)

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
    return {"reply": reply, "session_id": sid, "vendors": vendors}


@router.get("/assistant/history/{session_id}")
async def assistant_history(session_id: str, limit: int = 100):
    """Return the stored conversation for a session (to restore the chat on reload)."""
    docs = await db.assistant_messages.find(
        {"session_id": session_id}, {"_id": 0, "role": 1, "content": 1, "created_at": 1}
    ).sort("created_at", 1).limit(min(limit, 500)).to_list(length=min(limit, 500))
    return {"session_id": session_id, "messages": _clean(docs)}

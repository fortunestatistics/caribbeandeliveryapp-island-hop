"""Shared foundation for the IslandHop backend.

Owns the singletons and helpers that every route module depends on:
DB handle, config constants, password/JWT auth, request-based auth, the
WebSocket connection manager, and Mongo (de)serialisation helpers.

Route modules and services import from here; this module never imports them,
so there are no circular-import cycles.
"""
import os
import logging
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from fastapi import HTTPException, Request, Response, WebSocket, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------------------------------------------------------------------------
# Config / secrets
# ---------------------------------------------------------------------------
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
# Stripe key selection. The pod injects STRIPE_API_KEY=sk_test_emergent (Emergent's shared
# sandbox) which does NOT support Connect/marketplace payouts. For real merchant payouts we
# use the platform's OWN Stripe account keys (from .env) selected by STRIPE_MODE.
STRIPE_MODE = os.environ.get('STRIPE_MODE', 'test').lower()
if STRIPE_MODE == 'live':
    STRIPE_API_KEY = os.environ.get('STRIPE_LIVE_API_KEY') or os.environ.get('STRIPE_API_KEY')
else:
    STRIPE_API_KEY = os.environ.get('STRIPE_TEST_API_KEY') or os.environ.get('STRIPE_API_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing / bearer scheme.
# auto_error=False so requests WITHOUT an Authorization header don't 403 outright —
# we fall back to the httpOnly auth cookie (web) before rejecting.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# httpOnly auth cookie (web). The real JWT is stored ONLY in this cookie so it
# is never readable by JavaScript (XSS token-theft protection). The web client
# keeps a non-secret 'cookie' sentinel in localStorage; native/mobile keeps the
# real Bearer token (cross-origin WebViews can't rely on the cookie).
# ---------------------------------------------------------------------------
AUTH_COOKIE_NAME = "session_token"
AUTH_COOKIE_MAX_AGE = ACCESS_TOKEN_EXPIRE_MINUTES * 60
# Values the web client may send in the Authorization header / ?auth= that are
# NOT real credentials — treat them as absent so we use the cookie instead.
_PLACEHOLDER_TOKENS = {"", "cookie", "null", "undefined", "none", "bearer"}


def _clean_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    t = token.strip()
    if t.lower() in _PLACEHOLDER_TOKENS:
        return None
    return t


def set_auth_cookie(response: Response, token: str) -> None:
    """Store the JWT as an httpOnly, Secure, SameSite=Lax cookie (same-origin SPA+API)."""
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=AUTH_COOKIE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_connections[user_id] = websocket

    def disconnect(self, websocket: WebSocket, user_id: str):
        self.active_connections.remove(websocket)
        if user_id in self.user_connections:
            del self.user_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.user_connections:
            await self.user_connections[user_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Authentication helpers
# ---------------------------------------------------------------------------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Defensive: OAuth-only accounts (Google/Microsoft) have no password hash.
    # passlib raises on empty/invalid hashes, so guard before verifying.
    if not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def _account_block_detail(user_doc: dict):
    """Return a 403 message if the account is paused/restricted/suspended, else None."""
    st = (user_doc.get("status") or "active").lower()
    if st == "paused":
        return "Your account has been paused by an administrator. Please contact IslandHop support."
    if st in ("restricted", "suspended", "banned"):
        return "Your account has been restricted. Please contact IslandHop support."
    return None


async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    from models import User
    # Prefer a real Bearer token (native/mobile); fall back to the httpOnly cookie (web).
    token = _clean_token(credentials.credentials if credentials else None)
    if not token:
        token = _clean_token(request.cookies.get(AUTH_COOKIE_NAME))
    if not token:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    _blk = _account_block_detail(user)
    if _blk:
        raise HTTPException(status_code=403, detail=_blk)
    return User(**user)


async def get_current_user_from_request(request: Request):
    """Get current authenticated user from request (supports session token cookie or JWT Bearer)"""
    from models import User
    session_token = _clean_token(request.cookies.get(AUTH_COOKIE_NAME))

    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = _clean_token(auth_header.split(" ", 1)[1])

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Try session token lookup first
    user = await db.users.find_one({"session_token": session_token})
    if user:
        _blk = _account_block_detail(user)
        if _blk:
            raise HTTPException(status_code=403, detail=_blk)
        return User(**user)

    # Fallback: try decoding as JWT (issued by /auth/login or /auth/register)
    try:
        payload = jwt.decode(session_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            user = await db.users.find_one({"id": user_id})
            if user:
                # Admin impersonation tokens bypass the block so staff can inspect the account.
                if not payload.get("impersonated_by"):
                    _blk = _account_block_detail(user)
                    if _blk:
                        raise HTTPException(status_code=403, detail=_blk)
                return User(**user)
    except JWTError:
        pass

    raise HTTPException(status_code=401, detail="Invalid session")


# ---------------------------------------------------------------------------
# Mongo (de)serialisation helpers
# ---------------------------------------------------------------------------
def prepare_for_mongo(data):
    """Prepare data for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, dict):
                data[key] = prepare_for_mongo(value)
    return data


def parse_from_mongo(item):
    """Parse data from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and key.endswith(('_at', 'date')):
                try:
                    item[key] = datetime.fromisoformat(value)
                except (ValueError, TypeError):
                    pass
            elif isinstance(value, dict):
                item[key] = parse_from_mongo(value)
    return item


# ---------------------------------------------------------------------------
# Role management
# ---------------------------------------------------------------------------
_PROTECTED_ROLES = {"admin", "agent"}


async def promote_user_role(user_id: str, new_role: str) -> bool:
    """Set a user's account role to a partner role (driver/restaurant/business),
    but NEVER demote a privileged account. An admin/agent/owner keeps their role
    even if they also submit a driver/merchant application — so testing partner
    onboarding can't strip their admin access. Returns True if the role changed."""
    if not user_id:
        return False
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "user_type": 1, "is_owner": 1})
    if not u:
        return False
    if u.get("is_owner") or (u.get("user_type") in _PROTECTED_ROLES):
        return False
    await db.users.update_one({"id": user_id}, {"$set": {"user_type": new_role}})
    return True



# ---------------------------------------------------------------------------
# Lightweight in-memory rate limiter (per-pod). Protects unauthenticated,
# cost/abuse-prone endpoints (LLM chat, file uploads) from scripted floods.
# ---------------------------------------------------------------------------
import time as _time
from collections import defaultdict, deque

_RATE_BUCKETS: Dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    """Best-effort client IP (honours the proxy's X-Forwarded-For)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_ok(key: str, max_calls: int, window_seconds: int) -> bool:
    """Sliding-window limiter. Returns False when `key` has exceeded `max_calls`
    within `window_seconds`."""
    now = _time.time()
    dq = _RATE_BUCKETS[key]
    cutoff = now - window_seconds
    while dq and dq[0] <= cutoff:
        dq.popleft()
    if len(dq) >= max_calls:
        return False
    dq.append(now)
    return True

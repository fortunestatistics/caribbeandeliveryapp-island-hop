from fastapi import FastAPI, APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends, UploadFile, File, Form, Header, Query
from fastapi.responses import JSONResponse, Response, RedirectResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
import json
import hmac
import hashlib
import re
from passlib.context import CryptContext
import secrets
from jose import JWTError, jwt
import stripe
import push_client
import graph_mail
import taxi_pricing
import mercury_client
import storage_client
import wipay_client
import paypal_client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Environment variables
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Initialize Stripe
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# WebSocket connection manager
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

# Authentication Helper Functions
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


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
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

# Domain models (Pydantic schemas) are defined in models.py
from models import (
    SUPPORTED_WALLET_CURRENCIES,
    UserRegister, UserLogin, Token, PasswordReset, PasswordResetConfirm,
    TeamPromote, TeamInvite, InviteAccept, ChangePassword,
    Order, OrderCreate,
    SubscriptionPlan, UserSubscription, SubscriptionCreate,
    StatusCheck, StatusCheckCreate,
    User, SessionCreate,
    Restaurant, MenuItem,
    Driver, DriverWallet, DriverWithdrawal,
    VendorStripeAccount, VendorPayout,
    Rating, RatingCreate,
    DriverLocation, Notification, PromoCode, Address,
    SupportTicket, TicketMessage,
    ScheduledOrder, RecurringOrder,
    RentalVehicle, CarRentalCompany, RentalBooking,
    Wallet, WalletTransaction,
    BusinessCategory, BusinessOnboarding, BusinessOnboardingRequest,
    PricingTier, PaymentTransaction,
    ChatMessage, ChatMessageCreate, ChatRequest,
    OrderChatMessage, OrderChatMessageCreate,
    SubstitutionProposal, SubstitutionCreate,
    CustomerRating,
    FraudFlag, FraudReviewAction,
    TicketMessageCreate, ResolveClaimRequest,
    PushSubscription, PushSubscriptionCreate,
)

# Helper function to calculate commission and split payments
# ---------------------------------------------------------------------------
# Fee structure (approved Jul 2026 — merchant plans):
#   • Merchant commission on item subtotal, by plan:
#       - STANDARD (Free):          20% commission.
#       - PROFESSIONAL ($800 TT/mo): 15% commission (+ Featured Partner).
#       - PREMIUM ($1,600 TT/mo):    5%  commission (+ Featured + Priority).
#   • Customer Service Fee: flat $3.00 added to checkout, 100% to the Platform (all tiers).
#   • Delivery fee + tips go to the driver, MINUS the platform's delivery-fee cut by plan:
#       - STANDARD (Free):        platform takes 20% → driver keeps 80%.
#       - PRO ($700 TT/mo):       platform takes 10% → driver keeps 90%.
#       - PREMIUM ($1,400 TT/mo): platform takes 0%  → driver keeps 100%.
#     Tips are ALWAYS 100% to the driver. (Drivers also receive monthly incentive payouts.)
# ---------------------------------------------------------------------------
PLATFORM_SERVICE_FEE = float(os.environ.get("PLATFORM_SERVICE_FEE", "3.00"))

# Platform's % cut of the delivery fee, keyed by the driver's subscription tier.
DRIVER_PLAN_RATES = {
    "standard": float(os.environ.get("DRIVER_FEE_RATE_STANDARD", "0.20")),
    "pro": float(os.environ.get("DRIVER_FEE_RATE_PRO", "0.10")),
    "premium": float(os.environ.get("DRIVER_FEE_RATE_PREMIUM", "0.00")),
}
# Default cut applied at order-creation time (before a driver is assigned).
DRIVER_FEE_RATE_NONSUBSCRIBER = DRIVER_PLAN_RATES["standard"]

# Driver subscription catalogue (prices in TTD).
DRIVER_SUBSCRIPTION_PLANS = [
    {
        "tier": "standard", "name": "Standard", "price_ttd": 0,
        "platform_cut_pct": 20, "driver_keep_pct": 80,
        "tagline": "Start earning for free.",
        "features": [
            "Keep 80% of every delivery fee",
            "Keep 100% of all tips",
            "Access to all delivery & taxi jobs",
            "Weekly payouts",
        ],
    },
    {
        "tier": "pro", "name": "Pro", "price_ttd": 700,
        "platform_cut_pct": 10, "driver_keep_pct": 90,
        "tagline": "Keep more of what you earn.",
        "features": [
            "Keep 90% of every delivery fee",
            "Keep 100% of all tips",
            "Priority job matching",
            "Weekly payouts",
        ],
    },
    {
        "tier": "premium", "name": "Premium", "price_ttd": 1400,
        "platform_cut_pct": 0, "driver_keep_pct": 100,
        "tagline": "Zero platform cut. Maximum earnings.",
        "features": [
            "Keep 100% of every delivery fee",
            "Keep 100% of all tips",
            "Top priority job matching",
            "Premium support",
        ],
    },
]


def _derive_vendor_type(service_type: str) -> str:
    return {
        "food": "restaurant",
        "pharmacy": "pharmacy",
        "grocery": "grocery",
        "car_rental": "car_rental",
    }.get(service_type, "business")


# Merchant subscription catalogue (prices in TTD). Commission is on the item subtotal.
MERCHANT_PLAN_COMMISSION = {"standard": 20.0, "pro": 15.0, "premium": 5.0}
MERCHANT_SUBSCRIPTION_PLANS = [
    {
        "tier": "standard", "name": "Standard", "price_ttd": 0,
        "commission_pct": 20, "featured": False,
        "tagline": "Free to join. Start selling today.",
        "features": [
            "20% commission on orders",
            "Standard search placement",
            "Order & menu management",
            "Weekly payouts",
        ],
    },
    {
        "tier": "pro", "name": "Professional", "price_ttd": 800,
        "commission_pct": 15, "featured": True,
        "tagline": "Lower fees + Featured Partner status.",
        "features": [
            "15% commission on orders",
            "Featured Partner — higher search visibility",
            "Order & menu management",
            "Weekly payouts",
        ],
    },
    {
        "tier": "premium", "name": "Premium", "price_ttd": 1600,
        "commission_pct": 5, "featured": True,
        "tagline": "Lowest fees + Premium Marketing & Priority Support.",
        "features": [
            "5% commission on orders",
            "Featured Partner — top search visibility",
            "Premium Marketing placement",
            "Priority Support",
        ],
    },
]


async def _merchant_plan_tier(vendor_id: Optional[str]) -> str:
    """Resolve a merchant's active subscription tier from its profile doc."""
    if not vendor_id:
        return "standard"
    for coll in ("restaurants", "businesses", "car_rental_companies"):
        doc = await db[coll].find_one({"id": vendor_id}, {"_id": 0, "subscription_tier": 1})
        if doc:
            tier = str(doc.get("subscription_tier") or "").lower()
            return tier if tier in MERCHANT_PLAN_COMMISSION else "standard"
    return "standard"


async def _merchant_commission_rate(vendor_id: Optional[str], vendor_type: str) -> float:
    """Commission % on item subtotal, by the merchant's subscription tier.
    STANDARD 20% / PROFESSIONAL 15% / PREMIUM 5% (flat across vendor types)."""
    tier = await _merchant_plan_tier(vendor_id)
    return MERCHANT_PLAN_COMMISSION.get(tier, MERCHANT_PLAN_COMMISSION["standard"])


async def _driver_plan_tier(driver_user_id: Optional[str], driver_doc: Optional[dict] = None) -> str:
    """Resolve the driver's active subscription tier: 'standard' | 'pro' | 'premium'."""
    doc = driver_doc or {}
    tier = str(doc.get("subscription_tier") or "").lower()
    if tier in DRIVER_PLAN_RATES:
        return tier
    # Legacy flag → premium
    if doc.get("is_premium") is True:
        return "premium"
    if driver_user_id:
        sub = await db.user_subscriptions.find_one({
            "user_id": driver_user_id, "status": "active",
            "plan_tier": {"$in": ["pro", "premium"]},
        })
        if sub:
            return sub.get("plan_tier", "standard")
    return "standard"


async def _driver_delivery_fee_rate(driver_user_id: Optional[str], driver_doc: Optional[dict] = None) -> float:
    """Platform's % cut of the delivery fee for the assigned driver, by plan tier.
    STANDARD 20% / PRO 10% / PREMIUM 0%. Tips are always 100% to the driver."""
    tier = await _driver_plan_tier(driver_user_id, driver_doc)
    return DRIVER_PLAN_RATES.get(tier, DRIVER_PLAN_RATES["standard"])



async def _finalize_driver_split(order_id: str, driver_doc: dict) -> None:
    """Re-split the delivery fee once the assigned driver is known (their tier
    sets the 0% premium vs 20% standard platform cut). Idempotent."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        return
    rate = await _driver_delivery_fee_rate((driver_doc or {}).get("user_id"), driver_doc)
    delivery_fee = float(order.get("delivery_fee", 0) or 0)
    tip = float(order.get("tip", 0) or 0)
    commission = float(order.get("commission_amount", 0) or 0)
    service_fee = float(order.get("service_fee", 0) or 0)
    platform_delivery = round(delivery_fee * rate, 2)
    driver_delivery = round(delivery_fee - platform_delivery, 2)
    await db.orders.update_one({"id": order_id}, {"$set": {
        "driver_fee_rate": rate,
        "platform_delivery_portion": platform_delivery,
        "driver_delivery_portion": driver_delivery,
        "driver_earnings": round(driver_delivery + tip, 2),
        "platform_earnings": round(commission + platform_delivery + service_fee, 2),
    }})


async def calculate_order_financials(order: Order, vendor_id: str, vendor_type: str) -> Order:
    """
    Calculate commission, vendor payout, platform earnings, and driver earnings.
    """
    # Merchant commission rate is determined by the merchant's subscription tier
    # (Pro 10% / Premium 5% / Standard = vendor-type default).
    commission_rate = await _merchant_commission_rate(vendor_id, vendor_type)

    # Merchant commission on the item subtotal
    order.commission_rate = commission_rate
    order.commission_amount = round(order.subtotal * (commission_rate / 100), 2)
    order.vendor_payout = round(order.subtotal - order.commission_amount, 2)

    # Flat customer service fee → 100% platform
    order.service_fee = PLATFORM_SERVICE_FEE

    # Delivery-fee split. Driver isn't assigned at creation, so assume the
    # non-subscriber rate (max platform cut); re-split via _finalize_driver_split
    # once the assigned driver's subscription status is known.
    rate = DRIVER_FEE_RATE_NONSUBSCRIBER
    order.driver_fee_rate = rate
    order.platform_delivery_portion = round(order.delivery_fee * rate, 2)
    order.driver_delivery_portion = round(order.delivery_fee - order.platform_delivery_portion, 2)

    # Driver keeps their delivery share + 100% of tips
    order.driver_earnings = round(order.driver_delivery_portion + order.tip, 2)
    # Platform earns merchant commission + delivery-fee cut + service fee
    order.platform_earnings = round(order.commission_amount + order.platform_delivery_portion + order.service_fee, 2)

    # Total the customer pays includes the flat service fee
    order.total = round(
        order.subtotal + order.delivery_fee + order.tax + order.tip - order.discount + order.service_fee, 2
    )

    return order

# Helper functions
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

# Authentication helper
async def get_current_user_from_request(request: Request):
    """Get current authenticated user from request (supports session token cookie or JWT Bearer)"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
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

# Stripe Connect & Payout Routes
@api_router.post("/vendors/{vendor_id}/stripe-connect")
async def create_vendor_stripe_account(vendor_id: str, vendor_type: str, email: str):
    """Create Stripe Express Connect account for vendor"""
    try:
        # Create Stripe Express account
        account = stripe.Account.create(
            type="express",
            country="US",
            email=email,
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
        )
        
        # Save to database
        stripe_account = VendorStripeAccount(
            vendor_id=vendor_id,
            vendor_type=vendor_type,
            stripe_account_id=account.id
        )
        await db.vendor_stripe_accounts.insert_one(stripe_account.dict())
        
        # Create account link for onboarding
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{os.environ['FRONTEND_URL']}/vendor/stripe-refresh",
            return_url=f"{os.environ['FRONTEND_URL']}/vendor/stripe-return",
            type="account_onboarding",
        )
        
        return {
            "success": True,
            "account_id": account.id,
            "onboarding_url": account_link.url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/vendors/{vendor_id}/stripe-account")
async def get_vendor_stripe_account(vendor_id: str):
    """Get vendor's Stripe Connect account status"""
    stripe_account = await db.vendor_stripe_accounts.find_one({"vendor_id": vendor_id})
    if not stripe_account:
        return {"connected": False}
    
    try:
        # Get account status from Stripe
        account = stripe.Account.retrieve(stripe_account["stripe_account_id"])
        
        # Update database
        await db.vendor_stripe_accounts.update_one(
            {"vendor_id": vendor_id},
            {"$set": {
                "account_status": "active" if account.charges_enabled else "restricted",
                "onboarding_complete": account.details_submitted,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "connected": True,
            "account_id": account.id,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
            "onboarding_complete": account.details_submitted
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}

@api_router.post("/payouts/process-daily-batch")
async def process_daily_vendor_payouts():
    """
    Process daily batch payouts for all vendors
    This should be called by a cron job once per day
    """
    try:
        # Get yesterday's date range
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        
        # Get all completed orders from yesterday that need payout
        completed_orders = await db.orders.find({
            "status": "delivered",
            "vendor_payout_status": "pending",
            "actual_delivery_time": {
                "$gte": yesterday.isoformat(),
                "$lt": today.isoformat()
            }
        }).limit(10000).to_list(length=10000)
        
        # Group orders by vendor
        vendor_orders = {}
        for order in completed_orders:
            vendor_id = order.get("restaurant_id") or order.get("vendor_id")
            if vendor_id not in vendor_orders:
                vendor_orders[vendor_id] = []
            vendor_orders[vendor_id].append(order)
        
        payouts_processed = []
        
        # Process payout for each vendor
        for vendor_id, orders in vendor_orders.items():
            total_payout = sum(order.get("vendor_payout", 0) for order in orders)
            order_ids = [order["id"] for order in orders]
            
            # Get vendor's Stripe account
            stripe_account = await db.vendor_stripe_accounts.find_one({"vendor_id": vendor_id})
            
            if not stripe_account or not stripe_account.get("payouts_enabled"):
                # Mark as failed if no Stripe account
                payout = VendorPayout(
                    vendor_id=vendor_id,
                    vendor_type="unknown",
                    amount=total_payout,
                    order_ids=order_ids,
                    payout_date=today,
                    status="failed"
                )
                await db.vendor_payouts.insert_one(payout.dict())
                continue
            
            try:
                # Create Stripe transfer
                transfer = stripe.Transfer.create(
                    amount=int(total_payout * 100),  # Convert to cents
                    currency="usd",
                    destination=stripe_account["stripe_account_id"],
                    description=f"Daily payout for {len(orders)} orders"
                )
                
                # Record payout
                payout = VendorPayout(
                    vendor_id=vendor_id,
                    vendor_type=stripe_account.get("vendor_type", "unknown"),
                    amount=total_payout,
                    order_ids=order_ids,
                    payout_date=today,
                    status="completed",
                    stripe_payout_id=transfer.id,
                    completed_at=datetime.now(timezone.utc)
                )
                await db.vendor_payouts.insert_one(payout.dict())
                
                # Update order statuses
                await db.orders.update_many(
                    {"id": {"$in": order_ids}},
                    {"$set": {
                        "vendor_payout_status": "paid",
                        "vendor_payout_date": today.isoformat()
                    }}
                )
                
                payouts_processed.append({
                    "vendor_id": vendor_id,
                    "amount": total_payout,
                    "orders_count": len(orders),
                    "status": "completed"
                })
                
            except Exception as e:
                # Record failed payout
                payout = VendorPayout(
                    vendor_id=vendor_id,
                    vendor_type=stripe_account.get("vendor_type", "unknown"),
                    amount=total_payout,
                    order_ids=order_ids,
                    payout_date=today,
                    status="failed"
                )
                payout_dict = payout.dict()
                payout_dict["error"] = str(e)
                await db.vendor_payouts.insert_one(payout_dict)
                
                payouts_processed.append({
                    "vendor_id": vendor_id,
                    "amount": total_payout,
                    "orders_count": len(orders),
                    "status": "failed",
                    "error": str(e)
                })
        
        return {
            "success": True,
            "date": yesterday.date().isoformat(),
            "vendors_processed": len(vendor_orders),
            "total_payouts": len(payouts_processed),
            "payouts": payouts_processed
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/vendors/{vendor_id}/payouts")
async def get_vendor_payouts(vendor_id: str, limit: int = 30):
    """Get vendor's payout history"""
    payouts = await db.vendor_payouts.find(
        {"vendor_id": vendor_id}
    ).sort("payout_date", -1).limit(limit).to_list(length=None)
    return payouts

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"Message received: {data}", user_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

# JWT Authentication Routes
async def _resolve_phone_verification(phone_clean: Optional[str], otp_code: Optional[str]) -> bool:
    """Return True if phone is verified via OTP (either supplied now or previously verified)."""
    if not phone_clean:
        return False
    if otp_code:
        now_iso = datetime.now(timezone.utc).isoformat()
        otp = await db.otp_codes.find_one(
            {"phone": phone_clean, "purpose": "signup", "code": str(otp_code).strip(),
             "expires_at": {"$gt": now_iso}},
            sort=[("created_at", -1)],
        )
        if not otp:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        if not otp.get("verified"):
            await db.otp_codes.update_one({"id": otp["id"]}, {"$set": {"verified": True, "verified_at": now_iso}})
        return True
    # Accept a previously verified OTP for this phone
    recent_verified = await db.otp_codes.find_one(
        {"phone": phone_clean, "purpose": "signup", "verified": True},
        sort=[("created_at", -1)],
    )
    return bool(recent_verified)


async def _apply_referral_on_register(user: User, referral_code: Optional[str]) -> None:
    """Mutate user with referred_by/referral_code_used if a valid code is provided. Creates pending row."""
    if not referral_code:
        return
    code = referral_code.strip().upper()
    code_doc = await db.referral_codes.find_one({"code": code})
    if not code_doc or code_doc["user_id"] == user.id:
        return
    user.referred_by = code_doc["user_id"]
    user.referral_code_used = code


async def _persist_pending_referral(user: User) -> None:
    if not (user.referred_by and user.referral_code_used):
        return
    await db.referrals.insert_one({
        "id": str(uuid.uuid4()),
        "referrer_id": user.referred_by,
        "referee_id": user.id,
        "code_used": user.referral_code_used,
        "status": "pending",
        "reward_amount": REFERRAL_REWARD_AMOUNT,
        "reward_currency": REFERRAL_REWARD_CURRENCY,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    })


@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    """Register a new user. Optionally verifies a pending OTP for the phone and applies a referral code."""
    if await db.users.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    phone_clean = re.sub(r"[\s\-\(\)]", "", user_data.phone.strip()) if user_data.phone else None
    phone_verified = await _resolve_phone_verification(phone_clean, user_data.otp_code)

    user = User(
        email=user_data.email,
        name=user_data.name,
        phone=phone_clean,
        phone_verified=phone_verified,
        address={"street": user_data.address} if user_data.address else None,
        user_type="customer",  # SECURITY: public sign-up can only ever create a customer.
    )                          # Privileged roles (admin/agent) are granted by an admin;
                               # restaurant/driver are set via their own onboarding/approval.
    await _apply_referral_on_register(user, user_data.referral_code)

    # Persist user with hashed password
    user_dict = prepare_for_mongo(user.dict())
    user_dict['hashed_password'] = get_password_hash(user_data.password)
    await db.users.insert_one(user_dict)

    await _persist_pending_referral(user)

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.dict(),
    }

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login user"""
    # Find user
    user_doc = await db.users.find_one({"email": credentials.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # OAuth-only accounts (Google/Microsoft) have no password — guide the user.
    if not user_doc.get('hashed_password'):
        provider = (user_doc.get('auth_provider') or 'google').lower()
        provider_label = 'Microsoft' if provider == 'microsoft' else 'Google'
        raise HTTPException(
            status_code=401,
            detail=f"This account uses {provider_label} sign-in. Please use the Continue with {provider_label} button.",
        )
    
    # Verify password
    if not verify_password(credentials.password, user_doc.get('hashed_password', '')):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Account-status gate (paused / restricted accounts cannot sign in)
    _blk = _account_block_detail(user_doc)
    if _blk:
        raise HTTPException(status_code=403, detail=_blk)

    user = User(**user_doc)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.dict()
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user"""
    return current_user


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    picture: Optional[str] = None  # base64 data URL or external URL
    address: Optional[Dict[str, str]] = None


@api_router.put("/users/me", response_model=User)
async def update_my_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile (name, phone, picture, address)."""
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        return current_user
    # Guard against oversized base64 images (~3MB base64 ≈ ~2.2MB binary)
    if update.get("picture") and len(update["picture"]) > 3_000_000:
        raise HTTPException(status_code=413, detail="Profile picture too large (max ~2MB)")
    await db.users.update_one({"id": current_user.id}, {"$set": update})
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    return User(**user_doc)



# Emergent-managed Google OAuth: we use it only to obtain the verified Google
# identity, then mint OUR existing JWT so the rest of the app is unchanged.
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class SocialAuthRequest(BaseModel):
    session_id: str


@api_router.post("/auth/social/google", response_model=Token)
async def google_social_auth(payload: SocialAuthRequest):
    """Exchange an Emergent Google OAuth session_id for our app JWT.

    Creates the user's profile automatically on first sign-in (no password),
    and links to the existing account by email on subsequent sign-ins.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": payload.session_id},
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach Google sign-in service")

    if resp.status_code != 200:
        logging.warning(
            f"Emergent session-data exchange failed: status={resp.status_code} body={resp.text[:300]}"
        )
        raise HTTPException(status_code=401, detail="Google sign-in failed or expired. Please try again.")

    data = resp.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email address")
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")

    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        user = User(**user_doc)
        if picture and not user_doc.get("picture"):
            await db.users.update_one({"id": user.id}, {"$set": {"picture": picture}})
            user.picture = picture
    else:
        user = User(email=email, name=name, picture=picture, user_type="customer")
        user_dict = prepare_for_mongo(user.dict())
        user_dict["auth_provider"] = "google"
        await db.users.insert_one(user_dict)
        try:
            await _persist_pending_referral(user)
        except Exception as e:
            logging.warning(f"Referral persist failed for social signup {email}: {e}")

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user.dict()}


# Microsoft (Azure AD / Entra ID) social login. Reuses the existing M365 app
# registration. We run an OIDC authorization-code flow: the frontend redirects
# the browser to Microsoft, Microsoft returns a `code` to a frontend callback
# route, and the frontend posts that code here. We exchange it server-side with
# the client secret, verify the ID token, then mint OUR existing JWT.
MS_TENANT_ID = os.environ.get("M365_TENANT_ID")
MS_CLIENT_ID = os.environ.get("M365_CLIENT_ID")
MS_CLIENT_SECRET = os.environ.get("M365_CLIENT_SECRET")


def _ms_configured() -> bool:
    """True only when real Azure credentials are present (preview uses placeholders)."""
    placeholder = "logistics-island"
    return bool(
        MS_TENANT_ID and MS_CLIENT_ID and MS_CLIENT_SECRET
        and MS_TENANT_ID != placeholder and MS_CLIENT_ID != placeholder
    )


class MicrosoftAuthRequest(BaseModel):
    code: str
    redirect_uri: str


async def _verify_ms_id_token(id_token: str) -> dict:
    """Verify a Microsoft v2.0 ID token signature, issuer and audience via JWKS."""
    jwks_url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/discovery/v2.0/keys"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            jwks = (await client.get(jwks_url)).json()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not fetch Microsoft signing keys")
    try:
        header = jwt.get_unverified_header(id_token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid Microsoft identity token")
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
    if not key:
        raise HTTPException(status_code=400, detail="Unable to verify Microsoft identity token")
    issuer = f"https://login.microsoftonline.com/{MS_TENANT_ID}/v2.0"
    try:
        return jwt.decode(
            id_token, key, algorithms=["RS256"],
            audience=MS_CLIENT_ID, issuer=issuer,
        )
    except JWTError as e:
        logging.warning(f"Microsoft id_token validation failed: {e}")
        raise HTTPException(status_code=401, detail="Microsoft sign-in verification failed")


@api_router.get("/auth/social/microsoft/login-url")
async def microsoft_login_url(redirect_uri: str, state: str):
    """Build the Microsoft authorization URL for the frontend to redirect to."""
    if not _ms_configured():
        raise HTTPException(status_code=503, detail="Microsoft sign-in is not configured in this environment")
    from urllib.parse import urlencode
    params = {
        "client_id": MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": "openid profile email",
        "state": state,
        "prompt": "select_account",
    }
    url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/authorize?{urlencode(params)}"
    return {"url": url}


@api_router.post("/auth/social/microsoft", response_model=Token)
async def microsoft_social_auth(payload: MicrosoftAuthRequest):
    """Exchange a Microsoft authorization code for our app JWT.

    Creates the user's profile automatically on first sign-in (no password),
    and links to the existing account by email on subsequent sign-ins.
    """
    if not _ms_configured():
        raise HTTPException(status_code=503, detail="Microsoft sign-in is not configured in this environment")
    token_url = f"https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token"
    data = {
        "client_id": MS_CLIENT_ID,
        "client_secret": MS_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": payload.code,
        "redirect_uri": payload.redirect_uri,
        "scope": "openid profile email",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(token_url, data=data)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach Microsoft sign-in service")
    if resp.status_code != 200:
        logging.warning(f"Microsoft token exchange failed: status={resp.status_code} body={resp.text[:300]}")
        raise HTTPException(status_code=401, detail="Microsoft sign-in failed or expired. Please try again.")

    id_token = resp.json().get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Microsoft did not return an identity token")

    claims = await _verify_ms_id_token(id_token)
    email = (claims.get("email") or claims.get("preferred_username") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Microsoft did not return an email address")
    name = claims.get("name") or email.split("@")[0]

    user_doc = await db.users.find_one({"email": email})
    if user_doc:
        user = User(**user_doc)
    else:
        user = User(email=email, name=name, user_type="customer")
        user_dict = prepare_for_mongo(user.dict())
        user_dict["auth_provider"] = "microsoft"
        await db.users.insert_one(user_dict)
        try:
            await _persist_pending_referral(user)
        except Exception as e:
            logging.warning(f"Referral persist failed for social signup {email}: {e}")

    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user.dict()}



@api_router.get("/auth/me/modes")
async def get_my_modes(current_user: User = Depends(get_current_user)):
    """Return which app 'modes' this user can access.

    Customer is always available. Driver requires an approved/active driver row.
    Merchant requires an approved restaurant OR car-rental OR business record.
    Admin is granted by user_type == 'admin'.
    """
    driver_row = await db.drivers.find_one(
        {"user_id": current_user.id, "status": {"$in": ["active", "online", "busy"]}},
        {"_id": 0, "id": 1, "status": 1},
    )
    restaurant_row = await db.restaurants.find_one(
        {"user_id": current_user.id, "status": {"$in": ["active", "approved"]}},
        {"_id": 0, "id": 1, "status": 1},
    )
    rental_row = await db.car_rental_companies.find_one(
        {"user_id": current_user.id, "status": {"$in": ["active", "approved"]}},
        {"_id": 0, "id": 1, "status": 1},
    )
    business_row = await db.business_applications.find_one(
        {"user_id": current_user.id, "verification_status": "verified"},
        {"_id": 0, "id": 1, "verification_status": 1},
    )

    return {
        "customer": True,  # everyone can be a customer
        "driver": bool(driver_row),
        "merchant": bool(restaurant_row or rental_row or business_row),
        "admin": current_user.user_type == "admin",
        "details": {
            "driver_id": driver_row["id"] if driver_row else None,
            "restaurant_id": restaurant_row["id"] if restaurant_row else None,
            "rental_company_id": rental_row["id"] if rental_row else None,
            "business_application_id": business_row["id"] if business_row else None,
        },
    }

@api_router.post("/auth/forgot-password")
async def forgot_password(data: PasswordReset):
    """Initiate password reset"""
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Create reset token (expires in 1 hour)
    reset_token = create_access_token(
        data={"sub": user['id'], "email": user['email'], "type": "password_reset"},
        expires_delta=timedelta(hours=1)
    )
    
    # In production, send email with reset link
    # For now, just return the token
    return {
        "message": "Password reset token generated",
        "token": reset_token  # Remove this in production
    }

@api_router.post("/auth/reset-password")
async def reset_password(data: PasswordResetConfirm):
    """Reset password with token"""
    try:
        payload = jwt.decode(data.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        
        user_id = payload.get("sub")
        hashed_password = get_password_hash(data.new_password)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"hashed_password": hashed_password}}
        )
        
        return {"message": "Password reset successfully"}
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

# Authentication Routes
@api_router.post("/auth/session")
async def create_session(session_data: SessionCreate, request: Request):
    """Process session_id from Emergent Auth"""
    try:
        # Call Emergent Auth API to get user data
        import requests
        response = requests.get(
            'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
            headers={'X-Session-ID': session_data.session_id}
        )
        
        if response.status_code == 200:
            user_data = response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one({"email": user_data["email"]})
            
            if existing_user:
                user = User(**existing_user)
                user.session_token = user_data["session_token"]
                await db.users.update_one(
                    {"id": user.id},
                    {"$set": {"session_token": user_data["session_token"]}}
                )
            else:
                # Create new user
                user = User(
                    email=user_data["email"],
                    name=user_data["name"],
                    picture=user_data.get("picture"),
                    session_token=user_data["session_token"]
                )
                user_dict = prepare_for_mongo(user.dict())
                await db.users.insert_one(user_dict)
            
            # Set httpOnly cookie
            response = JSONResponse({"user": user.dict()})
            response.set_cookie(
                "session_token",
                user_data["session_token"],
                max_age=7 * 24 * 60 * 60,  # 7 days
                httponly=True,
                secure=True,
                samesite="none"
            )
            return response
        else:
            raise HTTPException(status_code=400, detail="Invalid session ID")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/logout")
async def logout(request: Request):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.users.update_one(
            {"session_token": session_token},
            {"$unset": {"session_token": ""}}
        )
    
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie("session_token")
    return response

# Restaurant Management Routes
@api_router.post("/restaurants", response_model=Restaurant)
async def create_restaurant(restaurant: Restaurant, request: Request):
    """Create restaurant profile"""
    current_user = await get_current_user_from_request(request)
    restaurant.user_id = current_user.id
    
    restaurant_dict = prepare_for_mongo(restaurant.dict())
    await db.restaurants.insert_one(restaurant_dict)
    
    # Update user type
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"user_type": "restaurant"}}
    )
    
    return restaurant

# Global Search Endpoint
@api_router.get("/search")
async def global_search(q: str):
    """
    Global search across vendors (restaurants, pharmacies, groceries) and products
    """
    if not q or len(q) < 2:
        return {"results": []}
    
    search_query = {"$regex": q, "$options": "i"}
    results = []
    
    # Search Restaurants
    restaurants = await db.restaurants.find({
        "$or": [
            {"name": search_query},
            {"cuisine": search_query},
            {"description": search_query}
        ],
        "status": "active"
    }).limit(5).to_list(length=None)
    
    for restaurant in restaurants:
        results.append({
            "id": restaurant.get("id"),
            "name": restaurant.get("name"),
            "type": "vendor",
            "vendor_type": "restaurant",
            "description": restaurant.get("description", ""),
            "cuisine": restaurant.get("cuisine", [])
        })
    
    # Search Pharmacies (from business onboarding with pharmacy type)
    pharmacies = await db.businesses.find({
        "$or": [
            {"business_name": search_query},
            {"business_description": search_query}
        ],
        "business_type": "pharmacy",
        "status": "active"
    }).limit(5).to_list(length=None)
    
    for pharmacy in pharmacies:
        results.append({
            "id": pharmacy.get("id"),
            "name": pharmacy.get("business_name"),
            "type": "vendor",
            "vendor_type": "pharmacy",
            "description": pharmacy.get("business_description", "")
        })
    
    # Search Grocery Stores
    groceries = await db.businesses.find({
        "$or": [
            {"business_name": search_query},
            {"business_description": search_query}
        ],
        "business_type": "grocery",
        "status": "active"
    }).limit(5).to_list(length=None)
    
    for grocery in groceries:
        results.append({
            "id": grocery.get("id"),
            "name": grocery.get("business_name"),
            "type": "vendor",
            "vendor_type": "grocery",
            "description": grocery.get("business_description", "")
        })
    
    # Search Menu Items / Products (if you have a menu_items collection)
    # This searches within restaurant menus
    if "menu_items" in await db.list_collection_names():
        menu_items = await db.menu_items.find({
            "$or": [
                {"name": search_query},
                {"description": search_query},
                {"category": search_query}
            ],
            "available": True
        }).limit(10).to_list(length=None)

        # Batch-fetch vendor names in a single query (avoids N+1)
        vendor_ids = list({item.get("vendor_id") for item in menu_items if item.get("vendor_id")})
        vendor_name_by_id: dict = {}
        if vendor_ids:
            async for v in db.restaurants.find({"id": {"$in": vendor_ids}}, {"_id": 0, "id": 1, "name": 1}):
                vendor_name_by_id[v["id"]] = v.get("name")

        for item in menu_items:
            results.append({
                "id": item.get("id"),
                "name": item.get("name"),
                "type": "product",
                "vendor_id": item.get("vendor_id"),
                "vendor_name": vendor_name_by_id.get(item.get("vendor_id"), "Unknown"),
                "price": item.get("price"),
                "description": item.get("description", "")
            })

    return {"results": results[:20]}  # Limit to top 20 results

@api_router.get("/restaurants", response_model=List[Restaurant])
async def get_restaurants():
    """Get all active restaurants, Featured (Pro/Premium) merchants first."""
    restaurants = await db.restaurants.find({"status": "active"}, {"_id": 0}).limit(200).to_list(length=None)
    valid = []
    for r in restaurants:
        try:
            valid.append(Restaurant(**r))
        except Exception:
            # Skip documents that don't conform to the schema (legacy/incomplete seeds)
            continue
    # Featured Partners (Pro/Premium) are pinned to the top, then by rating.
    valid.sort(key=lambda x: (0 if x.featured else 1, -(x.rating or 0)))
    return valid

@api_router.get("/restaurants/{restaurant_id}", response_model=Restaurant)
async def get_restaurant(restaurant_id: str):
    """Get restaurant by ID"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return Restaurant(**restaurant)

# Menu Management Routes
@api_router.post("/menu-items", response_model=MenuItem)
async def create_menu_item(item: MenuItem, request: Request):
    """Create new menu item"""
    current_user = await get_current_user_from_request(request)
    
    # Get restaurant for current user
    restaurant = await db.restaurants.find_one({"user_id": current_user.id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found for user")
    
    item.restaurant_id = restaurant["id"]
    item_dict = prepare_for_mongo(item.dict())
    await db.menu_items.insert_one(item_dict)
    
    return item

@api_router.get("/restaurants/my-menu")
async def get_my_menu(request: Request):
    """Get menu items for current restaurant"""
    current_user = await get_current_user_from_request(request)
    
    # Get restaurant for current user
    restaurant = await db.restaurants.find_one({"user_id": current_user.id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found for user")
    
    menu_items = await db.menu_items.find({"restaurant_id": restaurant["id"]}).limit(500).to_list(length=None)
    return menu_items

@api_router.get("/restaurants/{restaurant_id}/menu")
async def get_restaurant_menu(restaurant_id: str):
    """Get menu items for a restaurant (public)"""
    menu_items = await db.menu_items.find({
        "restaurant_id": restaurant_id,
        "available": True
    }, {"_id": 0}).limit(500).to_list(length=500)
    return menu_items

@api_router.put("/menu-items/{item_id}", response_model=MenuItem)
async def update_menu_item(item_id: str, item: MenuItem, request: Request):
    """Update menu item"""
    current_user = await get_current_user_from_request(request)
    
    # Verify ownership
    existing_item = await db.menu_items.find_one({"id": item_id})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    restaurant = await db.restaurants.find_one({"user_id": current_user.id})
    if not restaurant or restaurant["id"] != existing_item["restaurant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    item.updated_at = datetime.now(timezone.utc)
    item_dict = prepare_for_mongo(item.dict())
    
    await db.menu_items.update_one(
        {"id": item_id},
        {"$set": item_dict}
    )
    
    return item

@api_router.delete("/menu-items/{item_id}")
async def delete_menu_item(item_id: str, request: Request):
    """Delete menu item"""
    current_user = await get_current_user_from_request(request)
    
    # Verify ownership
    existing_item = await db.menu_items.find_one({"id": item_id})
    if not existing_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    restaurant = await db.restaurants.find_one({"user_id": current_user.id})
    if not restaurant or restaurant["id"] != existing_item["restaurant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.menu_items.delete_one({"id": item_id})
    
    return {"success": True}

@api_router.get("/menu-categories")
async def get_menu_categories():
    """Get default menu categories"""
    categories = [
        "Appetizers",
        "Main Course",
        "Desserts",
        "Beverages",
        "Sides",
        "Specials",
        "Breakfast",
        "Lunch",
        "Dinner",
        "Seafood",
        "Vegetarian",
        "Vegan"
    ]
    return categories

# Vendor Dashboard Routes
@api_router.get("/vendors/my-orders")
async def get_vendor_orders(request: Request):
    """Get all orders for current vendor"""
    current_user = await get_current_user_from_request(request)
    
    # Get vendor (restaurant or business)
    restaurant = await db.restaurants.find_one({"user_id": current_user.id})
    business = await db.businesses.find_one({"user_id": current_user.id})
    
    if restaurant:
        orders = await db.orders.find({"restaurant_id": restaurant["id"]}).sort("created_at", -1).limit(200).to_list(length=200)
    elif business:
        orders = await db.orders.find({"vendor_id": business["id"]}).sort("created_at", -1).limit(200).to_list(length=200)
    else:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    return orders

@api_router.get("/vendors/stats")
async def get_vendor_stats(request: Request):
    """Get vendor dashboard statistics"""
    current_user = await get_current_user_from_request(request)
    
    # Get vendor (restaurant or business)
    restaurant = await db.restaurants.find_one({"user_id": current_user.id})
    business = await db.businesses.find_one({"user_id": current_user.id})
    
    if restaurant:
        vendor_id = restaurant["id"]
        filter_field = "restaurant_id"
    elif business:
        vendor_id = business["id"]
        filter_field = "vendor_id"
    else:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Get today's date range
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    # Today's orders
    today_orders = await db.orders.count_documents({
        filter_field: vendor_id,
        "created_at": {
            "$gte": today.isoformat(),
            "$lt": tomorrow.isoformat()
        }
    })
    
    # Today's revenue
    today_orders_list = await db.orders.find({
        filter_field: vendor_id,
        "created_at": {
            "$gte": today.isoformat(),
            "$lt": tomorrow.isoformat()
        },
        "status": {"$ne": "cancelled"}
    }).to_list(length=None)
    
    today_revenue = sum(order.get("vendor_payout", 0) for order in today_orders_list)
    
    # Pending orders
    pending_orders = await db.orders.count_documents({
        filter_field: vendor_id,
        "status": "pending"
    })
    
    # Total earnings (all time) — aggregation avoids loading every delivered order
    vendor_earnings_pipeline = [
        {"$match": {filter_field: vendor_id, "status": "delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$vendor_payout"}}},
    ]
    vendor_earnings_rows = await db.orders.aggregate(vendor_earnings_pipeline).to_list(length=1)
    total_earnings = vendor_earnings_rows[0]["total"] if vendor_earnings_rows else 0
    
    return {
        "today_orders": today_orders,
        "today_revenue": today_revenue,
        "pending_orders": pending_orders,
        "total_earnings": total_earnings
    }

# Admin Panel Routes
@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    """Get admin dashboard statistics"""
    current_user = await get_current_user_from_request(request)
    
    # Check if user is admin (you should have proper role checking)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Total users
    total_users = await db.users.count_documents({})
    
    # Total orders
    total_orders = await db.orders.count_documents({})
    
    # Total revenue (platform earnings) — aggregation avoids loading every delivered order
    revenue_pipeline = [
        {"$match": {"status": "delivered"}},
        {"$group": {"_id": None, "total": {"$sum": "$platform_earnings"}}},
    ]
    revenue_rows = await db.orders.aggregate(revenue_pipeline).to_list(length=1)
    total_revenue = revenue_rows[0]["total"] if revenue_rows else 0
    
    # Active drivers
    active_drivers = await db.drivers.count_documents({"status": "online"})
    
    # Active vendors
    active_vendors = await db.restaurants.count_documents({"status": "active"})
    active_vendors += await db.businesses.count_documents({"status": "active"})
    
    # Pending verifications
    pending_verifications = await db.restaurants.count_documents({"status": "pending"})
    pending_verifications += await db.drivers.count_documents({"status": "pending"})
    
    return {
        "total_users": total_users,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "active_drivers": active_drivers,
        "active_vendors": active_vendors,
        "pending_verifications": pending_verifications
    }

@api_router.get("/admin/users")
async def get_all_users(request: Request, limit: int = 500, q: Optional[str] = None, user_type: Optional[str] = None):
    """Get all users for admin. Supports search (`q`) and a `user_type` filter
    (customer | merchant | driver | admin | agent). 'merchant' matches restaurant+business owners."""
    current_user = await get_current_user_from_request(request)

    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query: Dict[str, Any] = {}
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"email": rx}, {"name": rx}, {"phone": rx}]
    ut = (user_type or "").lower().strip()
    if ut and ut != "all":
        if ut == "merchant":
            query["user_type"] = {"$in": ["restaurant", "business", "merchant"]}
        elif ut == "customer":
            query["user_type"] = {"$in": ["customer", None]}
        else:
            query["user_type"] = ut

    users = (
        await db.users.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(max(1, min(limit, 2000)))
        .to_list(length=None)
    )
    for u in users:
        u["email_is_real"] = graph_mail.is_real_email(u.get("email"))
    return users

@api_router.get("/admin/orders")
async def get_all_orders(request: Request, limit: int = 100):
    """Get all orders for admin"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=None)
    return orders

@api_router.get("/admin/disputes")
async def get_all_disputes(request: Request):
    """Get all disputes for admin"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # In production, you'd have a disputes collection
    # For now return empty
    return []

@api_router.post("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str, request: Request):
    """Suspend a user"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "suspended"}}
    )
    
    return {"success": True}

@api_router.post("/admin/users/{user_id}/activate")
async def activate_user(user_id: str, request: Request):
    """Activate a user"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "active"}}
    )
    
    return {"success": True}


class UserStatusUpdate(BaseModel):
    status: str  # active | paused | restricted


@api_router.post("/admin/users/{user_id}/set-status")
async def set_user_status(user_id: str, payload: UserStatusUpdate, request: Request):
    """Admin: set an account's status to active (approve), paused, or restricted.
    Paused/restricted accounts are blocked from login and authenticated API access."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    status = (payload.status or "").lower().strip()
    if status not in ("active", "paused", "restricted"):
        raise HTTPException(status_code=400, detail="Invalid status. Use 'active', 'paused' or 'restricted'.")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if status != "active":
        if user_id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot pause or restrict your own account.")
        if target.get("is_owner"):
            raise HTTPException(status_code=400, detail="The owner account cannot be paused or restricted.")
        if (target.get("user_type") or "").lower() in ("admin", "agent"):
            raise HTTPException(status_code=400, detail="Staff accounts cannot be paused or restricted from here.")
    await db.users.update_one({"id": user_id}, {"$set": {"status": status}})
    return {"success": True, "id": user_id, "status": status}


class AdminUserMessage(BaseModel):
    subject: str
    body: str


@api_router.post("/admin/users/{user_id}/message")
async def message_user(user_id: str, payload: AdminUserMessage, request: Request):
    """Admin: send a direct email to a user. Blocks placeholder/QA addresses."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    subject = (payload.subject or "").strip()
    body = (payload.body or "").strip()
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Subject and message body are required")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = user.get("email")
    if not graph_mail.is_real_email(email):
        raise HTTPException(
            status_code=400,
            detail="This user has no valid email address on file (placeholder/test account). Message not sent.",
        )

    name = user.get("name") or "there"
    safe_body = body.replace("\n", "<br/>")
    html = (
        f"<div style='font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5'>"
        f"<p>Hi {name},</p><p>{safe_body}</p>"
        "<p style='margin-top:24px;color:#888;font-size:12px'>— The IslandHop Team</p></div>"
    )
    try:
        await graph_mail.send_mail(email, subject, html, mailbox=graph_mail.notify_mailbox("support"))
    except graph_mail.InvalidRecipientEmail:
        raise HTTPException(status_code=400, detail="This user has no valid email address on file. Message not sent.")
    except graph_mail.GraphNotConfigured:
        raise HTTPException(status_code=503, detail="Email service is not configured.")
    except graph_mail.GraphConsentMissing:
        raise HTTPException(status_code=503, detail="Email admin consent not granted yet.")
    return {"success": True, "sent_to": email}


@api_router.get("/admin/users/{user_id}/profile")
async def get_user_profile(user_id: str, request: Request):
    """Full customer profile for the admin Users tab: details + order stats + recent orders."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "session_token": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["email_is_real"] = graph_mail.is_real_email(user.get("email"))

    orders = await db.orders.find({"customer_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    paid_statuses = {"paid", "cod_pending", "cod_collected", "cod_paid"}
    total_spent = round(sum(float(o.get("total", 0) or 0) for o in orders if o.get("payment_status") in paid_statuses), 2)
    stats = {
        "order_count": len(orders),
        "total_spent": total_spent,
        "delivered": sum(1 for o in orders if o.get("status") == "delivered"),
        "active": sum(1 for o in orders if o.get("status") not in ("delivered", "cancelled")),
    }
    recent = [{
        "id": o.get("id"), "service_type": o.get("service_type"), "status": o.get("status"),
        "total": o.get("total"), "payment_method": o.get("payment_method"),
        "payment_status": o.get("payment_status"), "created_at": o.get("created_at"),
    } for o in orders[:5]]

    # Role-specific record
    role_record = None
    if user.get("user_type") == "driver":
        role_record = await db.drivers.find_one({"user_id": user_id}, {"_id": 0})
    elif user.get("user_type") in ("restaurant", "business"):
        role_record = await db.restaurants.find_one({"user_id": user_id}, {"_id": 0})

    referrer = None
    if user.get("referred_by"):
        ref = await db.users.find_one({"id": user["referred_by"]}, {"_id": 0, "name": 1, "email": 1})
        if ref:
            referrer = {"name": ref.get("name"), "email": ref.get("email")}

    return {"user": user, "stats": stats, "recent_orders": recent, "role_record": role_record, "referrer": referrer}

@api_router.post("/admin/orders/{order_id}/cancel")
async def admin_cancel_order(order_id: str, request: Request):
    """Admin cancel an order"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "cancelled", "cancelled_by": "admin"}}
    )
    
    return {"success": True}

# ---- Admin: Fraud Review Queue ----
@api_router.get("/admin/fraud-queue")
async def admin_fraud_queue(request: Request, status: str = "open", limit: int = 100):
    """List fraud flags. Default returns only open flags."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query: dict = {}
    if status and status != "all":
        query["status"] = status
    flags = await db.fraud_flags.find(query).sort("created_at", -1).limit(limit).to_list(length=limit)
    for f in flags:
        f.pop("_id", None)

    # Batch-hydrate orders + customers in 2 queries (avoids N+1)
    order_ids = list({f.get("order_id") for f in flags if f.get("order_id")})
    customer_ids = list({f.get("customer_id") for f in flags if f.get("customer_id")})
    orders_by_id: dict = {}
    customers_by_id: dict = {}
    if order_ids:
        async for o in db.orders.find(
            {"id": {"$in": order_ids}},
            {"_id": 0, "id": 1, "service_type": 1, "total": 1, "status": 1, "payment_status": 1, "created_at": 1},
        ):
            orders_by_id[o["id"]] = o
    if customer_ids:
        async for c in db.users.find(
            {"id": {"$in": customer_ids}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "phone_verified": 1},
        ):
            customers_by_id[c["id"]] = c
    for f in flags:
        f["order"] = orders_by_id.get(f.get("order_id"))
        f["customer"] = customers_by_id.get(f.get("customer_id"))

    open_count = await db.fraud_flags.count_documents({"status": "open"})
    return {"flags": flags, "open_count": open_count}


@api_router.post("/admin/fraud-queue/{flag_id}/review")
async def admin_fraud_review(flag_id: str, payload: FraudReviewAction, request: Request):
    """Resolve a fraud flag. action='clear' marks safe, 'confirm' marks confirmed_fraud."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    action = (payload.action or "").lower()
    if action not in {"clear", "confirm"}:
        raise HTTPException(status_code=400, detail="action must be 'clear' or 'confirm'")

    flag = await db.fraud_flags.find_one({"id": flag_id})
    if not flag:
        raise HTTPException(status_code=404, detail="Fraud flag not found")
    if flag.get("status") != "open":
        raise HTTPException(status_code=400, detail=f"Flag already {flag.get('status')}")

    new_status = "cleared" if action == "clear" else "confirmed_fraud"
    await db.fraud_flags.update_one(
        {"id": flag_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": current_user.id,
            "review_notes": payload.notes,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # If confirmed fraud, cancel order and suspend the customer
    if action == "confirm":
        await db.orders.update_one(
            {"id": flag.get("order_id")},
            {"$set": {"status": "cancelled", "cancelled_by": "fraud_review"}},
        )
        await db.users.update_one(
            {"id": flag.get("customer_id")},
            {"$set": {"status": "suspended", "suspended_reason": "fraud_review"}},
        )

    return {"success": True, "status": new_status}


# Promo Code Routes
@api_router.post("/promo-codes", response_model=PromoCode)
async def create_promo_code(promo: PromoCode, request: Request):
    """Create new promo code (admin only)"""
    _ = await get_current_user_from_request(request)
    
    # Check if code already exists
    existing = await db.promo_codes.find_one({"code": promo.code})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    promo_dict = prepare_for_mongo(promo.dict())
    await db.promo_codes.insert_one(promo_dict)
    
    return promo

@api_router.get("/promo-codes")
async def get_promo_codes(active_only: bool = False):
    """Get all promo codes"""
    query = {"active": True} if active_only else {}
    promo_codes = await db.promo_codes.find(query, {"_id": 0}).limit(200).to_list(length=None)
    return promo_codes

# --- Promo validation helpers (shared by validate_promo_code & apply_promo_to_order) ---
def _parse_promo_dates(promo: dict) -> tuple:
    """Return (valid_from, valid_until) as tz-aware datetimes, or (None, None)."""
    try:
        vf = datetime.fromisoformat(promo["valid_from"].replace('Z', '+00:00'))
        vu = datetime.fromisoformat(promo["valid_until"].replace('Z', '+00:00'))
        if vf.tzinfo is None:
            vf = vf.replace(tzinfo=timezone.utc)
        if vu.tzinfo is None:
            vu = vu.replace(tzinfo=timezone.utc)
        return vf, vu
    except KeyError:
        return None, None

def _assert_promo_dates_valid(promo: dict) -> None:
    vf, vu = _parse_promo_dates(promo)
    if vf is None:
        return
    now = datetime.now(timezone.utc)
    if now < vf:
        raise HTTPException(status_code=400, detail="Promo code not yet valid")
    if now > vu:
        raise HTTPException(status_code=400, detail="Promo code has expired")

def _assert_promo_usage_within_limit(promo: dict) -> None:
    if promo.get("usage_limit") and promo.get("used_count", 0) >= promo["usage_limit"]:
        raise HTTPException(status_code=400, detail="Promo code usage limit reached")

def _assert_promo_min_order(promo: dict, order_total: float) -> None:
    if order_total < promo.get("min_order_amount", 0):
        raise HTTPException(status_code=400, detail=f"Minimum order amount is ${promo.get('min_order_amount', 0)}")

def _assert_promo_service_type(promo: dict, service_type: Optional[str]) -> None:
    service_types = promo.get("service_types") or []
    if service_types and service_type not in service_types:
        raise HTTPException(status_code=400, detail="Promo code not valid for this service type")

def _calc_promo_discount(promo: dict, subtotal: float, delivery_fee: float = 5.0) -> float:
    """Compute discount value (rounded, capped at subtotal)."""
    ptype = promo.get("type")
    if ptype == "percentage":
        discount = subtotal * (float(promo["value"]) / 100.0)
        if promo.get("max_discount"):
            discount = min(discount, float(promo["max_discount"]))
    elif ptype == "fixed_amount":
        discount = float(promo["value"])
    elif ptype == "free_delivery":
        discount = float(delivery_fee or 0)
    else:
        discount = 0.0
    return round(min(discount, subtotal), 2)

@api_router.get("/promo-codes/{code}/validate")
async def validate_promo_code(code: str, order_total: float, service_type: str):
    """Validate promo code for an order"""
    promo = await db.promo_codes.find_one({"code": code.upper()})
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    if not promo.get("active"):
        raise HTTPException(status_code=400, detail="Promo code is inactive")

    _assert_promo_dates_valid(promo)
    _assert_promo_usage_within_limit(promo)
    _assert_promo_min_order(promo, order_total)
    _assert_promo_service_type(promo, service_type)

    discount = _calc_promo_discount(promo, order_total)
    return {
        "valid": True,
        "code": promo["code"],
        "type": promo["type"],
        "discount": discount,
        "message": f"Promo code applied! You save ${discount}",
    }

@api_router.post("/promo-codes/{code}/apply")
async def apply_promo_code(code: str, user_id: str):
    """Mark promo code as used"""
    promo = await db.promo_codes.find_one({"code": code.upper()})
    
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    # Increment usage count
    await db.promo_codes.update_one(
        {"code": code.upper()},
        {"$inc": {"used_count": 1}}
    )
    
    # Track user usage (for per-user limits)
    await db.promo_code_usage.insert_one({
        "promo_code_id": promo["id"],
        "user_id": user_id,
        "used_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True}

@api_router.put("/promo-codes/{promo_id}", response_model=PromoCode)
async def update_promo_code(promo_id: str, promo: PromoCode, request: Request):
    """Update promo code"""
    _ = await get_current_user_from_request(request)
    
    promo_dict = prepare_for_mongo(promo.dict())
    await db.promo_codes.update_one(
        {"id": promo_id},
        {"$set": promo_dict}
    )
    
    return promo

@api_router.delete("/promo-codes/{promo_id}")
async def delete_promo_code(promo_id: str, request: Request):
    """Delete promo code"""
    _ = await get_current_user_from_request(request)
    
    await db.promo_codes.delete_one({"id": promo_id})
    
    return {"success": True}

# Address Management Routes
@api_router.post("/addresses", response_model=Address)
async def create_address(address: Address, request: Request):
    """Create new address"""
    current_user = await get_current_user_from_request(request)
    address.user_id = current_user.id
    
    # If this is set as default, unset other defaults
    if address.is_default:
        await db.addresses.update_many(
            {"user_id": current_user.id},
            {"$set": {"is_default": False}}
        )
    
    address_dict = prepare_for_mongo(address.dict())
    await db.addresses.insert_one(address_dict)
    
    return address

@api_router.get("/addresses")
async def get_user_addresses(request: Request):
    """Get user's saved addresses"""
    current_user = await get_current_user_from_request(request)
    addresses = await db.addresses.find({"user_id": current_user.id}, {"_id": 0}).limit(50).to_list(length=50)
    return addresses

@api_router.put("/addresses/{address_id}", response_model=Address)
async def update_address(address_id: str, address: Address, request: Request):
    """Update address"""
    current_user = await get_current_user_from_request(request)
    
    # Verify ownership
    existing = await db.addresses.find_one({"id": address_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Force server-controlled fields (prevent client from overwriting ownership)
    address.id = address_id
    address.user_id = current_user.id
    
    # If setting as default, unset other defaults
    if address.is_default:
        await db.addresses.update_many(
            {"user_id": current_user.id, "id": {"$ne": address_id}},
            {"$set": {"is_default": False}}
        )
    
    address.updated_at = datetime.now(timezone.utc)
    address_dict = prepare_for_mongo(address.dict())
    
    await db.addresses.update_one(
        {"id": address_id},
        {"$set": address_dict}
    )
    
    return address

@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, request: Request):
    """Delete address"""
    current_user = await get_current_user_from_request(request)
    
    # Verify ownership
    existing = await db.addresses.find_one({"id": address_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")
    
    await db.addresses.delete_one({"id": address_id})
    
    return {"success": True}

@api_router.post("/addresses/{address_id}/set-default")
async def set_default_address(address_id: str, request: Request):
    """Set address as default"""
    current_user = await get_current_user_from_request(request)
    
    # Verify ownership
    existing = await db.addresses.find_one({"id": address_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Address not found")
    
    # Unset all defaults
    await db.addresses.update_many(
        {"user_id": current_user.id},
        {"$set": {"is_default": False}}
    )
    
    # Set this as default
    await db.addresses.update_one(
        {"id": address_id},
        {"$set": {"is_default": True}}
    )
    
    return {"success": True}

# Support Ticket Routes
@api_router.post("/support/tickets", response_model=SupportTicket)
async def create_support_ticket(ticket: SupportTicket, request: Request):
    """Create new support ticket"""
    current_user = await get_current_user_from_request(request)
    ticket.user_id = current_user.id
    
    ticket_dict = prepare_for_mongo(ticket.dict())
    await db.support_tickets.insert_one(ticket_dict)

    # Best-effort: alert the support mailbox + acknowledge the user. Never blocks ticket creation.
    async def _notify_support_ticket():
        support_box = graph_mail.notify_mailbox("support")
        internal_html = (
            f"<h2>New support ticket — {ticket.category}</h2>"
            f"<ul><li><b>Subject:</b> {ticket.subject}</li>"
            f"<li><b>From:</b> {current_user.name} ({current_user.email})</li>"
            f"<li><b>Priority:</b> {ticket.priority}</li>"
            f"{f'<li><b>Order:</b> {ticket.order_id}</li>' if ticket.order_id else ''}</ul>"
            f"<p>{(ticket.description or '').replace(chr(10),'<br/>')}</p>"
            f"<p style='color:#888'>Ticket ID: {ticket.id}</p>"
        )
        try:
            await graph_mail.send_mail(support_box, f"New support ticket: {ticket.subject}",
                                       internal_html, mailbox=support_box)
        except Exception as exc:  # noqa: BLE001
            logging.warning(f"Support-ticket alert email failed: {exc}")
        try:
            if current_user.email:
                ack = (f"<p>Hi {current_user.name or 'there'},</p>"
                       f"<p>We've received your support request <b>“{ticket.subject}”</b> and our team "
                       f"will get back to you shortly.</p><p>— The IslandHop Team</p>")
                await graph_mail.send_mail(current_user.email, "We received your support request",
                                           ack, mailbox=support_box)
        except Exception as exc:  # noqa: BLE001
            logging.warning(f"Support-ticket ack email failed: {exc}")
    asyncio.create_task(_notify_support_ticket())

    return ticket

@api_router.get("/support/tickets")
async def get_user_tickets(request: Request):
    """Get user's support tickets"""
    current_user = await get_current_user_from_request(request)
    tickets = await db.support_tickets.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(length=100)
    return tickets

@api_router.get("/support/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, request: Request):
    """Get ticket details"""
    current_user = await get_current_user_from_request(request)
    ticket = await db.support_tickets.find_one({"id": ticket_id, "user_id": current_user.id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@api_router.post("/support/tickets/{ticket_id}/messages", response_model=TicketMessage)
async def add_ticket_message(ticket_id: str, payload: TicketMessageCreate, request: Request):
    """Add message to ticket (JSON body)."""
    current_user = await get_current_user_from_request(request)

    # Verify ticket ownership OR admin/agent role
    is_staff = current_user.user_type in ("admin", "agent")
    query = {"id": ticket_id} if is_staff else {"id": ticket_id, "user_id": current_user.id}
    ticket = await db.support_tickets.find_one(query)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    sender_type = payload.sender_type or ("agent" if is_staff else "customer")
    ticket_message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        sender_type=sender_type,
        message=payload.message,
    )
    await db.ticket_messages.insert_one(prepare_for_mongo(ticket_message.dict()))

    # Reopen if customer replies on a resolved ticket
    if sender_type == "customer" and ticket.get("status") in ("resolved", "closed"):
        await db.support_tickets.update_one(
            {"id": ticket_id},
            {"$set": {"status": "open", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

    return ticket_message

@api_router.get("/support/tickets/{ticket_id}/messages")
async def get_ticket_messages(ticket_id: str, request: Request):
    """Get all messages for a ticket (owner or staff)."""
    current_user = await get_current_user_from_request(request)
    is_staff = current_user.user_type in ("admin", "agent")
    query = {"id": ticket_id} if is_staff else {"id": ticket_id, "user_id": current_user.id}
    ticket = await db.support_tickets.find_one(query)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    messages = await db.ticket_messages.find(
        {"ticket_id": ticket_id}, {"_id": 0}
    ).sort("created_at", 1).limit(1000).to_list(length=1000)
    return messages

@api_router.put("/support/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str, request: Request):
    """Close support ticket"""
    current_user = await get_current_user_from_request(request)
    
    # Verify ticket ownership
    ticket = await db.support_tickets.find_one({"id": ticket_id, "user_id": current_user.id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": "closed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True}

# ---- Customer Claims (built on top of support tickets) ----
ALLOWED_CLAIM_TYPES = {"wrong_item", "missing_item", "damaged", "late", "quality", "other"}

@api_router.post("/claims", response_model=SupportTicket)
async def create_claim(claim: SupportTicket, request: Request):
    """File a customer claim against an order (creates a support ticket with category='claim')."""
    current_user = await get_current_user_from_request(request)
    if not claim.order_id:
        raise HTTPException(status_code=400, detail="order_id is required for a claim")
    if claim.claim_type and claim.claim_type not in ALLOWED_CLAIM_TYPES:
        raise HTTPException(status_code=400, detail=f"claim_type must be one of {sorted(ALLOWED_CLAIM_TYPES)}")

    # Verify the order belongs to the user
    order = await db.orders.find_one({"id": claim.order_id, "customer_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    claim.user_id = current_user.id
    claim.category = "claim"
    if not claim.subject:
        claim.subject = f"Claim: {claim.claim_type or 'other'} (order {claim.order_id[:8]})"

    await db.support_tickets.insert_one(prepare_for_mongo(claim.dict()))
    return claim


@api_router.get("/claims")
async def list_my_claims(request: Request):
    """List the current user's claims (subset of tickets with category='claim')."""
    current_user = await get_current_user_from_request(request)
    claims = await db.support_tickets.find(
        {"user_id": current_user.id, "category": "claim"}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(length=100)
    return claims


@api_router.post("/claims/{ticket_id}/resolve")
async def resolve_claim(ticket_id: str, payload: ResolveClaimRequest, request: Request):
    """Admin-only: resolve a customer claim. If approved with credit_amount, credit the customer's wallet."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin/agent access required")

    resolution = (payload.resolution or "").lower()
    if resolution not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="resolution must be 'approved' or 'rejected'")

    ticket = await db.support_tickets.find_one({"id": ticket_id, "category": "claim"})
    if not ticket:
        raise HTTPException(status_code=404, detail="Claim not found")
    if ticket.get("status") in ("resolved", "closed"):
        raise HTTPException(status_code=400, detail="Claim is already resolved")

    new_status = "resolved" if resolution == "approved" else "closed"
    update_doc = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }
    if resolution == "approved" and payload.credit_amount and payload.credit_amount > 0:
        await _credit_wallet_with_txn(
            ticket["user_id"],
            _round_money(payload.credit_amount),
            "USD",
            txn_type="refund",
            note=f"Claim approved (ticket {ticket_id})",
        )
        update_doc["resolution_credit"] = _round_money(payload.credit_amount)

    await db.support_tickets.update_one({"id": ticket_id}, {"$set": update_doc})

    # Auto-post a system message on the thread
    sys_msg_text = (
        f"Claim approved. ${payload.credit_amount:.2f} credited to your wallet."
        if resolution == "approved" and payload.credit_amount
        else f"Claim {resolution}." + (f" Notes: {payload.notes}" if payload.notes else "")
    )
    sys_msg = TicketMessage(
        ticket_id=ticket_id, sender_id=current_user.id, sender_type="system", message=sys_msg_text
    )
    await db.ticket_messages.insert_one(prepare_for_mongo(sys_msg.dict()))

    return {"success": True, "status": new_status, "credit_amount": update_doc.get("resolution_credit")}


@api_router.get("/admin/claims")
async def admin_list_claims(request: Request, status: str = "open", limit: int = 200):
    """Admin-only: list all claims across users."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin/agent access required")
    query: dict = {"category": "claim"}
    if status and status != "all":
        query["status"] = status
    rows = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=None)
    return rows

# Order Management Routes
# ---- Fraud detection helpers ----
HIGH_VALUE_ORDER_THRESHOLD = 500.0
VELOCITY_WINDOW_MINUTES = 30
VELOCITY_ORDER_COUNT = 5  # orders within window
NEW_ACCOUNT_HOURS = 24

def _parse_account_created(customer: dict) -> Optional[datetime]:
    """Best-effort parse of `users.created_at` into a tz-aware datetime."""
    raw = customer.get("created_at")
    try:
        if isinstance(raw, str):
            dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        elif isinstance(raw, datetime):
            dt = raw
        else:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _signal_high_value(total: float) -> Optional[str]:
    return "high_value" if total >= HIGH_VALUE_ORDER_THRESHOLD else None


def _signal_new_account_high_value(total: float, account_created: Optional[datetime]) -> Optional[str]:
    if account_created is None or total < 100.0:
        return None
    age_hours = (datetime.now(timezone.utc) - account_created).total_seconds() / 3600.0
    return "new_account_high_value" if age_hours < NEW_ACCOUNT_HOURS else None


async def _signal_velocity(customer_id: Optional[str]) -> Optional[str]:
    if not customer_id:
        return None
    window_start = (datetime.now(timezone.utc) - timedelta(minutes=VELOCITY_WINDOW_MINUTES)).isoformat()
    recent = await db.orders.count_documents({
        "customer_id": customer_id,
        "created_at": {"$gte": window_start},
    })
    return "velocity" if recent >= VELOCITY_ORDER_COUNT else None


def _signal_unverified_phone(customer: dict, total: float) -> Optional[str]:
    if customer.get("phone_verified", False):
        return None
    return "unverified_phone" if total >= 100.0 else None


async def _evaluate_fraud_signals(order_dict: dict, customer: dict) -> List[str]:
    """Return list of fraud signal codes for an order. Heuristic, deterministic."""
    total = float(order_dict.get("total", 0) or 0)
    account_created = _parse_account_created(customer)
    signals = [
        _signal_high_value(total),
        _signal_new_account_high_value(total, account_created),
        await _signal_velocity(customer.get("id")),
        _signal_unverified_phone(customer, total),
    ]
    return [s for s in signals if s]


def _signals_to_severity(signals: List[str]) -> str:
    if not signals:
        return "low"
    high_signals = {"velocity", "new_account_high_value"}
    if any(s in high_signals for s in signals):
        return "high"
    if "high_value" in signals or len(signals) >= 2:
        return "medium"
    return "low"


async def _maybe_flag_order(order_dict: dict, extra_signals: Optional[List[str]] = None) -> Optional[dict]:
    """Evaluate signals and create a FraudFlag if any are triggered. Idempotent per order."""
    customer = await db.users.find_one({"id": order_dict.get("customer_id")})
    if not customer:
        return None
    signals = await _evaluate_fraud_signals(order_dict, customer)
    if extra_signals:
        for s in extra_signals:
            if s not in signals:
                signals.append(s)
    if not signals:
        return None

    existing = await db.fraud_flags.find_one({"order_id": order_dict.get("id"), "status": "open"})
    if existing:
        # Merge any new signals into the existing open flag
        merged = list(dict.fromkeys((existing.get("signals") or []) + signals))
        await db.fraud_flags.update_one(
            {"id": existing["id"]},
            {"$set": {"signals": merged, "severity": _signals_to_severity(merged)}},
        )
        existing["signals"] = merged
        existing["severity"] = _signals_to_severity(merged)
        return existing

    flag = FraudFlag(
        order_id=order_dict.get("id"),
        customer_id=order_dict.get("customer_id"),
        amount=float(order_dict.get("total", 0) or 0),
        signals=signals,
        severity=_signals_to_severity(signals),
    )
    flag_doc = prepare_for_mongo(flag.dict())
    await db.fraud_flags.insert_one(flag_doc)
    return flag_doc


class TaxiQuoteRequest(BaseModel):
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: float
    dropoff_lng: float
    vehicle_type: str = "standard"


@api_router.get("/taxi/rate-card")
async def taxi_rate_card():
    """Public taxi rate card (TT$ + USD) for the booking UI."""
    return {"vehicles": taxi_pricing.rate_card_public(), "rate_ttd_per_usd": taxi_pricing.TTD_PER_USD}


@api_router.post("/taxi/quote")
async def taxi_quote(payload: TaxiQuoteRequest):
    """Estimate a taxi fare from real driving distance + time (Google Directions).
    Fare is computed server-side so it can't be tampered with. Public (pre-login)."""
    if payload.vehicle_type not in taxi_pricing.TAXI_RATE_CARD:
        raise HTTPException(status_code=400, detail="Unknown vehicle type")
    try:
        distance_km, duration_min = await taxi_pricing.road_distance_duration(
            (payload.pickup_lat, payload.pickup_lng),
            (payload.dropoff_lat, payload.dropoff_lng),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Could not find a driving route between those points: {exc}")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Taxi quote routing failed: {exc}")
        raise HTTPException(status_code=503, detail="Fare estimate service is temporarily unavailable.")
    return taxi_pricing.compute_fare(distance_km, duration_min, payload.vehicle_type)


@api_router.post("/orders", response_model=Order)
async def create_order(order: Order, request: Request):
    """Create new order with automatic commission calculation"""
    current_user = await get_current_user_from_request(request)
    order.customer_id = current_user.id

    # Taxi: recompute the fare server-side from real driving distance so the
    # delivery_fee (the ride fare) can't be tampered with by the client.
    if order.service_type == "taxi":
        pa, da = order.pickup_address or {}, order.delivery_address or {}
        p_lat, p_lng = pa.get("latitude"), pa.get("longitude")
        d_lat, d_lng = da.get("latitude"), da.get("longitude")
        if None not in (p_lat, p_lng, d_lat, d_lng):
            try:
                dist_km, dur_min = await taxi_pricing.road_distance_duration((p_lat, p_lng), (d_lat, d_lng))
                quote = taxi_pricing.compute_fare(dist_km, dur_min, pa.get("vehicle_type") or order.vendor_id or "standard")
                order.subtotal = 0.0
                order.delivery_fee = quote["fare_usd"]
            except Exception as exc:  # noqa: BLE001 — fall back to client-provided fare
                logging.warning(f"Taxi fare recompute failed for order {order.id}: {exc}")
    
    # Determine vendor ID and type
    vendor_id = order.restaurant_id or order.vendor_id
    vendor_type = _derive_vendor_type(order.service_type)
    
    # Calculate commission and payment splits
    order = await calculate_order_financials(order, vendor_id, vendor_type)
    
    # Calculate estimated delivery time
    order.estimated_delivery_time = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    order_dict = prepare_for_mongo(order.dict())
    await db.orders.insert_one(order_dict)

    # Fraud scoring (idempotent; only persists if signals fire)
    try:
        await _maybe_flag_order(order_dict)
    except Exception as e:
        logging.warning(f"Fraud scoring failed for order {order.id}: {e}")

    # Notify vendor via WebSocket
    if vendor_id:
        await manager.send_personal_message(
            json.dumps({
                "type": "new_order",
                "order_id": order.id,
                "vendor_payout": order.vendor_payout
            }),
            vendor_id
        )
    
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_user_orders(request: Request):
    """Get orders for current user"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type == "customer":
        orders = await db.orders.find({"customer_id": current_user.id}).sort("created_at", -1).limit(200).to_list(length=200)
    elif current_user.user_type == "restaurant":
        restaurant = await db.restaurants.find_one({"user_id": current_user.id})
        if restaurant:
            orders = await db.orders.find({"restaurant_id": restaurant["id"]}).sort("created_at", -1).limit(200).to_list(length=200)
        else:
            orders = []
    elif current_user.user_type == "driver":
        driver = await db.drivers.find_one({"user_id": current_user.id})
        if driver:
            orders = await db.orders.find({"driver_id": driver["id"]}).sort("created_at", -1).limit(200).to_list(length=200)
        else:
            orders = []
    else:
        orders = []
    
    return [Order(**order) for order in orders]

def _status_timestamp_field(status: str) -> Optional[str]:
    """Map order status → the field to set with the current UTC timestamp."""
    return {
        "confirmed": "confirmed_at",
        "ready": "prepared_at",
        "picked_up": "picked_up_at",
        "delivered": "delivered_at",
    }.get(status)


async def _authorize_order_status_change(current_user: User, order: dict) -> None:
    """Raise 403 if current_user cannot update this order's status."""
    if current_user.user_type in ("admin", "agent"):
        return
    if current_user.user_type == "restaurant":
        restaurant = await db.restaurants.find_one({"user_id": current_user.id})
        if restaurant and restaurant["id"] == order["restaurant_id"]:
            return
    if current_user.user_type == "driver":
        driver = await db.drivers.find_one({"user_id": current_user.id})
        if driver and driver["id"] == order.get("driver_id"):
            return
    raise HTTPException(status_code=403, detail="Not authorized to update this order")


async def _credit_driver_on_delivery(order: dict, order_id: str) -> dict:
    """When an order is delivered, top up the driver's legacy wallet AND in-app wallet.

    Returns the partial update dict to merge into update_data.
    """
    driver_id = order.get("driver_id")
    if not driver_id:
        return {}
    driver_earnings = order.get("driver_earnings", 0)
    now_iso = datetime.now(timezone.utc).isoformat()

    await db.driver_wallets.update_one(
        {"driver_id": driver_id},
        {
            "$inc": {"balance": driver_earnings, "total_earned": driver_earnings},
            "$set": {"updated_at": now_iso},
        },
        upsert=True,
    )

    driver_row = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    driver_user_id = (driver_row or {}).get("user_id")
    if driver_user_id and driver_earnings:
        tip_part = float(order.get("tip", 0) or 0)
        delivery_part = max(float(driver_earnings) - tip_part, 0.0)
        if delivery_part > 0:
            await _credit_wallet_with_txn(
                driver_user_id, delivery_part, "USD",
                txn_type="payout_in", order_id=order_id, note="Delivery earnings",
            )
        if tip_part > 0:
            await _credit_wallet_with_txn(
                driver_user_id, tip_part, "USD",
                txn_type="tip_in", order_id=order_id,
                counterparty_user_id=order.get("customer_id"), note="Customer tip",
            )
    return {"driver_payout_status": "accumulated"}


async def _wa_notify(phone: str, body: str, user_id: Optional[str] = None,
                     event: Optional[str] = None, order_id: Optional[str] = None,
                     content_sid: Optional[str] = None, content_variables: Optional[dict] = None):
    """Send a WhatsApp-first notification and log it to whatsapp_messages. Never raises.

    Uses the unified WhatsApp-first engine: on 63005 (no 24h session) it logs and skips,
    on other errors it falls back to SMS. Returns the send result (or None if no phone)."""
    norm = _normalize_phone(phone or "")
    if not norm:
        return None
    try:
        result = twilio_client.send_notification(
            norm, body, channel="whatsapp",
            content_sid=content_sid, content_variables=content_variables,
        )
        await db.whatsapp_messages.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "order_id": order_id,
            "phone": norm,
            "direction": "outbound",
            "body": body,
            "status": result.get("status", "failed" if not result.get("success") else "queued"),
            "twilio_sid": result.get("sid"),
            "automated": True,
            "event": event,
            "channel_used": result.get("channel_used", "whatsapp"),
            "skipped": result.get("skipped", False),
            "mock": result.get("mock", False),
            "error": result.get("error"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        if not result.get("success") and not result.get("skipped"):
            logging.warning(f"WA notify ({event}) to {norm} failed: {result.get('error')} ({result.get('error_code')})")
        return result
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"WA notify ({event}) crashed: {exc}")
        return None


# Map order status → WhatsApp message + optional approved-template env key.
# Template SIDs are required to message customers outside WhatsApp's 24h window;
# if unset, we send free-form (delivers only within the 24h session window).
ORDER_WHATSAPP_EVENTS = {
    "confirmed": ("✅ Your IslandHop order #{short} is confirmed and being prepared.", "WHATSAPP_TEMPLATE_CONFIRMED_SID"),
    "picked_up": ("🛵 Your IslandHop order #{short} has been picked up and is on the way!", "WHATSAPP_TEMPLATE_PICKED_UP_SID"),
    "out_for_delivery": ("🛵 Your IslandHop order #{short} is out for delivery!", "WHATSAPP_TEMPLATE_PICKED_UP_SID"),
    "delivered": ("🎉 Your IslandHop order #{short} has been delivered. Enjoy! 🌴", "WHATSAPP_TEMPLATE_DELIVERED_SID"),
}


async def _notify_order_whatsapp(order: dict, status: str):
    """Best-effort WhatsApp order-status update to the customer. Never raises."""
    cfg = ORDER_WHATSAPP_EVENTS.get(status)
    if not cfg:
        return
    msg_template, template_env_key = cfg
    short = str(order.get("id", ""))[:8]
    body = msg_template.format(short=short)
    content_sid = os.environ.get(template_env_key) or None
    await _wa_notify(
        order.get("customer_phone") or "", body,
        user_id=order.get("customer_id"), event=status, order_id=order.get("id"),
        content_sid=content_sid,
        content_variables={"1": short} if content_sid else None,
    )


@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, request: Request):
    """Update order status — broken into small steps: auth → timestamps → side-effects → notify."""
    current_user = await get_current_user_from_request(request)

    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await _authorize_order_status_change(current_user, order)

    now_iso = datetime.now(timezone.utc).isoformat()
    update_data: Dict[str, Any] = {"status": status, "updated_at": now_iso}

    ts_field = _status_timestamp_field(status)
    if ts_field:
        update_data[ts_field] = now_iso

    if status == "delivered":
        update_data["actual_delivery_time"] = now_iso
        update_data.update(await _credit_driver_on_delivery(order, order_id))
        # Release promoter rewards for referred partners (driver/merchant/supplier) on their first completed order.
        asyncio.create_task(_settle_partner_first_order_rewards(order))

    await db.orders.update_one({"id": order_id}, {"$set": update_data})

    notification = json.dumps({
        "type": "order_status_update",
        "order_id": order_id,
        "status": status,
        "timestamp": now_iso,
    })
    await manager.send_personal_message(notification, order["customer_id"])
    if order.get("driver_id"):
        await manager.send_personal_message(notification, order["driver_id"])

    # Best-effort browser push so customers get updates even with the tab closed.
    status_label = status.replace("_", " ").title()
    await send_push_to_user(
        order["customer_id"],
        f"Order {status_label}",
        f"Your IslandHop order is now {status_label.lower()}.",
        f"/order/{order_id}",
    )

    # Best-effort WhatsApp update on key milestones (fire-and-forget).
    asyncio.create_task(_notify_order_whatsapp(order, status))

    return {"message": f"Order status updated to {status}"}


@api_router.post("/orders/{order_id}/confirm-cod")
async def confirm_order_cod(order_id: str, request: Request):
    """Place an order as Cash on Delivery / Pay Later — no payment gateway needed.
    Confirms the order so the logistics flow (assign driver → pickup → deliver) proceeds;
    the customer pays the driver on delivery."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("customer_id") != current_user.id and current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized for this order")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_method": "cash",
            "payment_status": "cod_pending",
            "status": "confirmed",
            "confirmed_at": now_iso,
            "updated_at": now_iso,
        }},
    )

    # Best-effort driver assignment + customer WhatsApp confirmation.
    try:
        if not order.get("driver_id"):
            await find_and_assign_driver(order_id)
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"COD driver assignment skipped for {order_id}: {exc}")
    asyncio.create_task(_notify_order_whatsapp({**order, "status": "confirmed"}, "confirmed"))

    return {"success": True, "order_id": order_id, "payment_method": "cash", "status": "confirmed"}


@api_router.post("/orders/{order_id}/cash-collected")
async def confirm_cash_collected(order_id: str, request: Request):
    """Driver confirms cash collected for a COD order. Marks the order paid-by-cash and
    tracks how much of that cash the driver owes the platform (total minus driver's earnings)."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Only the assigned driver (or admin) can confirm cash collection.
    if current_user.user_type == "driver":
        driver = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0, "id": 1})
        if not driver or driver["id"] != order.get("driver_id"):
            raise HTTPException(status_code=403, detail="You are not assigned to this order")
    elif current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Only the assigned driver or an admin can confirm cash")

    if order.get("payment_method") != "cash":
        raise HTTPException(status_code=400, detail="This is not a Cash on Delivery order")
    if order.get("payment_status") == "cod_collected":
        raise HTTPException(status_code=400, detail="Cash already marked as collected for this order")

    total = float(order.get("total", 0) or 0)
    driver_earnings = float(order.get("driver_earnings", 0) or 0)
    platform_due = round(max(total - driver_earnings, 0.0), 2)  # cash the driver owes the platform
    now_iso = datetime.now(timezone.utc).isoformat()

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_status": "cod_collected",
            "cash_collected_at": now_iso,
            "cash_collected_by": order.get("driver_id"),
            "cash_platform_due": platform_due,
            "updated_at": now_iso,
        }},
    )
    # Track outstanding cash the driver owes the platform.
    if order.get("driver_id"):
        await db.drivers.update_one(
            {"id": order["driver_id"]},
            {"$inc": {"cash_outstanding": platform_due, "cash_collected_total": total}, "$set": {"updated_at": now_iso}},
        )

    return {"success": True, "order_id": order_id, "cash_total": round(total, 2),
            "driver_keeps": round(driver_earnings, 2), "platform_due": platform_due}


@api_router.get("/admin/drivers/cash-outstanding")
async def admin_drivers_cash_outstanding(request: Request):
    """Per-driver outstanding cash owed to the platform from COD orders."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    drivers = await db.drivers.find({"cash_outstanding": {"$gt": 0}}, {"_id": 0}).to_list(length=None)
    rows = []
    for d in drivers:
        u = await db.users.find_one({"id": d.get("user_id")}, {"_id": 0, "name": 1, "phone": 1, "email": 1})
        rows.append({
            "driver_id": d.get("id"),
            "name": (u or {}).get("name") or "Driver",
            "phone": (u or {}).get("phone"),
            "cash_outstanding": round(float(d.get("cash_outstanding", 0) or 0), 2),
            "cash_collected_total": round(float(d.get("cash_collected_total", 0) or 0), 2),
        })
    rows.sort(key=lambda r: r["cash_outstanding"], reverse=True)
    return {"drivers": rows, "total_outstanding": round(sum(r["cash_outstanding"] for r in rows), 2)}


@api_router.post("/admin/drivers/{driver_id}/settle-cash")
async def admin_settle_driver_cash(driver_id: str, request: Request):
    """Admin records that a driver has remitted their outstanding cash (resets the balance)."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "cash_outstanding": 1})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    settled = round(float(driver.get("cash_outstanding", 0) or 0), 2)
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.drivers.update_one({"id": driver_id}, {"$set": {"cash_outstanding": 0.0, "last_cash_settlement_at": now_iso}})
    await db.driver_cash_settlements.insert_one({
        "id": str(uuid.uuid4()), "driver_id": driver_id, "amount": settled,
        "settled_by": current_user.id, "settled_at": now_iso,
    })
    return {"success": True, "settled_amount": settled}


@api_router.post("/orders/create", response_model=Order)
async def create_new_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    """Create new order with payment processing"""
    order = Order(
        customer_id=current_user.id,
        **order_data.dict()
    )

    # Apply the approved fee structure (commission + $3 service fee + delivery split)
    vendor_id = order.restaurant_id or order.vendor_id
    order = await calculate_order_financials(order, vendor_id, _derive_vendor_type(order.service_type))
    
    # Calculate estimated delivery time (30 mins from now)
    order.estimated_delivery_time = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    order_dict = prepare_for_mongo(order.dict())
    await db.orders.insert_one(order_dict)
    
    # Find available driver
    if order.service_type in ['food', 'grocery', 'pharmacy', 'courier']:
        available_driver = await db.drivers.find_one({"status": "online"})
        if available_driver:
            order.driver_id = available_driver['id']
            await db.orders.update_one(
                {"id": order.id},
                {"$set": {"driver_id": available_driver['id']}}
            )
            # Finalize the delivery-fee split for this specific driver (10% vs 20%)
            await _finalize_driver_split(order.id, available_driver)
            # Update driver status
            await db.drivers.update_one(
                {"id": available_driver['id']},
                {"$set": {"status": "busy"}}
            )
    
    # Notify restaurant via WebSocket
    if order.restaurant_id:
        await manager.send_personal_message(
            json.dumps({
                "type": "new_order",
                "order": prepare_for_mongo(order.dict())
            }, default=str),
            order.restaurant_id
        )
    
    # Notify driver
    if order.driver_id:
        await manager.send_personal_message(
            json.dumps({
                "type": "new_assignment",
                "order": prepare_for_mongo(order.dict())
            }, default=str),
            order.driver_id
        )
    
    return order

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    """Get order by ID"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if user has access to this order
    if order['customer_id'] != current_user.id:
        # Check if user is the driver or restaurant owner
        if current_user.user_type == "driver":
            driver = await db.drivers.find_one({"user_id": current_user.id})
            if not driver or order.get('driver_id') != driver['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user.user_type == "restaurant":
            restaurant = await db.restaurants.find_one({"user_id": current_user.id})
            if not restaurant or order.get('restaurant_id') != restaurant['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return Order(**order)

@api_router.get("/orders/user/history", response_model=List[Order])
async def get_user_order_history(
    current_user: User = Depends(get_current_user),
    limit: int = 20,
    skip: int = 0
):
    """Get order history for current user"""
    orders = await db.orders.find(
        {"customer_id": current_user.id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    
    return [Order(**order) for order in orders]

# Chat/Messaging Routes — 3-party (customer ↔ driver ↔ merchant) order chat
async def _resolve_order_participants(order: dict) -> dict:
    """Return {customer_id, driver_id, vendor_user_id} for an order."""
    customer_id = order.get("customer_id")
    driver_id_doc = order.get("driver_id")  # this is drivers.id, not user_id
    driver_user_id = None
    if driver_id_doc:
        d = await db.drivers.find_one({"id": driver_id_doc}, {"_id": 0, "user_id": 1})
        driver_user_id = (d or {}).get("user_id")

    # Vendor user_id: restaurant or business owner
    vendor_user_id = None
    vendor_id = order.get("restaurant_id") or order.get("vendor_id")
    if vendor_id:
        rest = await db.restaurants.find_one({"id": vendor_id}, {"_id": 0, "user_id": 1})
        if rest:
            vendor_user_id = rest.get("user_id")
        else:
            biz = await db.businesses.find_one({"id": vendor_id}, {"_id": 0, "user_id": 1})
            if biz:
                vendor_user_id = biz.get("user_id")

    return {
        "customer_id": customer_id,
        "driver_user_id": driver_user_id,
        "vendor_user_id": vendor_user_id,
    }


def _role_for_user(user: User, participants: dict) -> Optional[str]:
    """Determine which order role the user holds. Admin/agent are observers (return 'system')."""
    if user.id == participants["customer_id"]:
        return "customer"
    if user.id == participants["driver_user_id"]:
        return "driver"
    if user.id == participants["vendor_user_id"]:
        return "vendor"
    if user.user_type in ("admin", "agent"):
        return "system"
    return None


@api_router.post("/chat/send", response_model=OrderChatMessage)
async def send_order_chat_message(payload: OrderChatMessageCreate, request: Request):
    """Send a message into the per-order chat thread. Authorized for customer, driver, merchant of the order."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": payload.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    participants = await _resolve_order_participants(order)
    role = _role_for_user(current_user, participants)
    if not role:
        raise HTTPException(status_code=403, detail="Not a participant of this order")

    msg = OrderChatMessage(
        order_id=payload.order_id,
        sender_id=current_user.id,
        sender_user_type=role,
        sender_name=current_user.name,
        message=payload.message,
        read_by=[current_user.id],
    )
    await db.order_chat_messages.insert_one(prepare_for_mongo(msg.dict()))

    # Fan out to all other participants
    payload_json = json.dumps({"type": "order_chat", "message": msg.dict(), "order_id": payload.order_id}, default=str)
    for uid in [participants["customer_id"], participants["driver_user_id"], participants["vendor_user_id"]]:
        if uid and uid != current_user.id:
            await manager.send_personal_message(payload_json, uid)

    return msg


@api_router.get("/chat/{order_id}/messages", response_model=List[OrderChatMessage])
async def get_order_chat_messages(order_id: str, request: Request):
    """Get all messages for an order. Authorized for customer, driver, merchant, or admin/agent."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    participants = await _resolve_order_participants(order)
    role = _role_for_user(current_user, participants)
    if not role:
        raise HTTPException(status_code=403, detail="Not a participant of this order")

    messages = await db.order_chat_messages.find(
        {"order_id": order_id}, {"_id": 0}
    ).sort("created_at", 1).limit(200).to_list(length=200)
    # Mark unread messages as read by the current viewer (idempotent)
    await db.order_chat_messages.update_many(
        {"order_id": order_id, "read_by": {"$ne": current_user.id}},
        {"$addToSet": {"read_by": current_user.id}},
    )
    return messages


@api_router.get("/chat/{order_id}/unread-count")
async def order_chat_unread_count(order_id: str, request: Request):
    """How many messages in this order's thread the current user hasn't read yet."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    participants = await _resolve_order_participants(order)
    role = _role_for_user(current_user, participants)
    if not role:
        raise HTTPException(status_code=403, detail="Not a participant of this order")
    count = await db.order_chat_messages.count_documents({
        "order_id": order_id,
        "read_by": {"$ne": current_user.id},
    })
    return {"order_id": order_id, "unread": count}


@api_router.get("/chat/unread/summary")
async def chat_unread_summary(request: Request):
    """Aggregate unread message count across all active orders the user participates in."""
    current_user = await get_current_user_from_request(request)

    # Find candidate order ids the user participates in by role.
    or_clauses: List[dict] = [{"customer_id": current_user.id}]
    # Driver: drivers.user_id -> drivers.id
    driver_row = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0, "id": 1})
    if driver_row:
        or_clauses.append({"driver_id": driver_row["id"]})
    # Vendor: restaurants.user_id or businesses.user_id
    vendor_ids: List[str] = []
    async for rest in db.restaurants.find({"user_id": current_user.id}, {"_id": 0, "id": 1}).limit(50):
        vendor_ids.append(rest["id"])
    async for biz in db.businesses.find({"user_id": current_user.id}, {"_id": 0, "id": 1}).limit(50):
        vendor_ids.append(biz["id"])
    if vendor_ids:
        or_clauses.append({"restaurant_id": {"$in": vendor_ids}})
        or_clauses.append({"vendor_id": {"$in": vendor_ids}})

    # Only consider non-terminal orders (capped to most recent 100 for safety)
    active_statuses = ["pending", "accepted", "preparing", "ready", "picked_up", "in_transit"]
    orders_cursor = db.orders.find(
        {"$or": or_clauses, "status": {"$in": active_statuses}}, {"_id": 0, "id": 1}
    ).sort("created_at", -1).limit(100)
    order_ids = [o["id"] async for o in orders_cursor]
    if not order_ids:
        return {"unread_total": 0, "orders_with_unread": []}

    pipeline = [
        {"$match": {"order_id": {"$in": order_ids}, "read_by": {"$ne": current_user.id}}},
        {"$group": {"_id": "$order_id", "count": {"$sum": 1}}},
    ]
    rows = await db.order_chat_messages.aggregate(pipeline).to_list(length=None)
    by_order = {r["_id"]: r["count"] for r in rows}
    total = sum(by_order.values())
    return {
        "unread_total": total,
        "orders_with_unread": [{"order_id": oid, "unread": c} for oid, c in by_order.items()],
    }


# ---- Vendor item substitution proposals (chat-integrated) ----
async def _post_system_chat(order_id: str, sender_id: str, message: str, participants: dict) -> None:
    """Insert a system chat message and broadcast to all participants."""
    msg = OrderChatMessage(
        order_id=order_id,
        sender_id=sender_id,
        sender_user_type="system",
        sender_name="IslandHop",
        message=message,
        read_by=[sender_id],
    )
    await db.order_chat_messages.insert_one(prepare_for_mongo(msg.dict()))
    payload_json = json.dumps({"type": "order_chat", "message": msg.dict(), "order_id": order_id}, default=str)
    for uid in [participants["customer_id"], participants["driver_user_id"], participants["vendor_user_id"]]:
        if uid:
            await manager.send_personal_message(payload_json, uid)


@api_router.post("/orders/{order_id}/substitutions", response_model=SubstitutionProposal)
async def propose_substitution(order_id: str, payload: SubstitutionCreate, request: Request):
    """Merchant proposes swapping an unavailable item for a substitute (or marks it unavailable)."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    participants = await _resolve_order_participants(order)
    if current_user.id != participants["vendor_user_id"] and current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Only the merchant can propose substitutions")
    if order.get("status") in ("delivered", "cancelled", "refunded"):
        raise HTTPException(status_code=400, detail="Order is closed; substitutions not allowed")

    prop = SubstitutionProposal(
        order_id=order_id,
        vendor_id=current_user.id,
        original_item_name=payload.original_item_name,
        proposed_item_name=payload.proposed_item_name,
        price_delta=round(payload.price_delta or 0.0, 2),
        note=payload.note,
    )
    await db.substitution_proposals.insert_one(prepare_for_mongo(prop.dict()))

    if payload.proposed_item_name:
        delta_txt = ""
        if prop.price_delta > 0:
            delta_txt = f" (+${prop.price_delta:.2f})"
        elif prop.price_delta < 0:
            delta_txt = f" (-${abs(prop.price_delta):.2f})"
        body = f"🔁 Merchant proposes swapping **{payload.original_item_name}** → **{payload.proposed_item_name}**{delta_txt}."
    else:
        body = f"⚠️ Merchant marked **{payload.original_item_name}** as unavailable."
    if payload.note:
        body += f"\nNote: {payload.note}"
    body += "\n\nUse the buttons in chat to accept or decline."

    await _post_system_chat(order_id, current_user.id, body, participants)
    return prop


@api_router.get("/orders/{order_id}/substitutions", response_model=List[SubstitutionProposal])
async def list_substitutions(order_id: str, request: Request):
    """List all substitution proposals for an order (participants only)."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    participants = await _resolve_order_participants(order)
    if not _role_for_user(current_user, participants):
        raise HTTPException(status_code=403, detail="Not a participant of this order")
    rows = await db.substitution_proposals.find(
        {"order_id": order_id}, {"_id": 0}
    ).sort("created_at", 1).limit(200).to_list(length=200)
    return rows


def _apply_substitution_to_items(items: List[dict], original_name: str, proposed_name: Optional[str]) -> List[dict]:
    """Return a new items list with the named item swapped or marked removed."""
    updated = list(items)
    for it in updated:
        if it.get("name") == original_name:
            if proposed_name:
                it["name"] = proposed_name
                it["substituted_from"] = original_name
            else:
                it["quantity"] = 0
                it["removed_unavailable"] = True
            break
    return updated


async def _apply_accepted_substitution(order: dict, prop: dict) -> None:
    """Mutate an order in Mongo to reflect an accepted substitution."""
    delta = float(prop.get("price_delta") or 0.0)
    new_items = _apply_substitution_to_items(
        order.get("items") or [], prop["original_item_name"], prop.get("proposed_item_name")
    )
    new_subtotal = max(0.0, float(order.get("subtotal", 0) or 0) + delta)
    new_total = max(0.0, float(order.get("total", 0) or 0) + delta)
    await db.orders.update_one(
        {"id": order["id"]},
        {"$set": {
            "items": new_items,
            "subtotal": round(new_subtotal, 2),
            "total": round(new_total, 2),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


@api_router.post("/orders/{order_id}/substitutions/{prop_id}/respond")
async def respond_substitution(order_id: str, prop_id: str, request: Request, accept: bool):
    """Customer accepts or declines a substitution. accept=true applies the swap & price delta."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    participants = await _resolve_order_participants(order)
    if current_user.id != participants["customer_id"]:
        raise HTTPException(status_code=403, detail="Only the customer can respond to substitutions")

    prop = await db.substitution_proposals.find_one({"id": prop_id, "order_id": order_id})
    if not prop:
        raise HTTPException(status_code=404, detail="Substitution proposal not found")
    if prop.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Substitution already {prop.get('status')}")

    new_status = "accepted" if accept else "declined"
    await db.substitution_proposals.update_one(
        {"id": prop_id},
        {"$set": {
            "status": new_status,
            "responded_by": current_user.id,
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    if accept:
        await _apply_accepted_substitution(order, prop)

    body = (
        f"✅ Customer accepted the substitution for **{prop['original_item_name']}**."
        if accept else
        f"❌ Customer declined the substitution for **{prop['original_item_name']}**."
    )
    await _post_system_chat(order_id, current_user.id, body, participants)
    return {"success": True, "status": new_status}


# Subscription & Payment Routes
@api_router.get("/subscriptions/plans", response_model=List[SubscriptionPlan])
async def get_subscription_plans(user_type: str = "business"):
    """Get available subscription plans"""
    plans = await db.subscription_plans.find({"user_type": user_type}).to_list(length=None)
    return [SubscriptionPlan(**plan) for plan in plans]

@api_router.post("/subscriptions/subscribe")
async def create_subscription(
    subscription_data: SubscriptionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create new subscription"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Get plan details
    plan = await db.subscription_plans.find_one({"id": subscription_data.plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    try:
        # Create Stripe subscription
        price_id = (plan['stripe_price_id_yearly'] if subscription_data.billing_cycle == 'yearly' 
                   else plan['stripe_price_id_monthly'])
        
        subscription = stripe.Subscription.create(
            customer=current_user.email,  # In production, use Stripe customer ID
            items=[{"price": price_id}],
            payment_method=subscription_data.payment_method_id,
            off_session=True,
            expand=['latest_invoice.payment_intent']
        )
        
        # Save subscription to database
        user_subscription = UserSubscription(
            user_id=current_user.id,
            plan_id=plan['id'],
            stripe_subscription_id=subscription.id,
            billing_cycle=subscription_data.billing_cycle,
            current_period_start=datetime.fromtimestamp(subscription.current_period_start, tz=timezone.utc),
            current_period_end=datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)
        )
        
        sub_dict = prepare_for_mongo(user_subscription.dict())
        await db.user_subscriptions.insert_one(sub_dict)
        
        return {"message": "Subscription created", "subscription": user_subscription.dict()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# DRIVER SUBSCRIPTION TIERS (Standard / Pro / Premium)
# ============================================================
class DriverPlanSelect(BaseModel):
    tier: str  # 'standard' | 'pro' | 'premium'


def _driver_plan_by_tier(tier: str) -> Optional[dict]:
    return next((p for p in DRIVER_SUBSCRIPTION_PLANS if p["tier"] == tier), None)


@api_router.get("/driver/subscription/plans")
async def get_driver_subscription_plans():
    """Public catalogue of the three driver subscription tiers (prices in TTD)."""
    return DRIVER_SUBSCRIPTION_PLANS


@api_router.get("/driver/subscription")
async def get_my_driver_subscription(request: Request):
    """Current driver's active subscription tier (defaults to free Standard)."""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0})
    tier = await _driver_plan_tier(current_user.id, driver)
    plan = _driver_plan_by_tier(tier) or _driver_plan_by_tier("standard")
    sub = await db.user_subscriptions.find_one(
        {"user_id": current_user.id, "status": "active", "plan_tier": {"$in": ["pro", "premium"]}},
        {"_id": 0},
    )
    return {
        "tier": tier,
        "plan": plan,
        "current_period_end": sub.get("current_period_end") if sub else None,
    }


@api_router.post("/driver/subscription/select")
async def select_driver_subscription(payload: DriverPlanSelect, request: Request):
    """Activate a driver subscription tier. NOTE: paid tiers are activated in
    sandbox mode (no live recurring charge wired yet — same as the rest of the app)."""
    current_user = await get_current_user_from_request(request)
    tier = (payload.tier or "").lower()
    plan = _driver_plan_by_tier(tier)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    driver = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0, "id": 1})
    if not driver:
        raise HTTPException(status_code=404, detail="No driver profile found for this account")

    now = datetime.now(timezone.utc)
    # Deactivate any prior active driver subscription
    await db.user_subscriptions.update_many(
        {"user_id": current_user.id, "status": "active", "plan_tier": {"$exists": True}},
        {"$set": {"status": "cancelled", "cancelled_at": now.isoformat()}},
    )

    if tier in ("pro", "premium"):
        period_end = now + timedelta(days=30)
        await db.user_subscriptions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "plan_tier": tier,
            "price_ttd": plan["price_ttd"],
            "status": "active",
            "billing_cycle": "monthly",
            "current_period_start": now.isoformat(),
            "current_period_end": period_end.isoformat(),
            "created_at": now.isoformat(),
        })

    # Mirror the tier on the driver profile so the payout split resolves instantly
    await db.drivers.update_one(
        {"user_id": current_user.id},
        {"$set": {"subscription_tier": tier, "is_premium": tier == "premium", "updated_at": now.isoformat()}},
    )
    return {
        "success": True,
        "tier": tier,
        "platform_cut_pct": plan["platform_cut_pct"],
        "driver_keep_pct": plan["driver_keep_pct"],
        "message": f"You're now on the {plan['name']} plan — you keep {plan['driver_keep_pct']}% of delivery fees.",
    }


# ============================================================
# MERCHANT SUBSCRIPTION TIERS (Standard / Pro / Premium)
# ============================================================
class MerchantPlanSelect(BaseModel):
    tier: str  # 'standard' | 'pro' | 'premium'


def _merchant_plan_by_tier(tier: str) -> Optional[dict]:
    return next((p for p in MERCHANT_SUBSCRIPTION_PLANS if p["tier"] == tier), None)


@api_router.get("/merchant/subscription/plans")
async def get_merchant_subscription_plans():
    """Public catalogue of the three merchant subscription tiers (prices in TTD)."""
    return MERCHANT_SUBSCRIPTION_PLANS


@api_router.get("/merchant/subscription")
async def get_my_merchant_subscription(request: Request):
    """Current merchant's active subscription tier (defaults to free Standard)."""
    current_user = await get_current_user_from_request(request)
    vendor_id, _ = await _resolve_vendor_for_user(current_user)
    tier = await _merchant_plan_tier(vendor_id)
    plan = _merchant_plan_by_tier(tier) or _merchant_plan_by_tier("standard")
    sub = await db.user_subscriptions.find_one(
        {"user_id": current_user.id, "status": "active", "audience": "merchant",
         "plan_tier": {"$in": ["pro", "premium"]}},
        {"_id": 0},
    )
    return {
        "tier": tier,
        "plan": plan,
        "current_period_end": sub.get("current_period_end") if sub else None,
    }


@api_router.post("/merchant/subscription/select")
async def select_merchant_subscription(payload: MerchantPlanSelect, request: Request):
    """Activate a merchant subscription tier. NOTE: paid tiers are activated in
    sandbox mode (no live recurring charge wired yet)."""
    current_user = await get_current_user_from_request(request)
    vendor_id, vendor_type = await _resolve_vendor_for_user(current_user)
    tier = (payload.tier or "").lower()
    plan = _merchant_plan_by_tier(tier)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    now = datetime.now(timezone.utc)
    await db.user_subscriptions.update_many(
        {"user_id": current_user.id, "status": "active", "audience": "merchant"},
        {"$set": {"status": "cancelled", "cancelled_at": now.isoformat()}},
    )
    if tier in ("pro", "premium"):
        await db.user_subscriptions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "audience": "merchant",
            "plan_tier": tier,
            "price_ttd": plan["price_ttd"],
            "status": "active",
            "billing_cycle": "monthly",
            "current_period_start": now.isoformat(),
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "created_at": now.isoformat(),
        })

    # Mirror tier + Featured Partner flag on the merchant profile doc
    update = {"subscription_tier": tier, "featured": plan["featured"], "updated_at": now.isoformat()}
    for coll in ("restaurants", "businesses", "car_rental_companies"):
        res = await db[coll].update_one({"id": vendor_id}, {"$set": update})
        if res.matched_count:
            break
    return {
        "success": True,
        "tier": tier,
        "commission_pct": plan["commission_pct"],
        "featured": plan["featured"],
        "message": f"You're now on the {plan['name']} plan — {plan['commission_pct']}% commission on orders.",
    }


# ============================================================
# MERCHANT ADVERTISEMENTS (front-page / website ad space)
# ============================================================
AD_PACKAGES = [
    {"id": "home_7", "name": "Homepage Spotlight — 7 days", "placement": "homepage", "days": 7, "price_ttd": 300},
    {"id": "home_30", "name": "Homepage Spotlight — 30 days", "placement": "homepage", "days": 30, "price_ttd": 1000},
    {"id": "web_30", "name": "Website Banner — 30 days", "placement": "website", "days": 30, "price_ttd": 1500},
]


class AdCreate(BaseModel):
    title: str
    image: str                 # base64 data URL
    cta_url: Optional[str] = None
    package_id: str


def _ad_package(pid: str) -> Optional[dict]:
    return next((p for p in AD_PACKAGES if p["id"] == pid), None)


def _ad_is_live(ad: dict) -> bool:
    if ad.get("status") != "active":
        return False
    ends = ad.get("ends_at")
    if ends:
        try:
            d = datetime.fromisoformat(ends)
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            return d > datetime.now(timezone.utc)
        except Exception:
            return True
    return True


@api_router.get("/ads/packages")
async def get_ad_packages():
    """Public catalogue of paid advertising packages (prices in TTD)."""
    return AD_PACKAGES


@api_router.get("/ads/active")
async def get_active_ads(placement: str = "homepage", limit: int = 8):
    """Public: live merchant ads for the given placement (newest first)."""
    ads = await db.merchant_ads.find(
        {"placement": placement, "status": "active"}, {"_id": 0}
    ).sort("created_at", -1).limit(max(1, min(limit, 20))).to_list(length=20)
    return [a for a in ads if _ad_is_live(a)]


@api_router.post("/ads/{ad_id}/click")
async def track_ad_click(ad_id: str):
    await db.merchant_ads.update_one({"id": ad_id}, {"$inc": {"clicks": 1}})
    return {"success": True}


@api_router.get("/merchant/ads")
async def list_merchant_ads(request: Request):
    current_user = await get_current_user_from_request(request)
    vendor_id, _ = await _resolve_vendor_for_user(current_user)
    ads = await db.merchant_ads.find({"vendor_id": vendor_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(length=50)
    for a in ads:
        a["is_live"] = _ad_is_live(a)
    return ads


@api_router.post("/merchant/ads")
async def create_merchant_ad(payload: AdCreate, request: Request):
    """Buy ad space. NOTE: payment is sandbox-activated (no live charge wired yet)."""
    current_user = await get_current_user_from_request(request)
    vendor_id, vendor_type = await _resolve_vendor_for_user(current_user)
    pkg = _ad_package(payload.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid ad package")
    if not payload.title or not payload.image:
        raise HTTPException(status_code=400, detail="Title and image are required")
    if len(payload.image) > 1_500_000:
        raise HTTPException(status_code=413, detail="Ad image too large (max ~1MB)")

    now = datetime.now(timezone.utc)
    merchant = None
    for coll in ("restaurants", "businesses", "car_rental_companies"):
        merchant = await db[coll].find_one({"id": vendor_id}, {"_id": 0, "name": 1})
        if merchant:
            break
    doc = {
        "id": str(uuid.uuid4()),
        "vendor_id": vendor_id,
        "vendor_type": vendor_type,
        "merchant_name": (merchant or {}).get("name"),
        "title": payload.title,
        "image": payload.image,
        "cta_url": payload.cta_url or f"/restaurant/{vendor_id}",
        "placement": pkg["placement"],
        "package_id": pkg["id"],
        "price_ttd": pkg["price_ttd"],
        "status": "active",
        "starts_at": now.isoformat(),
        "ends_at": (now + timedelta(days=pkg["days"])).isoformat(),
        "impressions": 0,
        "clicks": 0,
        "created_at": now.isoformat(),
    }
    await db.merchant_ads.insert_one(dict(doc))
    doc.pop("_id", None)
    return {"success": True, "ad": doc, "message": f"Your ad is live for {pkg['days']} days!"}


@api_router.patch("/merchant/ads/{ad_id}")
async def toggle_merchant_ad(ad_id: str, request: Request):
    current_user = await get_current_user_from_request(request)
    vendor_id, _ = await _resolve_vendor_for_user(current_user)
    ad = await db.merchant_ads.find_one({"id": ad_id, "vendor_id": vendor_id}, {"_id": 0, "status": 1})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    new_status = "paused" if ad.get("status") == "active" else "active"
    await db.merchant_ads.update_one({"id": ad_id}, {"$set": {"status": new_status}})
    return {"success": True, "status": new_status}


@api_router.delete("/merchant/ads/{ad_id}")
async def delete_merchant_ad(ad_id: str, request: Request):
    current_user = await get_current_user_from_request(request)
    vendor_id, _ = await _resolve_vendor_for_user(current_user)
    res = await db.merchant_ads.delete_one({"id": ad_id, "vendor_id": vendor_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"success": True}







@api_router.post("/payments/create-payment-intent")
async def create_payment_intent(
    amount: float,
    currency: str = "usd",
    current_user: User = Depends(get_current_user)
):
    """Create Stripe payment intent for order"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),  # Convert to cents
            currency=currency,
            metadata={
                'user_id': current_user.id,
                'user_email': current_user.email
            }
        )
        
        return {
            "clientSecret": intent.client_secret,
            "paymentIntentId": intent.id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/payments/confirm-payment")
async def confirm_payment(
    payment_intent_id: str,
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    """Confirm payment and update order"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    try:
        # Verify payment intent
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if intent.status == "succeeded":
            # Update order payment status
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {
                    "payment_status": "paid",
                    "payment_intent_id": payment_intent_id,
                    "status": "confirmed"
                }}
            )
            
            # Get updated order
            order = await db.orders.find_one({"id": order_id})
            
            # Notify restaurant
            if order and order.get('restaurant_id'):
                await manager.send_personal_message(
                    json.dumps({
                        "type": "payment_confirmed",
                        "order_id": order_id
                    }),
                    order['restaurant_id']
                )
            
            return {"message": "Payment confirmed", "status": "success"}
        else:
            raise HTTPException(status_code=400, detail="Payment not completed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Driver Management Routes
ALLOWED_DOC_TYPES = {
    "driversLicense", "vehicleRegistration", "insurance",
    "certificateOfCharacter", "profilePhoto",
}
MAX_DOC_BYTES = 10 * 1024 * 1024  # 10 MB


@api_router.post("/drivers/documents")
async def upload_driver_document(
    request: Request,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
):
    """Securely upload one driver identity document to private object storage.

    Returns a document_id that the applicant attaches to their driver application.
    """
    current_user = await get_current_user_from_request(request)
    if doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type. Allowed: {sorted(ALLOWED_DOC_TYPES)}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_DOC_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin")
    content_type = file.content_type or storage_client.MIME_TYPES.get(ext, "application/octet-stream")
    if ext not in storage_client.MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, JPG, PNG, or WEBP.")

    document_id = str(uuid.uuid4())
    storage_path = f"{storage_client.APP_NAME}/driver-docs/{current_user.id}/{document_id}.{ext}"
    try:
        result = await asyncio.to_thread(storage_client.put_object, storage_path, data, content_type)
    except Exception as e:  # noqa: BLE001
        logging.error(f"Driver document upload failed for {current_user.id}/{doc_type}: {e}")
        raise HTTPException(status_code=502, detail="Document storage failed. Please try again.")

    await db.driver_documents.insert_one({
        "id": document_id,
        "user_id": current_user.id,
        "doc_type": doc_type,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"document_id": document_id, "doc_type": doc_type, "filename": file.filename}


@api_router.get("/drivers/documents/{document_id}/download")
async def download_driver_document(document_id: str, request: Request, auth: Optional[str] = Query(None)):
    """Stream a driver document. Accessible only to the owner or an admin.

    Supports `?auth=<jwt>` so <img>/<iframe> tags (which can't send headers) work.
    """
    # Auth: header Bearer OR ?auth= query param (for img/iframe tags)
    if auth and not request.headers.get("Authorization"):
        request.scope.setdefault("headers", [])
        request.scope["headers"].append((b"authorization", f"Bearer {auth}".encode()))
    current_user = await get_current_user_from_request(request)

    record = await db.driver_documents.find_one({"id": document_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Document not found")
    if current_user.user_type != "admin" and record["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this document")

    try:
        data, content_type = await asyncio.to_thread(storage_client.get_object, record["storage_path"])
    except Exception as e:  # noqa: BLE001
        logging.error(f"Driver document fetch failed for {document_id}: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve document")
    return Response(content=data, media_type=record.get("content_type", content_type))


class DriverApplicationCreate(BaseModel):
    license_number: str
    vehicle_type: str
    vehicle_plate: str
    documents: Optional[Dict[str, str]] = None
    personal_info: Optional[Dict[str, Any]] = None
    vehicle_info: Optional[Dict[str, Any]] = None
    banking_info: Optional[Dict[str, Any]] = None


@api_router.post("/drivers", response_model=Driver)
async def create_driver(application: DriverApplicationCreate, request: Request):
    """Create a driver application. New applicants are 'pending' until an admin
    approves them — they cannot go online or operate until then."""
    current_user = await get_current_user_from_request(request)

    # Prevent duplicate applications
    existing = await db.drivers.find_one({"user_id": current_user.id})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a driver application on file.")

    driver = Driver(
        user_id=current_user.id,
        license_number=application.license_number,
        vehicle_type=application.vehicle_type,
        vehicle_plate=application.vehicle_plate,
        documents=application.documents,
        personal_info=application.personal_info,
        vehicle_info=application.vehicle_info,
        banking_info=application.banking_info,
        status="pending",  # awaiting admin identity review
    )

    driver_dict = prepare_for_mongo(driver.dict())
    await db.drivers.insert_one(driver_dict)

    # Create driver wallet
    wallet = DriverWallet(driver_id=driver.id)
    await db.driver_wallets.insert_one(wallet.dict())

    # Notify the team (email + WhatsApp) and acknowledge the applicant by email.
    pi = application.personal_info or {}
    asyncio.create_task(_notify_new_application("driver", {
        "id": driver.id,
        "name": pi.get("name") or current_user.name,
        "email": pi.get("email") or current_user.email,
        "phone": pi.get("phone") or current_user.phone,
        "vehicle_type": application.vehicle_type,
        "city": pi.get("city"),
        "source": "the app",
    }))

    # NOTE: user_type is NOT switched to 'driver' until approval — keeps the
    # account restricted (still a customer) while the application is reviewed.
    return driver


# ---------------------------------------------------------------------------
# Automated KYC — Stripe Identity (document + selfie/liveness)
# Model: automated-first with admin fallback. A 'verified' result auto-approves
# the driver; any other outcome leaves them pending for manual admin review.
# ---------------------------------------------------------------------------
async def _notify_driver_status(user_id: str, decision: str, notes: Optional[str] = None):
    """Best-effort email to a driver applicant on a KYC/approval decision.
    Sent via the M365 support mailbox. Never raises (won't block the flow)."""
    try:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "name": 1})
        if not user or not user.get("email"):
            return
        name = user.get("name") or "there"
        templates = {
            "approved": (
                "You're approved to drive with IslandHop! 🎉",
                f"<p>Hi {name},</p><p>Great news — your identity has been verified and your driver "
                f"application is <strong>approved</strong>. You can now log in, go online, and start "
                f"accepting trips.</p><p>Welcome to the IslandHop driver community!</p>",
            ),
            "rejected": (
                "Update on your IslandHop driver application",
                f"<p>Hi {name},</p><p>Thank you for applying to drive with IslandHop. After review, we're "
                f"unable to approve your application at this time."
                + (f"<br/><br/><strong>Reason:</strong> {notes}" if notes else "")
                + "</p><p>If you believe this was a mistake or want to reapply, please reply to this email "
                "or contact support.</p>",
            ),
            "review": (
                "Your IslandHop verification needs a quick review",
                f"<p>Hi {name},</p><p>We couldn't automatically verify your identity, so our team is now "
                f"reviewing your application manually. No action is needed right now — we'll be in touch "
                f"within 24–48 hours.</p>",
            ),
        }
        subject, body = templates.get(decision, (None, None))
        if not subject:
            return
        html = (
            f"<div style='font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5'>{body}"
            "<p style='margin-top:24px;color:#888;font-size:12px'>— The IslandHop Team</p></div>"
        )
        await graph_mail.send_mail(user["email"], subject, html, mailbox=graph_mail.notify_mailbox("driver"))
    except Exception as exc:  # noqa: BLE001 — notifications must never break the flow
        logging.warning(f"Driver notification ({decision}) failed for {user_id}: {exc}")

    # WhatsApp-first notification (Tracy's "WhatsApp-Only" policy).
    try:
        driver = await db.drivers.find_one({"user_id": user_id}, {"_id": 0, "phone": 1})
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "phone": 1, "name": 1})
        phone = (driver or {}).get("phone") or (user or {}).get("phone")
        name = (user or {}).get("name") or "there"
        wa_bodies = {
            "approved": (f"🎉 Hi {name}, you're APPROVED to drive with IslandHop! Log in to go online and start "
                         f"accepting trips. Reply to this WhatsApp to stay connected for future updates. 🌴"),
            "rejected": (f"Hi {name}, an update on your IslandHop driver application: we're unable to approve it at "
                         f"this time." + (f" Reason: {notes}" if notes else "") + " Reply here if you'd like to reapply."),
            "review": (f"Hi {name}, your IslandHop driver verification needs a quick manual review. No action needed — "
                       f"we'll be in touch within 24–48 hours. Reply to this WhatsApp to stay connected."),
        }
        wa_body = wa_bodies.get(decision)
        if phone and wa_body:
            await _wa_notify(phone, wa_body, user_id=user_id, event=f"driver_{decision}")
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"Driver WhatsApp notification ({decision}) failed for {user_id}: {exc}")


async def _apply_identity_result(driver: dict, session) -> str:
    """Reconcile a Stripe Identity session onto a driver record. Auto-approves
    the driver when the session is verified. Returns the session status."""
    status = session.get("status") if isinstance(session, dict) else session.status
    last_error = session.get("last_error") if isinstance(session, dict) else getattr(session, "last_error", None)
    session_id = session.get("id") if isinstance(session, dict) else session.id

    iv = {
        "provider": "stripe_identity",
        "session_id": session_id,
        "status": status,
        "last_error": last_error,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    update = {"identity_verification": iv}

    if status == "verified":
        iv["verified_at"] = datetime.now(timezone.utc).isoformat()
        # Auto-approve: identity confirmed → activate driver & promote user.
        newly_approved = driver.get("status") in ("pending", "pending_approval", None)
        if newly_approved:
            update["status"] = "active"
            update["approval_method"] = "auto_kyc"
        await db.users.update_one({"id": driver["user_id"]}, {"$set": {"user_type": "driver"}})

    await db.drivers.update_one({"id": driver["id"]}, {"$set": update})

    if status == "verified":
        await _notify_driver_status(driver["user_id"], "approved")
    elif status in ("requires_input", "processing", "canceled"):
        # Only notify once when it first lands in manual-review territory.
        if (driver.get("identity_verification") or {}).get("status") != status:
            await _notify_driver_status(driver["user_id"], "review")
    return status


@api_router.post("/drivers/identity/start")
async def start_identity_verification(request: Request):
    """Create a Stripe Identity verification session (document + selfie) for the
    current driver applicant. Returns the hosted verification URL."""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=400, detail="Submit your driver application before verifying your identity.")
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Identity verification is not configured")

    frontend_url = os.environ.get("FRONTEND_URL", "")
    try:
        session = await asyncio.to_thread(
            lambda: stripe.identity.VerificationSession.create(
                type="document",
                options={"document": {"require_matching_selfie": True}},
                metadata={"driver_id": driver["id"], "user_id": current_user.id},
                return_url=f"{frontend_url}/driver/verification/callback",
            )
        )
    except Exception as e:  # noqa: BLE001
        logging.error(f"Stripe Identity session create failed for {current_user.id}: {e}")
        raise HTTPException(status_code=502, detail="Could not start identity verification")

    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"identity_verification": {
            "provider": "stripe_identity",
            "session_id": session.id,
            "status": session.status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}},
    )
    return {"session_id": session.id, "url": session.url, "status": session.status}


@api_router.get("/drivers/identity/status")
async def get_identity_status(request: Request):
    """Return the current driver's identity-verification status. Reconciles with
    Stripe (so it works even if the webhook hasn't been configured)."""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver application not found")

    iv = driver.get("identity_verification") or {}
    session_id = iv.get("session_id")
    if session_id and iv.get("status") != "verified" and STRIPE_API_KEY:
        try:
            session = await asyncio.to_thread(stripe.identity.VerificationSession.retrieve, session_id)
            await _apply_identity_result(driver, session)
            iv = {**iv, "status": session.status}
        except Exception as e:  # noqa: BLE001
            logging.warning(f"Identity status retrieve failed for {session_id}: {e}")

    return {
        "status": iv.get("status", "unstarted"),
        "session_id": session_id,
        "verified": iv.get("status") == "verified",
        "last_error": iv.get("last_error"),
    }


@api_router.post("/webhook/stripe/identity")
async def stripe_identity_webhook(request: Request):
    """Production real-time Identity webhook. Requires STRIPE_WEBHOOK_SECRET_IDENTITY.
    The /drivers/identity/status endpoint reconciles regardless, so this is an
    optimization for instant updates in production."""
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET_IDENTITY")
    if not secret:
        raise HTTPException(status_code=503, detail="Identity webhook not configured")
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature")
    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=sig, secret=secret)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Webhook verification failed: {e}")

    if event["type"] in ("identity.verification_session.verified", "identity.verification_session.requires_input"):
        session_obj = event["data"]["object"]
        driver_id = (session_obj.get("metadata") or {}).get("driver_id")
        if driver_id:
            driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
            if driver:
                await _apply_identity_result(driver, session_obj)
    return {"status": "ok"}

@api_router.get("/drivers/leaderboard")
async def get_driver_leaderboard(limit: int = 10):
    """Public leaderboard of top drivers ranked by rating, then delivery count.

    Returns an empty list when no rated drivers exist yet; the frontend then
    shows an aspirational fallback roster.
    """
    capped = max(1, min(limit, 50))
    drivers = await db.drivers.find(
        {"rating": {"$gt": 0}}, {"_id": 0}
    ).sort("rating", -1).limit(capped).to_list(length=None)

    leaderboard = []
    for d in drivers:
        user = await db.users.find_one({"id": d.get("user_id")}, {"_id": 0, "name": 1})
        deliveries = await db.orders.count_documents(
            {"driver_id": d.get("id"), "status": "delivered"}
        )
        rating = float(d.get("rating", 0) or 0)
        if rating >= 4.95:
            tier = "GOLD"
        elif rating >= 4.7:
            tier = "SILVER"
        else:
            tier = "BRONZE"
        leaderboard.append({
            "id": d.get("id"),
            "name": (user or {}).get("name") or "IslandHop Driver",
            "area": "Trinidad & Tobago",
            "deliveries": deliveries,
            "rating": round(rating, 2),
            "streak": tier,
        })

    leaderboard.sort(key=lambda r: (r["rating"], r["deliveries"]), reverse=True)
    return leaderboard


# ---------------------------------------------------------------------------
# Web Push (browser notifications)
# ---------------------------------------------------------------------------
@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Public VAPID key the browser needs to create a push subscription."""
    return {"public_key": os.environ.get("VAPID_PUBLIC_KEY", "")}


@api_router.post("/push/subscribe")
async def subscribe_push(sub: PushSubscriptionCreate, request: Request):
    """Persist a browser push subscription for the current user (idempotent per endpoint)."""
    current_user = await get_current_user_from_request(request)
    record = PushSubscription(user_id=current_user.id, endpoint=sub.endpoint, keys=sub.keys)
    await db.push_subscriptions.update_one(
        {"endpoint": sub.endpoint},
        {"$set": {**record.dict(), "user_id": current_user.id}},
        upsert=True,
    )
    return {"success": True}


@api_router.post("/push/unsubscribe")
async def unsubscribe_push(payload: Dict[str, str], request: Request):
    """Remove a browser push subscription."""
    await get_current_user_from_request(request)
    endpoint = payload.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"endpoint": endpoint})
    return {"success": True}


async def send_push_to_user(user_id: str, title: str, body: str, url: str = "/dashboard") -> None:
    """Fire a web push to every device the user has subscribed. Best-effort; never raises."""
    if not user_id:
        return
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).limit(50).to_list(length=50)
    if not subs:
        return
    payload = {"title": title, "body": body, "url": url}
    for sub in subs:
        subscription_info = {"endpoint": sub["endpoint"], "keys": sub["keys"]}
        result = await asyncio.to_thread(push_client.send_web_push, subscription_info, payload)
        if result.get("gone"):
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})


# ---------------------------------------------------------------------------
# Admin Outlook / Microsoft 365 Inbox (Microsoft Graph)
# ---------------------------------------------------------------------------
async def _require_admin(request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ---------------------------------------------------------------------------
# Admin team management (owner-seeded super admin + promote/invite/revoke)
# ---------------------------------------------------------------------------
VALID_TEAM_ROLES = ("admin", "agent")


async def _log_admin_action(actor_id, actor_email, action, target_email=None, role=None, details=None):
    """Append an entry to the admin team audit log (best-effort)."""
    try:
        await db.admin_audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "action": action,
            "actor_id": actor_id,
            "actor_email": actor_email,
            "target_email": target_email,
            "role": role,
            "details": details,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"Audit log write failed ({action}): {exc}")


async def seed_owner_admin():
    """Idempotently create the owner/super-admin from env. Never demotes an
    existing owner; updates the password only if the env value changed."""
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD")
    if not email or not password:
        print("⚠️ ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping owner admin seed")
        return
    existing = await db.users.find_one({"email": email})
    if existing is None:
        owner = User(email=email, name="IslandHop Owner", user_type="admin")
        owner_dict = prepare_for_mongo(owner.dict())
        owner_dict["hashed_password"] = get_password_hash(password)
        owner_dict["is_owner"] = True
        await db.users.insert_one(owner_dict)
        print(f"✅ Owner admin seeded: {email}")
    else:
        updates = {"user_type": "admin", "is_owner": True}
        if not verify_password(password, existing.get("hashed_password", "")):
            updates["hashed_password"] = get_password_hash(password)
        await db.users.update_one({"email": email}, {"$set": updates})
        print(f"✅ Owner admin ensured: {email}")


@api_router.get("/admin/team/audit")
async def team_audit_log(request: Request):
    """Recent admin team actions (promote/revoke/invite/accept)."""
    await _require_admin(request)
    entries = await db.admin_audit_log.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(length=100)
    return {"entries": entries}


@api_router.get("/admin/team")
async def list_team(request: Request):
    """List all admins and support agents."""
    await _require_admin(request)
    members = await db.users.find(
        {"user_type": {"$in": list(VALID_TEAM_ROLES)}},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "user_type": 1, "is_owner": 1, "created_at": 1},
    ).sort("created_at", -1).limit(200).to_list(length=200)
    return {"team": members}


@api_router.post("/admin/team/promote")
async def promote_team_member(payload: TeamPromote, request: Request):
    """Grant admin/agent role to an EXISTING registered user."""
    admin = await _require_admin(request)
    if payload.role not in VALID_TEAM_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {VALID_TEAM_ROLES}")
    target = await db.users.find_one({"email": payload.email.strip().lower()})
    if not target:
        raise HTTPException(status_code=404, detail="No registered user with that email. Ask them to sign up first, or send an invite.")
    await db.users.update_one({"id": target["id"]}, {"$set": {"user_type": payload.role}})
    await _log_admin_action(admin.id, admin.email, "promote", payload.email, payload.role)
    return {"success": True, "email": payload.email, "role": payload.role}


@api_router.post("/admin/team/revoke")
async def revoke_team_member(payload: Dict[str, str], request: Request):
    """Revoke a team member's role (back to customer)."""
    admin = await _require_admin(request)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("is_owner"):
        raise HTTPException(status_code=403, detail="The owner account cannot be revoked.")
    if target["id"] == admin.id:
        raise HTTPException(status_code=400, detail="You cannot revoke your own access.")
    await db.users.update_one({"id": user_id}, {"$set": {"user_type": "customer"}})
    await _log_admin_action(admin.id, admin.email, "revoke", target.get("email"), "customer")
    return {"success": True, "user_id": user_id}


@api_router.post("/admin/team/invite")
async def invite_team_member(payload: TeamInvite, request: Request):
    """Create an invite for a new admin/agent and email them a link to set a password."""
    admin = await _require_admin(request)
    if payload.role not in VALID_TEAM_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {VALID_TEAM_ROLES}")
    email = payload.email.strip().lower()

    token = secrets.token_urlsafe(32)
    await db.admin_invites.insert_one({
        "token": token,
        "email": email,
        "role": payload.role,
        "invited_by": admin.id,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    })

    frontend_url = os.environ.get("FRONTEND_URL", "")
    invite_link = f"{frontend_url}/admin/invite/{token}"
    try:
        html = (
            f"<div style='font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5'>"
            f"<p>You've been invited to join the IslandHop team as <strong>{payload.role}</strong>.</p>"
            f"<p>Click below to set your password and activate your account (link expires in 7 days):</p>"
            f"<p><a href='{invite_link}'>{invite_link}</a></p>"
            f"<p style='margin-top:24px;color:#888;font-size:12px'>— IslandHop</p></div>"
        )
        await graph_mail.send_mail(email, "You're invited to the IslandHop team", html, mailbox=graph_mail.notify_mailbox("support"))
        emailed = True
    except Exception as exc:  # noqa: BLE001 — invite still works via the returned link
        logging.warning(f"Team invite email failed for {email}: {exc}")
        emailed = False
    await _log_admin_action(admin.id, admin.email, "invite", email, payload.role)
    return {"success": True, "email": email, "role": payload.role, "invite_link": invite_link, "emailed": emailed}


@api_router.get("/auth/invite/{token}")
async def get_invite(token: str):
    """Validate an invite token (public) — returns the email + role if valid."""
    invite = await db.admin_invites.find_one({"token": token, "used": False}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    if invite["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="This invite has expired")
    return {"email": invite["email"], "role": invite["role"]}


@api_router.post("/auth/invite/accept", response_model=Token)
async def accept_invite(payload: InviteAccept):
    """Accept an invite (public): create or promote the account with the invited role."""
    invite = await db.admin_invites.find_one({"token": payload.token, "used": False})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    if invite["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="This invite has expired")

    email = invite["email"]
    role = invite["role"]
    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {"user_type": role, "hashed_password": get_password_hash(payload.password)}},
        )
        user = User(**{k: v for k, v in existing.items() if k != "_id"})
        user.user_type = role
    else:
        user = User(email=email, name=payload.name, user_type=role)
        user_dict = prepare_for_mongo(user.dict())
        user_dict["hashed_password"] = get_password_hash(payload.password)
        await db.users.insert_one(user_dict)

    await db.admin_invites.update_one({"token": payload.token}, {"$set": {"used": True}})
    await _log_admin_action(user.id, user.email, "invite_accepted", email, role)
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": user.dict()}


@api_router.post("/auth/change-password")
async def change_password(payload: ChangePassword, request: Request):
    """Change the authenticated user's password."""
    current_user = await get_current_user_from_request(request)
    user_doc = await db.users.find_one({"id": current_user.id})
    if not user_doc or not verify_password(payload.current_password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    await db.users.update_one({"id": current_user.id}, {"$set": {"hashed_password": get_password_hash(payload.new_password)}})
    return {"success": True}


def _ensure_mailbox_allowed(mailbox: str):
    allowed = [m.lower() for m in graph_mail.get_support_mailboxes()]
    if mailbox.lower() not in allowed:
        raise HTTPException(status_code=403, detail="Mailbox not in the configured support list")


@api_router.get("/admin/mail/status")
async def admin_mail_status(request: Request):
    await _require_admin_or_agent(request)
    return await asyncio.to_thread(graph_mail.graph_status)


@api_router.get("/admin/mail/mailboxes")
async def admin_mail_mailboxes(request: Request):
    await _require_admin_or_agent(request)
    return {"mailboxes": graph_mail.get_support_mailboxes()}


@api_router.get("/admin/mail/mailboxes/{mailbox}/messages")
async def admin_mail_list(mailbox: str, request: Request, top: int = 25, skiptoken: Optional[str] = None):
    await _require_admin_or_agent(request)
    _ensure_mailbox_allowed(mailbox)
    try:
        result = await graph_mail.list_messages(mailbox, top=min(max(top, 1), 50), skip_token=skiptoken)
    except graph_mail.GraphConsentMissing as exc:
        raise HTTPException(status_code=409, detail=f"Microsoft 365 admin consent not granted yet: {exc}")
    except graph_mail.GraphNotConfigured:
        raise HTTPException(status_code=503, detail="Microsoft 365 not configured")
    # Enrich each message with its workflow ticket (auto-reply + assignment status)
    msgs = result.get("value", [])
    msg_ids = [m.get("id") for m in msgs if m.get("id")]
    conv_ids = [m.get("conversationId") for m in msgs if m.get("conversationId")]
    tickets = await db.mail_tickets.find(
        {"mailbox": mailbox, "$or": [{"message_id": {"$in": msg_ids}}, {"conversation_id": {"$in": conv_ids}}]},
        {"_id": 0},
    ).limit(400).to_list(length=400)
    by_msg = {t["message_id"]: t for t in tickets}
    by_conv = {t["conversation_id"]: t for t in tickets if t.get("conversation_id")}
    for m in msgs:
        t = by_msg.get(m.get("id")) or by_conv.get(m.get("conversationId"))
        m["ticket"] = {
            "assigned_to": t.get("assigned_to"),
            "assigned_to_name": t.get("assigned_to_name"),
            "auto_replied": t.get("auto_replied", False),
            "status": t.get("status", "new"),
        } if t else None
    return result


@api_router.get("/admin/mail/mailboxes/{mailbox}/messages/{message_id}")
async def admin_mail_get(mailbox: str, message_id: str, request: Request):
    await _require_admin_or_agent(request)
    _ensure_mailbox_allowed(mailbox)
    try:
        return await graph_mail.get_message(mailbox, message_id)
    except graph_mail.GraphConsentMissing as exc:
        raise HTTPException(status_code=409, detail=f"Microsoft 365 admin consent not granted yet: {exc}")


class MailReplyRequest(BaseModel):
    body_html: str


@api_router.post("/admin/mail/mailboxes/{mailbox}/messages/{message_id}/reply")
async def admin_mail_reply(mailbox: str, message_id: str, payload: MailReplyRequest, request: Request):
    await _require_admin_or_agent(request)
    _ensure_mailbox_allowed(mailbox)
    if not payload.body_html.strip():
        raise HTTPException(status_code=400, detail="Reply body cannot be empty")
    try:
        await graph_mail.reply_to_message(mailbox, message_id, payload.body_html)
        return {"success": True}
    except graph_mail.GraphConsentMissing as exc:
        raise HTTPException(status_code=409, detail=f"Microsoft 365 admin consent not granted yet: {exc}")


# ---------------------------------------------------------------------------
# Support inbox workflow: instant auto-reply + assign-to-agent
# ---------------------------------------------------------------------------
DEFAULT_AUTOREPLY_SUBJECT = "Thanks for contacting IslandHop — we've received your message"
DEFAULT_AUTOREPLY_HTML = (
    "<p>Hi {name},</p>"
    "<p>Thanks for reaching out to <strong>IslandHop</strong>! This is an automated confirmation "
    "that we've received your message. A member of our support team will personally get back to you "
    "shortly — typically within a few hours.</p>"
    "<p>For anything urgent, you can also reach us through the Support section inside the IslandHop app.</p>"
    "<p>Warm regards,<br/>The IslandHop Support Team 🌴</p>"
)
# Senders we must never auto-reply to (avoids loops with system/no-reply mailers)
AUTOREPLY_SKIP_TOKENS = (
    "no-reply", "noreply", "donotreply", "do-not-reply", "mailer-daemon",
    "postmaster", "notifications@", "automated@", "bounce", "mailerdaemon",
)


async def _require_admin_or_agent(request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin/agent access required")
    return current_user


async def _get_mail_autoreply_settings() -> dict:
    doc = await db.app_settings.find_one({"id": "mail_autoreply"}, {"_id": 0})
    now_iso = datetime.now(timezone.utc).isoformat()
    if not doc:
        doc = {
            "id": "mail_autoreply",
            "enabled": True,
            "subject": DEFAULT_AUTOREPLY_SUBJECT,
            "body_html": DEFAULT_AUTOREPLY_HTML,
            # Watermark: only auto-reply to mail received AFTER this moment, so
            # enabling the feature never blasts the existing mailbox backlog.
            "autoreply_since": now_iso,
            "updated_at": now_iso,
        }
        await db.app_settings.insert_one({**doc})
        return doc
    if not doc.get("autoreply_since"):
        await db.app_settings.update_one({"id": "mail_autoreply"}, {"$set": {"autoreply_since": now_iso}})
        doc["autoreply_since"] = now_iso
    return doc


def _parse_iso_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return None


def _sender_should_get_autoreply(from_email: str) -> bool:
    fe = (from_email or "").lower()
    if not fe or "@" not in fe:
        return False
    if any(tok in fe for tok in AUTOREPLY_SKIP_TOKENS):
        return False
    if fe in [m.lower() for m in graph_mail.get_support_mailboxes()]:
        return False  # never auto-reply to our own support mailboxes (loop guard)
    return True


async def _process_mailbox_autoreply(mailbox: str, settings: dict) -> int:
    """Auto-reply once per conversation to new inbound client emails in a mailbox."""
    sent = 0
    since_dt = _parse_iso_dt(settings.get("autoreply_since"))
    try:
        data = await graph_mail.list_messages(mailbox, top=20)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"auto-reply list failed for {mailbox}: {exc}")
        return 0
    for msg in data.get("value", []):
        try:
            # Watermark: never auto-reply to mail that predates feature enablement
            recv_dt = _parse_iso_dt(msg.get("receivedDateTime"))
            if since_dt and recv_dt and recv_dt <= since_dt:
                continue
            frm = (msg.get("from") or {}).get("emailAddress", {})
            from_email = frm.get("address", "")
            from_name = frm.get("name") or (from_email.split("@")[0] if from_email else "there")
            conv_id = msg.get("conversationId") or msg.get("id")
            subject = (msg.get("subject") or "")
            if subject.lower().startswith(("auto:", "automatic reply", "out of office", "undeliverable")):
                continue
            if not _sender_should_get_autoreply(from_email):
                continue
            existing = await db.mail_tickets.find_one({"mailbox": mailbox, "conversation_id": conv_id})
            if existing and existing.get("auto_replied"):
                continue  # idempotent — one auto-reply per conversation
            html = (settings.get("body_html") or DEFAULT_AUTOREPLY_HTML).replace("{name}", from_name)
            await graph_mail.reply_to_message(mailbox, msg["id"], html)
            now = datetime.now(timezone.utc).isoformat()
            if existing:
                await db.mail_tickets.update_one(
                    {"id": existing["id"]},
                    {"$set": {"auto_replied": True, "auto_replied_at": now, "updated_at": now}},
                )
            else:
                await db.mail_tickets.insert_one({
                    "id": str(uuid.uuid4()),
                    "mailbox": mailbox,
                    "message_id": msg["id"],
                    "conversation_id": conv_id,
                    "from_email": from_email,
                    "from_name": from_name,
                    "subject": subject,
                    "received_at": msg.get("receivedDateTime"),
                    "auto_replied": True,
                    "auto_replied_at": now,
                    "assigned_to": None,
                    "assigned_to_name": None,
                    "assigned_to_email": None,
                    "status": "new",
                    "created_at": now,
                    "updated_at": now,
                })
            sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"auto-reply send failed in {mailbox}: {exc}")
            continue
    return sent


async def process_inbound_mail_autoreply() -> int:
    """Poll all support mailboxes and instantly auto-reply to new client emails."""
    settings = await _get_mail_autoreply_settings()
    if not settings.get("enabled", True):
        return 0
    status = await asyncio.to_thread(graph_mail.graph_status)
    if not status.get("consent_granted"):
        return 0
    total = 0
    for mb in graph_mail.get_support_mailboxes():
        total += await _process_mailbox_autoreply(mb, settings)
    return total


class MailAutoReplySettings(BaseModel):
    enabled: bool
    subject: Optional[str] = None
    body_html: Optional[str] = None


@api_router.get("/admin/mail/auto-reply/settings")
async def get_mail_autoreply_settings(request: Request):
    await _require_admin(request)
    return await _get_mail_autoreply_settings()


@api_router.put("/admin/mail/auto-reply/settings")
async def update_mail_autoreply_settings(payload: MailAutoReplySettings, request: Request):
    await _require_admin(request)
    existing = await _get_mail_autoreply_settings()
    now_iso = datetime.now(timezone.utc).isoformat()
    updates = {"enabled": payload.enabled, "updated_at": now_iso}
    # Re-enabling resets the watermark so we don't blast mail that piled up while off
    if payload.enabled and not existing.get("enabled"):
        updates["autoreply_since"] = now_iso
    if payload.subject is not None:
        updates["subject"] = payload.subject
    if payload.body_html is not None and payload.body_html.strip():
        updates["body_html"] = payload.body_html
    await db.app_settings.update_one({"id": "mail_autoreply"}, {"$set": updates}, upsert=True)
    return await _get_mail_autoreply_settings()


@api_router.post("/admin/mail/auto-reply/run")
async def run_mail_autoreply(request: Request):
    await _require_admin(request)
    try:
        n = await process_inbound_mail_autoreply()
        return {"success": True, "auto_replies_sent": n}
    except graph_mail.GraphNotConfigured:
        raise HTTPException(status_code=503, detail="Microsoft 365 not configured")


@api_router.get("/admin/mail/team")
async def list_mail_assignees(request: Request):
    await _require_admin_or_agent(request)
    members = await db.users.find(
        {"user_type": {"$in": ["admin", "agent"]}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "user_type": 1},
    ).limit(100).to_list(length=100)
    return {"members": members}


@api_router.get("/admin/mail/tickets")
async def list_mail_tickets(request: Request, mailbox: Optional[str] = None,
                            status: Optional[str] = None, assigned: Optional[str] = None):
    user = await _require_admin_or_agent(request)
    query: Dict[str, Any] = {}
    if mailbox:
        query["mailbox"] = mailbox
    if status:
        query["status"] = status
    if assigned == "me":
        query["assigned_to"] = user.id
    elif assigned == "unassigned":
        query["assigned_to"] = None
    tickets = await db.mail_tickets.find(query, {"_id": 0}).sort("received_at", -1).limit(200).to_list(length=200)
    return {"tickets": tickets}


class MailAssignRequest(BaseModel):
    assignee_id: Optional[str] = None  # None = unassign


@api_router.post("/admin/mail/mailboxes/{mailbox}/messages/{message_id}/assign")
async def assign_mail_ticket(mailbox: str, message_id: str, payload: MailAssignRequest, request: Request):
    user = await _require_admin_or_agent(request)
    _ensure_mailbox_allowed(mailbox)
    assignee_id = payload.assignee_id
    if user.user_type == "agent" and assignee_id not in (None, user.id):
        raise HTTPException(status_code=403, detail="Agents can only claim tickets to themselves")
    assignee = None
    if assignee_id:
        assignee = await db.users.find_one(
            {"id": assignee_id, "user_type": {"$in": ["admin", "agent"]}}, {"_id": 0})
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee must be an admin or agent")
    now = datetime.now(timezone.utc).isoformat()
    set_fields = {
        "assigned_to": assignee_id,
        "assigned_to_name": assignee.get("name") if assignee else None,
        "assigned_to_email": assignee.get("email") if assignee else None,
        "status": "assigned" if assignee_id else "new",
        "updated_at": now,
    }
    existing = await db.mail_tickets.find_one({"mailbox": mailbox, "message_id": message_id})
    if existing:
        await db.mail_tickets.update_one({"id": existing["id"]}, {"$set": set_fields})
        ticket_id = existing["id"]
    else:
        try:
            msg = await graph_mail.get_message(mailbox, message_id)
        except Exception:  # noqa: BLE001
            msg = {}
        frm = (msg.get("from") or {}).get("emailAddress", {})
        ticket_id = str(uuid.uuid4())
        await db.mail_tickets.insert_one({
            "id": ticket_id,
            "mailbox": mailbox,
            "message_id": message_id,
            "conversation_id": msg.get("conversationId") or message_id,
            "from_email": frm.get("address", ""),
            "from_name": frm.get("name", ""),
            "subject": msg.get("subject", ""),
            "received_at": msg.get("receivedDateTime"),
            "auto_replied": False,
            "auto_replied_at": None,
            "created_at": now,
            **set_fields,
        })
    await _log_admin_action(user.id, user.email, "mail_assign",
                            target_email=set_fields["assigned_to_email"],
                            details=f"msg {message_id[:12]} in {mailbox}")
    doc = await db.mail_tickets.find_one({"id": ticket_id}, {"_id": 0})
    return {"success": True, "ticket": doc}


@api_router.post("/admin/mail/mailboxes/{mailbox}/messages/{message_id}/resolve")
async def resolve_mail_ticket(mailbox: str, message_id: str, request: Request):
    user = await _require_admin_or_agent(request)
    _ensure_mailbox_allowed(mailbox)
    now = datetime.now(timezone.utc).isoformat()
    res = await db.mail_tickets.update_one(
        {"mailbox": mailbox, "message_id": message_id},
        {"$set": {"status": "resolved", "updated_at": now}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="No ticket for this message yet")
    doc = await db.mail_tickets.find_one({"mailbox": mailbox, "message_id": message_id}, {"_id": 0})
    return {"success": True, "ticket": doc}



# ---------------------------------------------------------------------------
# Admin Mercury Banking — Stripe payout reconciliation (READ-ONLY)
# ---------------------------------------------------------------------------
def _parse_mercury_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return None


def _payout_matches_transaction(amount_dollars: float, arrival_dt: Optional[datetime], t: Dict[str, Any]) -> bool:
    """A Mercury credit matches a Stripe payout when the amount lines up and the
    posting date is within +/- 4 days of the payout arrival date."""
    if t.get("amount", 0) <= 0:
        return False  # payouts land as credits (positive)
    if abs(round(t["amount"], 2) - amount_dollars) > 0.01:
        return False
    t_dt = _parse_mercury_dt(t.get("posted_at"))
    if arrival_dt and t_dt and abs((t_dt - arrival_dt).days) > 4:
        return False
    return True


def _reconcile_payouts(payouts: List[Dict[str, Any]], transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Match each Stripe payout to a Mercury credit transaction.

    Stripe amounts are in cents; Mercury amounts are in dollars (credits positive).
    """
    results = []
    for p in payouts:
        amount_dollars = round((p.get("amount") or 0) / 100.0, 2)
        arrival = p.get("arrival_date")
        arrival_dt = datetime.fromtimestamp(arrival, tz=timezone.utc) if arrival else None
        match = next(
            (t for t in transactions if _payout_matches_transaction(amount_dollars, arrival_dt, t)),
            None,
        )
        results.append({
            "payout_id": p.get("id"),
            "amount": amount_dollars,
            "currency": (p.get("currency") or "usd").upper(),
            "arrival_date": arrival_dt.isoformat() if arrival_dt else None,
            "status": p.get("status"),
            "description": p.get("description"),
            "reconciled": match is not None,
            "mercury_transaction": match,
        })
    return results


@api_router.get("/admin/mercury/status")
async def admin_mercury_status(request: Request):
    await _require_admin(request)
    return await mercury_client.get_status()


@api_router.get("/admin/mercury/accounts")
async def admin_mercury_accounts(request: Request):
    await _require_admin(request)
    if not mercury_client.is_configured():
        raise HTTPException(status_code=503, detail="Mercury banking is not configured")
    try:
        return {"accounts": await mercury_client.list_accounts()}
    except PermissionError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"Mercury accounts fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not reach Mercury")


@api_router.get("/admin/mercury/reconciliation")
async def admin_mercury_reconciliation(request: Request, days: int = 30):
    """Reconcile recent Stripe payouts against Mercury bank transactions."""
    await _require_admin(request)
    if not mercury_client.is_configured():
        raise HTTPException(status_code=503, detail="Mercury banking is not configured")
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    days = min(max(days, 1), 120)
    window_start = datetime.now(timezone.utc) - timedelta(days=days)
    start_iso = window_start.strftime("%Y-%m-%d")
    end_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Stripe payouts
    try:
        payout_list = await asyncio.to_thread(
            stripe.Payout.list,
            limit=100,
            created={"gte": int(window_start.timestamp())},
        )
        payouts = [dict(p) for p in payout_list.auto_paging_iter()] if hasattr(payout_list, "auto_paging_iter") else list(payout_list.get("data", []))
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"Stripe payout list failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not fetch Stripe payouts")

    # Mercury transactions
    try:
        transactions = await mercury_client.list_all_transactions(start=start_iso, end=end_iso)
    except PermissionError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"Mercury transaction fetch failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not reach Mercury")

    reconciliation = _reconcile_payouts(payouts, transactions)
    matched = sum(1 for r in reconciliation if r["reconciled"])
    return {
        "window_days": days,
        "summary": {
            "total_payouts": len(reconciliation),
            "matched": matched,
            "unmatched": len(reconciliation) - matched,
            "mercury_transactions_scanned": len(transactions),
        },
        "reconciliation": reconciliation,
    }


# Driver Wallet Routes
@api_router.get("/drivers/{driver_id}/wallet")
async def get_driver_wallet(driver_id: str, request: Request):
    """Get driver's wallet balance and earnings"""
    wallet = await db.driver_wallets.find_one({"driver_id": driver_id}, {"_id": 0})
    if not wallet:
        # Create wallet if it doesn't exist
        wallet_obj = DriverWallet(driver_id=driver_id)
        await db.driver_wallets.insert_one(wallet_obj.dict())
        wallet = wallet_obj.dict()
        wallet.pop("_id", None)
    
    # Get pending earnings from completed orders
    completed_orders = await db.orders.find({
        "driver_id": driver_id,
        "status": "delivered",
        "driver_payout_status": "pending"
    }, {"_id": 0}).to_list(length=None)
    
    pending_earnings = sum(order.get("driver_earnings", 0) for order in completed_orders)
    
    return {
        **wallet,
        "pending_earnings": pending_earnings,
        "available_balance": wallet.get("balance", 0),
        "total_earned": wallet.get("total_earned", 0)
    }

@api_router.post("/drivers/{driver_id}/wallet/add-earnings")
async def add_driver_earnings(driver_id: str, order_id: str):
    """Add earnings from a completed order to driver's wallet"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Order not yet delivered")
    
    if order.get("driver_payout_status") == "accumulated":
        raise HTTPException(status_code=400, detail="Earnings already added")
    
    # Update wallet
    driver_earnings = order.get("driver_earnings", 0)
    await db.driver_wallets.update_one(
        {"driver_id": driver_id},
        {
            "$inc": {
                "balance": driver_earnings,
                "total_earned": driver_earnings
            },
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Update order payout status
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"driver_payout_status": "accumulated"}}
    )
    
    return {"success": True, "amount_added": driver_earnings}

@api_router.post("/drivers/{driver_id}/wallet/withdraw")
async def request_driver_withdrawal(driver_id: str, amount: float, method: str, request: Request):
    """Request withdrawal from driver's wallet"""
    wallet = await db.driver_wallets.find_one({"driver_id": driver_id})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    if wallet.get("balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if amount < 10.0:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is $10")
    
    # Create withdrawal request
    withdrawal = DriverWithdrawal(
        driver_id=driver_id,
        amount=amount,
        method=method
    )
    
    await db.driver_withdrawals.insert_one(withdrawal.dict())
    
    # Deduct from available balance
    await db.driver_wallets.update_one(
        {"driver_id": driver_id},
        {
            "$inc": {"balance": -amount, "total_withdrawn": amount},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {
        "success": True,
        "withdrawal_id": withdrawal.id,
        "amount": amount,
        "status": "pending",
        "message": "Withdrawal request submitted. Processing within 1-2 business days."
    }

@api_router.get("/drivers/{driver_id}/withdrawals")
async def get_driver_withdrawals(driver_id: str):
    """Get driver's withdrawal history"""
    withdrawals = await db.driver_withdrawals.find({"driver_id": driver_id}).to_list(length=None)
    return withdrawals

# Driver Dashboard Routes
@api_router.get("/drivers/me")
async def get_current_driver(request: Request):
    """Get current driver profile"""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

@api_router.put("/drivers/status")
async def update_driver_status(status: str, request: Request):
    """Update driver online/offline status. Blocked until the driver is approved."""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"user_id": current_user.id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if driver.get("status") in ("pending", "pending_approval"):
        raise HTTPException(status_code=403, detail="Your driver application is pending admin approval. You cannot go online yet.")
    if driver.get("status") == "rejected":
        raise HTTPException(status_code=403, detail="Your driver application was rejected. Please contact support.")

    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"status": status}}
    )
    
    return {"success": True, "status": status}

@api_router.get("/drivers/order-requests")
async def get_driver_order_requests(request: Request):
    """Get pending order requests for driver"""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"user_id": current_user.id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Get orders where driver was notified but not yet assigned
    orders = await db.orders.find({
        "drivers_notified": driver["id"],
        "driver_id": None,
        "status": "pending"
    }).to_list(length=None)
    
    return orders

@api_router.get("/drivers/active-orders")
async def get_driver_active_orders(request: Request):
    """Get driver's active orders"""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"user_id": current_user.id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Get orders assigned to driver that are not yet delivered
    orders = await db.orders.find({
        "driver_id": driver["id"],
        "status": {"$in": ["ready", "picked_up", "in_transit"]}
    }).sort("created_at", 1).to_list(length=None)
    
    return orders

# Driver Location & GPS Tracking Routes
@api_router.post("/drivers/{driver_id}/location")
async def update_driver_location(driver_id: str, latitude: float, longitude: float, heading: Optional[float] = None, speed: Optional[float] = None):
    """Update driver's current location (called every 5-10 seconds)"""
    location = DriverLocation(
        driver_id=driver_id,
        latitude=latitude,
        longitude=longitude,
        heading=heading,
        speed=speed
    )
    
    # Store in database (with TTL index for auto-cleanup after 1 hour)
    await db.driver_locations.insert_one(location.dict())
    
    # Update driver's current_location field
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "current_location": {"lat": latitude, "lng": longitude},
            "last_location_update": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify any customers tracking this driver via WebSocket
    active_orders = await db.orders.find({
        "driver_id": driver_id,
        "status": {"$in": ["picked_up", "in_transit"]}
    }).to_list(length=None)
    
    for order in active_orders:
        await manager.send_personal_message(
            json.dumps({
                "type": "driver_location_update",
                "driver_id": driver_id,
                "latitude": latitude,
                "longitude": longitude,
                "heading": heading
            }),
            order["customer_id"]
        )
    
    return {"success": True}

@api_router.get("/drivers/{driver_id}/location")
async def get_driver_location(driver_id: str):
    """Get driver's most recent location"""
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    return {
        "driver_id": driver_id,
        "location": driver.get("current_location"),
        "last_update": driver.get("last_location_update"),
        "status": driver.get("status")
    }

@api_router.get("/orders/{order_id}/driver-location")
async def get_order_driver_location(order_id: str):
    """Get live driver location for an order"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order.get("driver_id"):
        return {"has_driver": False}
    
    driver = await db.drivers.find_one({"id": order["driver_id"]})
    if not driver:
        return {"has_driver": False}
    
    return {
        "has_driver": True,
        "driver_id": driver["id"],
        "location": driver.get("current_location"),
        "last_update": driver.get("last_location_update"),
        "driver_name": driver.get("name", "Driver"),
        "driver_phone": driver.get("phone"),
        "vehicle_type": driver.get("vehicle_type"),
        "vehicle_plate": driver.get("vehicle_plate")
    }

import math as _math


async def _find_nearby_drivers(pickup_lat: float, pickup_lng: float, radius_m: int = 10000) -> List[dict]:
    """Find online drivers within radius. Falls back to any online driver if none nearby."""
    nearby = await db.drivers.find({
        "status": "online",
        "current_location": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [pickup_lng, pickup_lat]},
                "$maxDistance": radius_m,
            }
        },
    }).to_list(length=100)
    if nearby:
        return nearby
    return await db.drivers.find({"status": "online"}).to_list(length=None)


def _score_driver_for_pickup(driver: dict, pickup_lat: float, pickup_lng: float) -> Optional[dict]:
    """Return {driver, distance_km, score} or None if the driver has no location."""
    loc = driver.get("current_location") or {}
    if not loc:
        return None
    distance = _math.sqrt(
        (loc.get("lat", 0) - pickup_lat) ** 2 + (loc.get("lng", 0) - pickup_lng) ** 2
    ) * 111  # rough km
    score = (driver.get("rating", 3.0) * 10) - distance
    return {"driver": driver, "distance": distance, "score": score}


# Subscription priority: subscribers get first dibs on job offers. The bonus is large
# enough to rank Premium ahead of Pro ahead of Standard, while proximity + rating still
# decide the order WITHIN a tier. Standard drivers are still notified if slots remain.
DRIVER_DISPATCH_PRIORITY_BONUS = {"premium": 1000.0, "pro": 500.0, "standard": 0.0}


async def _score_drivers_with_priority(drivers: List[dict], pickup_lat: float, pickup_lng: float) -> List[dict]:
    """Score candidates by proximity + rating, then apply a subscription-tier priority
    boost so Pro/Premium drivers are offered jobs first (Premium > Pro > Standard)."""
    scored = []
    for d in drivers:
        s = _score_driver_for_pickup(d, pickup_lat, pickup_lng)
        if not s:
            continue
        tier = await _driver_plan_tier(d.get("user_id"), d)
        s["tier"] = tier
        s["score"] += DRIVER_DISPATCH_PRIORITY_BONUS.get(tier, 0.0)
        scored.append(s)
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


async def _notify_drivers_about_order(order: dict, candidates: List[dict], top_n: int = 3) -> List[dict]:
    """Send WebSocket notifications to top-N drivers; return list of notified driver summaries."""
    notified = []
    for item in candidates[:top_n]:
        driver = item["driver"]
        await manager.send_personal_message(
            json.dumps({
                "type": "new_order_request",
                "order_id": order["id"],
                "pickup_address": order.get("pickup_address"),
                "delivery_address": order.get("delivery_address"),
                "estimated_distance": round(item["distance"], 2),
                "estimated_earnings": order.get("driver_earnings", 0),
                "timeout": 30,
            }),
            driver["user_id"],
        )
        # WhatsApp-first alert so drivers react even with the app closed.
        if driver.get("phone"):
            earn = order.get("driver_earnings", 0)
            await _wa_notify(
                driver["phone"],
                f"📦 New IslandHop delivery available (~{round(item['distance'], 1)}km, est. ${earn}). "
                f"Open the app to accept. Reply here to stay connected.",
                user_id=driver.get("user_id"), event="driver_new_order", order_id=order["id"],
            )
        notified.append({"driver_id": driver["id"], "distance_km": round(item["distance"], 2)})
    return notified


# Exclusive first-look window (seconds) subscribers get before Standard drivers see the job.
DRIVER_PRIORITY_WINDOW_SECONDS = int(os.environ.get("DRIVER_PRIORITY_WINDOW_SECONDS", "30"))


async def _priority_second_wave(order_id: str, already_notified: List[str], delay: int):
    """After the exclusive window, if the order is still unassigned, open it to the
    remaining (Standard + any un-notified) drivers, keeping priority ordering."""
    await asyncio.sleep(delay)
    order = await db.orders.find_one({"id": order_id})
    if not order or order.get("driver_id"):
        return  # a subscriber already accepted — never opens to Standard
    pickup = order.get("pickup_address", {})
    pickup_lat, pickup_lng = pickup.get("latitude"), pickup.get("longitude")
    if not pickup_lat or not pickup_lng:
        return
    drivers = await _find_nearby_drivers(pickup_lat, pickup_lng)
    scored = await _score_drivers_with_priority(drivers, pickup_lat, pickup_lng)
    remaining = [s for s in scored if s["driver"]["id"] not in set(already_notified)]
    if not remaining:
        return
    notified = await _notify_drivers_about_order(order, remaining, top_n=3)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "drivers_notified": already_notified + [d["driver_id"] for d in notified],
            "dispatch_opened_to_all_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


# Smart Driver Matching Routes
@api_router.post("/orders/{order_id}/find-driver")
async def find_and_assign_driver(order_id: str):
    """Two-phase dispatch: nearby Pro/Premium subscribers get the job offered
    EXCLUSIVELY first for DRIVER_PRIORITY_WINDOW_SECONDS; if unaccepted it opens to
    all drivers. Falls back to open dispatch immediately when no subscribers are online."""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pickup = order.get("pickup_address", {})
    pickup_lat, pickup_lng = pickup.get("latitude"), pickup.get("longitude")
    if not pickup_lat or not pickup_lng:
        raise HTTPException(status_code=400, detail="Order missing pickup coordinates")

    drivers = await _find_nearby_drivers(pickup_lat, pickup_lng)
    if not drivers:
        return {"success": False, "message": "No available drivers found", "drivers_notified": 0}

    scored = await _score_drivers_with_priority(drivers, pickup_lat, pickup_lng)
    subscribers = [s for s in scored if s["tier"] in ("pro", "premium")]

    if subscribers:
        # Phase 1 — exclusive offer to subscribers only.
        notified = await _notify_drivers_about_order(order, subscribers, top_n=3)
        notified_ids = [d["driver_id"] for d in notified]
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "drivers_notified": notified_ids,
                "driver_search_started": datetime.now(timezone.utc).isoformat(),
                "dispatch_phase": "subscriber_exclusive",
            }},
        )
        # Phase 2 — schedule opening to all if still unassigned after the window.
        asyncio.create_task(_priority_second_wave(order_id, notified_ids, DRIVER_PRIORITY_WINDOW_SECONDS))
        return {
            "success": True, "drivers_notified": len(notified), "drivers": notified,
            "phase": "subscriber_exclusive", "opens_to_all_in_seconds": DRIVER_PRIORITY_WINDOW_SECONDS,
        }

    # No subscribers online — open to everyone immediately (priority ordering still applies).
    notified = await _notify_drivers_about_order(order, scored, top_n=3)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "drivers_notified": [d["driver_id"] for d in notified],
            "driver_search_started": datetime.now(timezone.utc).isoformat(),
            "dispatch_phase": "open",
        }},
    )
    return {"success": True, "drivers_notified": len(notified), "drivers": notified, "phase": "open"}

@api_router.post("/orders/{order_id}/accept-driver")
async def driver_accept_order(order_id: str, driver_id: str):
    """Driver accepts an order assignment"""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("driver_id"):
        raise HTTPException(status_code=400, detail="Order already has a driver")
    
    # Assign driver
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "driver_id": driver_id,
            "driver_assigned_at": datetime.now(timezone.utc).isoformat(),
            "status": "confirmed"
        }}
    )

    # Finalize delivery-fee split based on this driver's subscription (10% vs 20%)
    driver_doc = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "user_id": 1})
    await _finalize_driver_split(order_id, driver_doc or {})
    
    # Update driver status
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"status": "busy"}}
    )
    
    # Notify customer
    await manager.send_personal_message(
        json.dumps({
            "type": "driver_assigned",
            "order_id": order_id,
            "driver_id": driver_id
        }),
        order["customer_id"]
    )
    
    return {"success": True, "message": "Order accepted"}

@api_router.post("/orders/{order_id}/reject-driver")
async def driver_reject_order(order_id: str, driver_id: str):
    """Driver rejects an order assignment"""
    # Continue searching for next driver
    # In production, implement timeout and move to next driver automatically
    return {"success": True, "message": "Order rejected, searching for another driver"}

# Rating & Review Routes
async def _award_five_star_bonus(rating: Rating) -> None:
    """Credit $1 bonus to driver wallet when they receive a 5-star rating. Idempotent."""
    if not (rating.driver_id and rating.driver_rating == 5):
        return
    driver_row = await db.drivers.find_one({"id": rating.driver_id}, {"_id": 0})
    driver_user_id = (driver_row or {}).get("user_id")
    if not driver_user_id:
        return
    await _credit_wallet_with_txn(
        driver_user_id, 1.00, "USD",
        txn_type="tip_in",
        order_id=rating.order_id,
        note="5-star review bonus",
    )
    await db.driver_incentives.insert_one({
        "id": str(uuid.uuid4()),
        "driver_id": rating.driver_id,
        "type": "five_star_bonus",
        "amount": 1.00,
        "currency": "USD",
        "rating_id": rating.id,
        "order_id": rating.order_id,
        "awarded_at": datetime.now(timezone.utc).isoformat(),
    })


async def _recompute_entity_avg_rating(collection_name: str, entity_id: str, rating_field: str) -> None:
    """Recompute average rating for an entity via an aggregation (avoids loading all rows)."""
    match_field = "vendor_id" if rating_field == "vendor_rating" else "driver_id"
    result = await db.ratings.aggregate([
        {"$match": {match_field: entity_id, rating_field: {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": f"${rating_field}"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    if not result or not result[0].get("count"):
        return
    await db[collection_name].update_one(
        {"id": entity_id},
        {"$set": {"rating": round(result[0]["avg"], 2), "total_ratings": result[0]["count"]}},
    )


@api_router.post("/ratings", response_model=Rating)
async def create_rating(rating_data: RatingCreate, request: Request):
    """Customer rates a delivered order."""
    current_user = await get_current_user_from_request(request)

    order = await db.orders.find_one({"id": rating_data.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("customer_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Order not yet delivered")
    if await db.ratings.find_one({"order_id": rating_data.order_id}):
        raise HTTPException(status_code=400, detail="Order already rated")

    rating = Rating(
        order_id=rating_data.order_id,
        customer_id=current_user.id,
        vendor_id=order.get("restaurant_id") or order.get("vendor_id"),
        driver_id=order.get("driver_id"),
        vendor_rating=rating_data.vendor_rating,
        driver_rating=rating_data.driver_rating,
        food_quality=rating_data.food_quality,
        delivery_speed=rating_data.delivery_speed,
        driver_professionalism=rating_data.driver_professionalism,
        driver_care=rating_data.driver_care,
        driver_communication=rating_data.driver_communication,
        vendor_review=rating_data.vendor_review,
        driver_review=rating_data.driver_review,
    )
    await db.ratings.insert_one(rating.dict())

    await _award_five_star_bonus(rating)

    if rating.vendor_id and rating.vendor_rating:
        await _recompute_entity_avg_rating("restaurants", rating.vendor_id, "vendor_rating")
        await _recompute_entity_avg_rating("businesses", rating.vendor_id, "vendor_rating")
    if rating.driver_id and rating.driver_rating:
        await _recompute_entity_avg_rating("drivers", rating.driver_id, "driver_rating")

    return rating

@api_router.get("/orders/{order_id}/rating")
async def get_order_rating(order_id: str, request: Request):
    """Has the current customer already rated this order? Returns rating or null."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("customer_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    rating = await db.ratings.find_one({"order_id": order_id}, {"_id": 0})
    return {"order_id": order_id, "rated": bool(rating), "rating": rating}


@api_router.get("/drivers/{driver_id}/incentives")
async def list_driver_incentives(driver_id: str, request: Request, limit: int = 50):
    """List a driver's earned review-driven bonuses."""
    current_user = await get_current_user_from_request(request)
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if current_user.user_type != "admin" and driver.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    cursor = db.driver_incentives.find({"driver_id": driver_id}, {"_id": 0}).sort("awarded_at", -1).limit(min(max(limit, 1), 200))
    items = await cursor.to_list(length=limit)
    total = sum(float(i.get("amount", 0) or 0) for i in items)
    return {"driver_id": driver_id, "incentives": items, "total_earned": round(total, 2)}


async def award_weekly_top_driver_bonus():
    """
    Weekly bonus for drivers with avg rating ≥ 4.8 over the past 7 days AND
    at least 10 ratings. Idempotent within a calendar week via a marker doc.
    """
    now = datetime.now(timezone.utc)
    week_key = now.strftime("%G-W%V")  # ISO week
    seven_days_ago = (now - timedelta(days=7)).isoformat()

    pipeline = [
        {"$match": {"driver_rating": {"$ne": None}, "created_at": {"$gte": seven_days_ago}}},
        {"$group": {
            "_id": "$driver_id",
            "avg": {"$avg": "$driver_rating"},
            "count": {"$sum": 1},
        }},
        {"$match": {"avg": {"$gte": 4.8}, "count": {"$gte": 10}}},
    ]
    cursor = db.ratings.aggregate(pipeline)
    awarded = 0
    async for row in cursor:
        driver_id = row["_id"]
        if not driver_id:
            continue
        # Idempotency: skip if we've already awarded this driver this week
        existing = await db.driver_incentives.find_one(
            {"driver_id": driver_id, "type": "weekly_top_driver", "week": week_key},
            {"_id": 0},
        )
        if existing:
            continue
        driver_row = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
        driver_user_id = (driver_row or {}).get("user_id")
        if not driver_user_id:
            continue
        bonus = 25.00
        await _credit_wallet_with_txn(
            driver_user_id, bonus, "USD",
            txn_type="payout_in",
            note=f"Top-rated driver weekly bonus ({week_key}) — avg {row['avg']:.2f}",
        )
        await db.driver_incentives.insert_one({
            "id": str(uuid.uuid4()),
            "driver_id": driver_id,
            "type": "weekly_top_driver",
            "week": week_key,
            "amount": bonus,
            "currency": "USD",
            "avg_rating": round(row["avg"], 2),
            "ratings_count": row["count"],
            "awarded_at": now.isoformat(),
        })
        awarded += 1
    return awarded


@api_router.post("/admin/run-weekly-driver-bonus")
async def admin_run_weekly_driver_bonus(request: Request):
    """Manual trigger for the weekly top-driver bonus job."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    n = await award_weekly_top_driver_bonus()
    return {"success": True, "drivers_awarded": n}



# ---- Monthly driver-excellence incentives (multi-area, tiered top-3) ----
MONTHLY_BONUS_TIERS = [200.0, 100.0, 50.0]   # 1st, 2nd, 3rd (USD)
MONTHLY_MIN_DELIVERIES = 20
MONTHLY_MIN_RATINGS = 10
DRIVER_RATING_AREAS = {
    "overall": "driver_rating",
    "punctuality": "delivery_speed",
    "professionalism": "driver_professionalism",
    "care": "driver_care",
    "communication": "driver_communication",
}


def _month_bounds(month: Optional[str]):
    """Return (month_key 'YYYY-MM', start_iso, end_iso) for the given month (default current UTC)."""
    now = datetime.now(timezone.utc)
    if month:
        try:
            year, mon = int(month[:4]), int(month[5:7])
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be 'YYYY-MM'")
    else:
        year, mon = now.year, now.month
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc) if mon == 12 else datetime(year, mon + 1, 1, tzinfo=timezone.utc)
    return f"{year:04d}-{mon:02d}", start.isoformat(), end.isoformat()


async def _build_driver_leaderboard(month: Optional[str]):
    month_key, start_iso, end_iso = _month_bounds(month)

    # Ratings in window (only those carrying a driver score)
    ratings = await db.ratings.find(
        {"driver_id": {"$ne": None}, "driver_rating": {"$ne": None},
         "created_at": {"$gte": start_iso, "$lt": end_iso}},
        {"_id": 0},
    ).to_list(length=None)

    # Delivered orders in window → deliveries count per driver
    delivered = await db.orders.find(
        {"driver_id": {"$ne": None}, "status": "delivered"},
        {"_id": 0, "driver_id": 1, "delivered_at": 1, "actual_delivery_time": 1, "updated_at": 1, "created_at": 1},
    ).to_list(length=None)
    deliveries_by_driver: dict = {}
    for o in delivered:
        ts = o.get("delivered_at") or o.get("actual_delivery_time") or o.get("updated_at") or o.get("created_at")
        if ts and start_iso <= ts < end_iso:
            deliveries_by_driver[o["driver_id"]] = deliveries_by_driver.get(o["driver_id"], 0) + 1

    # Aggregate per driver
    agg: dict = {}
    for r in ratings:
        d = agg.setdefault(r["driver_id"], {area: [] for area in DRIVER_RATING_AREAS})
        for area, field in DRIVER_RATING_AREAS.items():
            v = r.get(field)
            if isinstance(v, (int, float)) and v:
                d[area].append(float(v))

    # Driver names (batch)
    driver_ids = list(set(list(agg.keys()) + list(deliveries_by_driver.keys())))
    name_by_driver: dict = {}
    if driver_ids:
        drivers = await db.drivers.find({"id": {"$in": driver_ids}}, {"_id": 0, "id": 1, "user_id": 1, "name": 1}).to_list(length=None)
        user_ids = [d["user_id"] for d in drivers if d.get("user_id")]
        user_name: dict = {}
        if user_ids:
            async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}):
                user_name[u["id"]] = u.get("name")
        for d in drivers:
            name_by_driver[d["id"]] = d.get("name") or user_name.get(d.get("user_id")) or "Driver"

    rows = []
    for driver_id in driver_ids:
        area_avgs = {}
        present = []
        for area in DRIVER_RATING_AREAS:
            vals = agg.get(driver_id, {}).get(area, [])
            if vals:
                avg = round(sum(vals) / len(vals), 2)
                area_avgs[area] = avg
                present.append(avg)
            else:
                area_avgs[area] = None
        ratings_count = len(agg.get(driver_id, {}).get("overall", []))
        deliveries = deliveries_by_driver.get(driver_id, 0)
        composite = round(sum(present) / len(present), 2) if present else 0
        qualified = deliveries >= MONTHLY_MIN_DELIVERIES and ratings_count >= MONTHLY_MIN_RATINGS
        rows.append({
            "driver_id": driver_id,
            "name": name_by_driver.get(driver_id, "Driver"),
            "areas": area_avgs,
            "composite": composite,
            "ratings_count": ratings_count,
            "deliveries": deliveries,
            "qualified": qualified,
        })

    # Rank qualified drivers by composite, tiebreak ratings_count
    qualified_rows = sorted(
        [r for r in rows if r["qualified"]],
        key=lambda r: (r["composite"], r["ratings_count"]),
        reverse=True,
    )
    for i, r in enumerate(qualified_rows):
        r["rank"] = i + 1
    # Unqualified rows shown below, no rank
    rows_sorted = qualified_rows + sorted(
        [r for r in rows if not r["qualified"]],
        key=lambda r: (r["composite"], r["ratings_count"]), reverse=True,
    )

    awarded = await db.driver_incentives.find(
        {"type": "monthly_top_driver", "period": month_key}, {"_id": 0},
    ).to_list(length=None)

    return {
        "month": month_key,
        "thresholds": {"min_deliveries": MONTHLY_MIN_DELIVERIES, "min_ratings": MONTHLY_MIN_RATINGS},
        "tiers": MONTHLY_BONUS_TIERS,
        "currency": "USD",
        "areas": list(DRIVER_RATING_AREAS.keys()),
        "drivers": rows_sorted,
        "already_awarded": awarded,
    }


@api_router.get("/admin/driver-incentives/leaderboard")
async def admin_driver_leaderboard(request: Request, month: Optional[str] = None):
    """Admin: monthly driver leaderboard with per-area scores."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return await _build_driver_leaderboard(month)


@api_router.post("/admin/driver-incentives/run-monthly")
async def admin_run_monthly_driver_bonus(request: Request):
    """Admin: pay the tiered top-3 drivers for a month. Idempotent per month."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    month = body.get("month")

    board = await _build_driver_leaderboard(month)
    month_key = board["month"]

    if board["already_awarded"]:
        return {"success": False, "already_awarded": True, "month": month_key,
                "awarded": board["already_awarded"]}

    top = [d for d in board["drivers"] if d.get("qualified")][:len(MONTHLY_BONUS_TIERS)]
    if not top:
        return {"success": False, "month": month_key, "awarded": [],
                "message": "No drivers met the qualifying thresholds this month."}

    now = datetime.now(timezone.utc).isoformat()
    awarded = []
    for idx, d in enumerate(top):
        amount = MONTHLY_BONUS_TIERS[idx]
        driver_row = await db.drivers.find_one({"id": d["driver_id"]}, {"_id": 0, "user_id": 1})
        user_id = (driver_row or {}).get("user_id")
        if not user_id:
            continue
        await _credit_wallet_with_txn(
            user_id, amount, "USD", txn_type="payout_in",
            note=f"Monthly driver excellence bonus — #{idx + 1} ({month_key}), composite {d['composite']}",
        )
        rec = {
            "id": str(uuid.uuid4()),
            "driver_id": d["driver_id"],
            "type": "monthly_top_driver",
            "period": month_key,
            "rank": idx + 1,
            "amount": amount,
            "currency": "USD",
            "composite": d["composite"],
            "deliveries": d["deliveries"],
            "ratings_count": d["ratings_count"],
            "awarded_at": now,
        }
        await db.driver_incentives.insert_one(rec)
        rec.pop("_id", None)
        awarded.append(rec)

    return {"success": True, "month": month_key, "awarded": awarded}



@api_router.get("/vendors/{vendor_id}/ratings")
async def get_vendor_ratings(vendor_id: str, limit: int = 20, offset: int = 0):
    """Get ratings for a vendor (batched customer lookup; avoids N+1)."""
    ratings = await db.ratings.find({
        "vendor_id": vendor_id,
        "vendor_rating": {"$ne": None}
    }).sort("created_at", -1).skip(offset).limit(limit).to_list(length=None)

    # Batch-fetch all customer names in a single query
    customer_ids = list({r["customer_id"] for r in ratings if r.get("customer_id")})
    name_by_id: dict = {}
    if customer_ids:
        async for u in db.users.find({"id": {"$in": customer_ids}}, {"_id": 0, "id": 1, "name": 1}):
            name_by_id[u["id"]] = u.get("name") or "Anonymous"
    for rating in ratings:
        rating["customer_name"] = name_by_id.get(rating.get("customer_id"), "Anonymous")

    return ratings


# ---- Merchant reviews (Google-style: rating + comment + merchant reply) ----
class MerchantReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class MerchantReviewReply(BaseModel):
    reply: str


async def _is_merchant_owner(merchant_id: str, user: User) -> bool:
    """True if the user is an admin or owns the restaurant/business/rental for this id."""
    if user.user_type == "admin":
        return True
    for coll in ("restaurants", "businesses", "car_rental_companies"):
        doc = await db[coll].find_one({"id": merchant_id, "user_id": user.id}, {"_id": 0, "id": 1})
        if doc:
            return True
    return False


@api_router.get("/merchants/{merchant_id}/reviews")
async def get_merchant_reviews(merchant_id: str, request: Request, limit: int = 50, offset: int = 0):
    """Public: list reviews for a merchant + an aggregate summary (Google-style)."""
    limit = min(max(limit, 1), 100)
    reviews = await db.merchant_reviews.find(
        {"merchant_id": merchant_id}, {"_id": 0}
    ).sort("created_at", -1).skip(max(offset, 0)).limit(limit).to_list(length=None)

    all_rows = await db.merchant_reviews.find(
        {"merchant_id": merchant_id}, {"_id": 0, "rating": 1}
    ).to_list(length=None)
    count = len(all_rows)
    distribution = {str(i): 0 for i in range(1, 6)}
    total = 0
    for r in all_rows:
        rt = int(r.get("rating") or 0)
        if 1 <= rt <= 5:
            distribution[str(rt)] += 1
            total += rt
    average = round(total / count, 1) if count else 0

    # Optional auth → tell the client whether this viewer may reply.
    can_reply = False
    try:
        viewer = await get_current_user_from_request(request)
        can_reply = await _is_merchant_owner(merchant_id, viewer)
    except Exception:
        can_reply = False

    return {
        "merchant_id": merchant_id,
        "summary": {"average": average, "count": count, "distribution": distribution},
        "reviews": reviews,
        "can_reply": can_reply,
    }


@api_router.post("/merchants/{merchant_id}/reviews")
async def create_merchant_review(
    merchant_id: str,
    payload: MerchantReviewCreate,
    current_user: User = Depends(get_current_user),
):
    """Create or update the current customer's review for a merchant."""
    if not 1 <= payload.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    comment = (payload.comment or "").strip()
    if len(comment) > 2000:
        raise HTTPException(status_code=400, detail="Comment too long (max 2000 chars)")
    now = datetime.now(timezone.utc).isoformat()

    existing = await db.merchant_reviews.find_one(
        {"merchant_id": merchant_id, "customer_id": current_user.id}, {"_id": 0}
    )
    if existing:
        await db.merchant_reviews.update_one(
            {"id": existing["id"]},
            {"$set": {
                "rating": payload.rating,
                "comment": comment,
                "customer_name": current_user.name,
                "customer_picture": current_user.picture,
                "updated_at": now,
            }},
        )
        review_id = existing["id"]
    else:
        review_id = str(uuid.uuid4())
        await db.merchant_reviews.insert_one({
            "id": review_id,
            "merchant_id": merchant_id,
            "customer_id": current_user.id,
            "customer_name": current_user.name,
            "customer_picture": current_user.picture,
            "rating": payload.rating,
            "comment": comment,
            "reply": None,
            "reply_at": None,
            "created_at": now,
        })
    return await db.merchant_reviews.find_one({"id": review_id}, {"_id": 0})


@api_router.post("/merchants/{merchant_id}/reviews/{review_id}/reply")
async def reply_merchant_review(
    merchant_id: str,
    review_id: str,
    payload: MerchantReviewReply,
    current_user: User = Depends(get_current_user),
):
    """Merchant owner (or admin) replies to a review."""
    if not await _is_merchant_owner(merchant_id, current_user):
        raise HTTPException(status_code=403, detail="Only the merchant or an admin can reply")
    review = await db.merchant_reviews.find_one({"id": review_id, "merchant_id": merchant_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    reply = (payload.reply or "").strip()
    if not reply:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")
    await db.merchant_reviews.update_one(
        {"id": review_id},
        {"$set": {"reply": reply, "reply_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.merchant_reviews.find_one({"id": review_id}, {"_id": 0})



@api_router.get("/drivers/{driver_id}/ratings")
async def get_driver_ratings(driver_id: str, limit: int = 20):
    """Get ratings for a driver"""
    ratings = await db.ratings.find({
        "driver_id": driver_id,
        "driver_rating": {"$ne": None}
    }).sort("created_at", -1).limit(limit).to_list(length=None)
    
    return ratings

# Notification Routes
@api_router.post("/notifications/send")
async def send_notification(user_id: str, title: str, message: str, type: str = "system", data: Optional[Dict] = None):
    """Send notification to user (push + in-app)"""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        data=data
    )
    
    await db.notifications.insert_one(notification.dict())
    
    # Send via WebSocket for in-app
    await manager.send_personal_message(
        json.dumps({
            "type": "notification",
            "notification": {
                "id": notification.id,
                "title": title,
                "message": message,
                "data": data
            }
        }),
        user_id
    )
    
    # TODO: Send push notification via Firebase when user provides config
    
    return {"success": True, "notification_id": notification.id}

@api_router.get("/notifications")
async def get_user_notifications(request: Request, unread_only: bool = False):
    """Get user's notifications"""
    current_user = await get_current_user_from_request(request)
    
    query = {"user_id": current_user.id}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(query).sort("created_at", -1).limit(50).to_list(length=None)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

# Car Rental Management Routes
@api_router.post("/car-rentals", response_model=CarRentalCompany)
async def create_rental_company(company: CarRentalCompany, request: Request):
    """Create car rental company profile"""
    current_user = await get_current_user_from_request(request)
    company.user_id = current_user.id
    
    company_dict = prepare_for_mongo(company.dict())
    await db.car_rental_companies.insert_one(company_dict)
    
    # Update user type
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"user_type": "car_rental"}}
    )
    
    return company

@api_router.get("/car-rentals", response_model=List[CarRentalCompany])
async def get_rental_companies():
    """Get all active car rental companies"""
    companies = await db.car_rental_companies.find({"status": "active"}).to_list(length=None)
    return [CarRentalCompany(**company) for company in companies]

@api_router.get("/car-rentals/{company_id}", response_model=CarRentalCompany)
async def get_rental_company(company_id: str):
    """Get car rental company by ID"""
    company = await db.car_rental_companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Car rental company not found")
    return CarRentalCompany(**company)

@api_router.put("/car-rentals/{company_id}/fleet")
async def update_fleet(company_id: str, vehicles: List[RentalVehicle], request: Request):
    """Update car rental company fleet"""
    current_user = await get_current_user_from_request(request)
    
    company = await db.car_rental_companies.find_one({"id": company_id, "user_id": current_user.id})
    if not company:
        raise HTTPException(status_code=404, detail="Car rental company not found")
    
    vehicles_dict = [prepare_for_mongo(vehicle.dict()) for vehicle in vehicles]
    await db.car_rental_companies.update_one(
        {"id": company_id},
        {"$set": {"fleet": vehicles_dict}}
    )
    
    return {"message": "Fleet updated successfully"}

@api_router.get("/car-rentals/{company_id}/available-vehicles")
async def get_available_vehicles(
    company_id: str,
    pickup_date: str,
    dropoff_date: str,
    location: Optional[str] = None
):
    """Get available vehicles for rental period"""
    company = await db.car_rental_companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Car rental company not found")
    
    # Filter available vehicles (simple logic - in real app would check bookings)
    available_vehicles = [
        vehicle for vehicle in company.get("fleet", [])
        if vehicle.get("status") == "available" and
        (not location or vehicle.get("location") == location)
    ]
    
    return available_vehicles

@api_router.post("/car-rentals/bookings", response_model=RentalBooking)
async def create_rental_booking(booking: RentalBooking, request: Request):
    """Create new car rental booking"""
    current_user = await get_current_user_from_request(request)
    booking.customer_id = current_user.id
    
    # Calculate rental duration and cost
    pickup = datetime.fromisoformat(booking.pickup_datetime.isoformat())
    dropoff = datetime.fromisoformat(booking.dropoff_datetime.isoformat())
    booking.rental_duration_days = max(1, (dropoff - pickup).days)
    
    booking_dict = prepare_for_mongo(booking.dict())
    await db.rental_bookings.insert_one(booking_dict)
    
    # Notify rental company
    await manager.send_personal_message(
        json.dumps({
            "type": "new_rental_booking",
            "booking_id": booking.id,
            "booking_number": booking.booking_number
        }),
        booking.rental_company_id
    )
    
    return booking

@api_router.get("/car-rentals/bookings", response_model=List[RentalBooking])
async def get_rental_bookings(request: Request):
    """Get rental bookings for current user"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type == "customer":
        bookings = await db.rental_bookings.find({"customer_id": current_user.id}).to_list(length=None)
    elif current_user.user_type == "car_rental":
        company = await db.car_rental_companies.find_one({"user_id": current_user.id})
        if company:
            bookings = await db.rental_bookings.find({"rental_company_id": company["id"]}).to_list(length=None)
        else:
            bookings = []
    else:
        bookings = []
    
    return [RentalBooking(**booking) for booking in bookings]

@api_router.put("/car-rentals/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str, request: Request):
    """Update rental booking status"""
    current_user = await get_current_user_from_request(request)
    
    booking = await db.rental_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Validate user can update this booking
    can_update = False
    if current_user.user_type == "car_rental":
        company = await db.car_rental_companies.find_one({"user_id": current_user.id})
        if company and company["id"] == booking["rental_company_id"]:
            can_update = True
    
    if not can_update:
        raise HTTPException(status_code=403, detail="Not authorized to update this booking")
    
    # Update booking status with timestamp
    update_data = {"status": status}
    if status == "confirmed":
        update_data["confirmed_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "picked_up":
        update_data["picked_up_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "completed":
        update_data["returned_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.rental_bookings.update_one(
        {"id": booking_id},
        {"$set": update_data}
    )
    
    # Notify customer
    notification = {
        "type": "rental_status_update",
        "booking_id": booking_id,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await manager.send_personal_message(json.dumps(notification), booking["customer_id"])
    
    return {"message": f"Booking status updated to {status}"}

# KPI & Analytics Routes
@api_router.post("/analytics/customer-rating")
async def submit_customer_rating(rating: CustomerRating, request: Request):
    """Submit customer rating for order"""
    try:
        current_user = await get_current_user_from_request(request)
        rating.customer_id = current_user.id
        
        rating_dict = prepare_for_mongo(rating.dict())
        await db.customer_ratings.insert_one(rating_dict)
        
        return {"message": "Rating submitted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _kpi_day_window(date: Optional[str]) -> tuple:
    target_date = datetime.fromisoformat(date) if date else datetime.now(timezone.utc)
    start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    return target_date, start.isoformat(), end.isoformat()


def _kpi_delivery_performance(orders: List[dict]) -> tuple:
    """Returns (delivery_performance_dict, completed_orders, completed_count)."""
    completed_orders = [o for o in orders if o.get('status') == 'delivered']
    total_orders = len(orders)
    completed_count = len(completed_orders)

    delivery_times = []
    on_time_count = 0
    for order in completed_orders:
        if order.get('delivered_at') and order.get('created_at'):
            created = datetime.fromisoformat(order['created_at'])
            delivered = datetime.fromisoformat(order['delivered_at'])
            mins = (delivered - created).total_seconds() / 60
            delivery_times.append(mins)
            if mins <= 30:
                on_time_count += 1

    avg_delivery_time = sum(delivery_times) / len(delivery_times) if delivery_times else 0
    on_time_rate = (on_time_count / completed_count * 100) if completed_count > 0 else 0
    completion_rate = (completed_count / total_orders * 100) if total_orders > 0 else 0
    return ({
        "avg_delivery_time": round(avg_delivery_time, 2),
        "on_time_delivery_rate": round(on_time_rate, 2),
        "total_orders": total_orders,
        "completed_orders": completed_count,
        "order_completion_rate": round(completion_rate, 2),
    }, completed_orders, completed_count)


def _kpi_customer_satisfaction(ratings: List[dict]) -> dict:
    if not ratings:
        return {"avg_rating": 0, "total_ratings": 0, "delivery_satisfaction": 0}
    avg_rating = sum(r.get('overall_rating', 0) for r in ratings) / len(ratings)
    delivery_sat = sum(r.get('delivery_time_satisfaction', 0) for r in ratings) / len(ratings)
    return {
        "avg_rating": round(avg_rating, 2),
        "total_ratings": len(ratings),
        "delivery_satisfaction": round(delivery_sat, 2),
    }


async def _kpi_driver_performance(driver_ratings: List[dict]) -> dict:
    active = await db.drivers.count_documents({"status": {"$in": ["online", "busy"]}})
    total = await db.drivers.count_documents({})
    avg_rating = (sum(r.get('delivery_rating', 0) for r in driver_ratings) / len(driver_ratings)) if driver_ratings else 0
    utilization = (active / total * 100) if total > 0 else 0
    return {
        "active_drivers": active,
        "total_drivers": total,
        "avg_driver_rating": round(avg_rating, 2),
        "driver_utilization_rate": round(utilization, 2),
    }


def _kpi_financial(completed_orders: List[dict], rental_bookings: List[dict], completed_count: int) -> dict:
    ESTIMATED_COST_PER_ORDER = 8.50
    total_revenue = sum(o.get('total', 0) for o in completed_orders)
    completed_rentals = [r for r in rental_bookings if r.get('status') == 'completed']
    total_revenue += sum(r.get('total_cost', 0) for r in completed_rentals)

    total_transactions = completed_count + len(completed_rentals)
    avg_order_value = total_revenue / total_transactions if total_transactions > 0 else 0
    total_costs = completed_count * ESTIMATED_COST_PER_ORDER
    profit = total_revenue - total_costs
    margin = (profit / total_revenue * 100) if total_revenue > 0 else 0
    return {
        "total_revenue": round(total_revenue, 2),
        "avg_order_value": round(avg_order_value, 2),
        "order_completion_cost": round(ESTIMATED_COST_PER_ORDER, 2),
        "estimated_profit": round(profit, 2),
        "profit_margin": round(margin, 2),
    }


@api_router.get("/analytics/kpi-dashboard")
async def get_kpi_dashboard(date: Optional[str] = None):
    """Comprehensive KPI dashboard — composed from per-category helpers."""
    try:
        target_date, start_iso, end_iso = _kpi_day_window(date)
        day_range = {"$gte": start_iso, "$lte": end_iso}

        orders = await db.orders.find({"created_at": day_range}).to_list(length=None)
        rental_bookings = await db.rental_bookings.find({"created_at": day_range}).to_list(length=None)
        ratings = await db.customer_ratings.find({"created_at": day_range}).to_list(length=None)

        delivery_perf, completed_orders, completed_count = _kpi_delivery_performance(orders)
        return {
            "date": target_date.isoformat(),
            "delivery_performance": delivery_perf,
            "customer_satisfaction": _kpi_customer_satisfaction(ratings),
            "driver_performance": await _kpi_driver_performance(ratings),
            "financial_metrics": _kpi_financial(completed_orders, rental_bookings, completed_count),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/analytics/daily-operations/{date}")
async def get_daily_operations(date: str):
    """Get detailed daily operations report"""
    try:
        target_date = datetime.fromisoformat(date)
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Orders analysis
        orders = await db.orders.find({
            "created_at": {
                "$gte": start_of_day.isoformat(),
                "$lte": end_of_day.isoformat()
            }
        }).limit(10000).to_list(length=10000)
        
        # Peak hours analysis
        hourly_orders = {}
        for order in orders:
            hour = datetime.fromisoformat(order['created_at']).hour
            hourly_orders[hour] = hourly_orders.get(hour, 0) + 1
        
        peak_hours = [{"hour": hour, "orders": count} for hour, count in hourly_orders.items()]
        peak_hours.sort(key=lambda x: x["orders"], reverse=True)
        
        # Customer analysis
        unique_customers = set(o.get('customer_id') for o in orders)
        total_customers = len(unique_customers)
        
        # Revenue analysis
        completed_orders = [o for o in orders if o.get('status') == 'delivered']
        total_revenue = sum(o.get('total', 0) for o in completed_orders)
        
        operations_data = {
            "date": date,
            "summary": {
                "total_orders": len(orders),
                "completed_orders": len(completed_orders),
                "cancelled_orders": len([o for o in orders if o.get('status') == 'cancelled']),
                "total_revenue": round(total_revenue, 2),
                "unique_customers": total_customers
            },
            "peak_hours": peak_hours[:5],  # Top 5 busiest hours
            "hourly_breakdown": hourly_orders
        }
        
        return operations_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/driver-performance/{driver_id}")
async def get_driver_performance(driver_id: str, days: int = 7):
    """Get individual driver performance metrics"""
    try:
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timezone.timedelta(days=days)
        
        # Get driver's orders
        orders = await db.orders.find({
            "driver_id": driver_id,
            "created_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }).limit(5000).to_list(length=5000)
        
        completed_orders = [o for o in orders if o.get('status') == 'delivered']
        
        # Calculate performance metrics
        delivery_times = []
        earnings = 0
        on_time_count = 0
        
        for order in completed_orders:
            if order.get('delivered_at') and order.get('created_at'):
                created = datetime.fromisoformat(order['created_at'])
                delivered = datetime.fromisoformat(order['delivered_at'])
                delivery_time = (delivered - created).total_seconds() / 60
                delivery_times.append(delivery_time)
                
                if delivery_time <= 30:
                    on_time_count += 1
                
                # Driver earnings = stored payout (delivery share minus platform cut + tips)
                earnings += order.get('driver_earnings', order.get('delivery_fee', 0) * 0.8)
        
        # Get driver ratings
        ratings = await db.customer_ratings.find({
            "driver_id": driver_id,
            "created_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }).limit(5000).to_list(length=5000)
        
        avg_rating = sum(r.get('delivery_rating', 0) for r in ratings) / len(ratings) if ratings else 0
        avg_delivery_time = sum(delivery_times) / len(delivery_times) if delivery_times else 0
        on_time_rate = (on_time_count / len(completed_orders) * 100) if completed_orders else 0
        
        performance_data = {
            "driver_id": driver_id,
            "period": f"{days} days",
            "metrics": {
                "total_orders": len(orders),
                "completed_orders": len(completed_orders),
                "avg_delivery_time": round(avg_delivery_time, 2),
                "on_time_rate": round(on_time_rate, 2),
                "total_earnings": round(earnings, 2),
                "avg_rating": round(avg_rating, 2),
                "efficiency_score": round((on_time_rate + (avg_rating * 20)) / 2, 2)  # Combined metric
            }
        }
        
        return performance_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/financial-summary")
async def get_financial_summary(start_date: str, end_date: str):
    """Get comprehensive financial analysis"""
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        # Get orders in date range
        orders = await db.orders.find({
            "created_at": {
                "$gte": start.isoformat(),
                "$lte": end.isoformat()
            },
            "status": "delivered"
        }).to_list(length=None)
        
        # Revenue calculations
        total_revenue = sum(o.get('total', 0) for o in orders)
        subtotal_revenue = sum(o.get('subtotal', 0) for o in orders)
        delivery_fee_revenue = sum(o.get('delivery_fee', 0) for o in orders)
        tax_revenue = sum(o.get('tax', 0) for o in orders)
        
        # Cost calculations
        driver_payouts = sum(o.get('driver_earnings', o.get('delivery_fee', 0) * 0.8) for o in orders)
        payment_processing_fees = total_revenue * 0.029  # ~2.9% for payment processing
        operational_costs = len(orders) * 2.50  # Estimated operational cost per order
        
        total_costs = driver_payouts + payment_processing_fees + operational_costs
        net_profit = total_revenue - total_costs
        
        # Calculate metrics
        avg_order_value = total_revenue / len(orders) if orders else 0
        profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        financial_data = {
            "period": f"{start_date} to {end_date}",
            "revenue_breakdown": {
                "total_revenue": round(total_revenue, 2),
                "subtotal_revenue": round(subtotal_revenue, 2),
                "delivery_fees": round(delivery_fee_revenue, 2),
                "tax_collected": round(tax_revenue, 2)
            },
            "cost_breakdown": {
                "driver_payouts": round(driver_payouts, 2),
                "payment_processing": round(payment_processing_fees, 2),
                "operational_costs": round(operational_costs, 2),
                "total_costs": round(total_costs, 2)
            },
            "profitability": {
                "net_profit": round(net_profit, 2),
                "profit_margin": round(profit_margin, 2),
                "avg_order_value": round(avg_order_value, 2),
                "cost_per_order": round(total_costs / len(orders) if orders else 0, 2)
            },
            "kpis": {
                "total_orders": len(orders),
                "revenue_per_order": round(total_revenue / len(orders) if orders else 0, 2),
                "avg_order_completion_cost": round(total_costs / len(orders) if orders else 0, 2)
            }
        }
        
        return financial_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Business Categories Routes
@api_router.get("/business/categories", response_model=List[BusinessCategory])
async def get_business_categories():
    """Get all business categories"""
    categories = await db.business_categories.find().to_list(length=None)
    return [BusinessCategory(**cat) for cat in categories]

@api_router.post("/business/categories", response_model=BusinessCategory)
async def create_business_category(category: BusinessCategory):
    """Create business category"""
    category_dict = prepare_for_mongo(category.dict())
    await db.business_categories.insert_one(category_dict)
    return category

# Pricing Tiers Routes
@api_router.get("/business/pricing-tiers", response_model=List[PricingTier])
async def get_pricing_tiers():
    """Merchant pricing tiers — derived from the single-source MERCHANT_SUBSCRIPTION_PLANS
    catalogue so onboarding text always matches the Merchant Portal & commission logic."""
    return [
        PricingTier(
            id=p["tier"],
            name=p["name"],
            business_type="all",
            commission_rate=float(p["commission_pct"]),
            monthly_fee=float(p["price_ttd"]),
            transaction_fee=0.0,
            features=p["features"],
            is_premium=bool(p.get("featured")),
        )
        for p in MERCHANT_SUBSCRIPTION_PLANS
    ]

# Business Onboarding Routes
@api_router.post("/business/onboarding")
async def create_business_application(application: BusinessOnboardingRequest, request: Request):
    """Submit a partner/business onboarding application. Accepts partial data — bank
    info and several details are optional so applicants can complete sign-up during
    testing and add the rest later. Auth is optional (anonymous test submissions allowed)."""
    try:
        # Auth is best-effort — derive user_id if a valid session/token is present.
        user_id = None
        try:
            current_user = await get_current_user_from_request(request)
            user_id = current_user.id
        except Exception:
            user_id = None

        owner = application.business_owner or {}
        details = application.business_details or {}

        # Normalise documents to a list of dicts regardless of how the form sent them.
        docs = application.documents
        if isinstance(docs, dict):
            normalised_docs = [{"type": k, **(v if isinstance(v, dict) else {"value": v})} for k, v in docs.items()]
        elif isinstance(docs, list):
            normalised_docs = docs
        else:
            normalised_docs = []

        app_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "business_owner": owner,
            "business_details": details,
            "documents": normalised_docs,
            "banking_info": application.banking_info,  # may be None — bank is optional
            "verification_status": "pending",
            "application_date": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": None,
            "review_notes": None,
            "approved_date": None,
            # convenience fields for the admin approvals list
            "name": owner.get("name"),
            "email": owner.get("email"),
            "phone": owner.get("phone"),
            "business_name": details.get("business_name"),
        }
        await db.business_applications.insert_one(prepare_for_mongo(dict(app_doc)))
        app_doc.pop("_id", None)
        # Notify the team (email + WhatsApp) and acknowledge the applicant by email.
        app_doc["source"] = "the partner sign-up form"
        asyncio.create_task(_notify_new_application("merchant", app_doc))
        return {"success": True, "application": app_doc}
    except Exception as e:
        logging.exception("Business onboarding submission failed")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/business/onboarding")
async def get_business_applications(request: Request):
    """Get business applications for current user"""
    try:
        current_user = await get_current_user_from_request(request)
        applications = await db.business_applications.find(
            {"user_id": current_user.id}, {"_id": 0}
        ).to_list(length=None)
        return applications
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/business/onboarding/{application_id}")
async def get_business_application(application_id: str, request: Request):
    """Get specific business application"""
    try:
        current_user = await get_current_user_from_request(request)
        application = await db.business_applications.find_one({
            "id": application_id,
            "user_id": current_user.id
        }, {"_id": 0})
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return application
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# PAYMENT ROUTES — Phase A/B/C
# ============================================================
# Phase A: Customer Checkout via Stripe-hosted Checkout (server-controlled amounts)
# Phase B: Vendor Stripe Connect onboarding + scheduled payouts
# Phase C: Refunds + driver payouts
# ============================================================

class TipUpdateRequest(BaseModel):
    tip: float  # absolute dollar amount


class ApplyPromoToOrderRequest(BaseModel):
    code: str


def _recompute_order_total(order_doc: dict) -> float:
    """Compute total from order parts: subtotal + delivery_fee + tax + tip + service_fee - discount."""
    return round(
        float(order_doc.get("subtotal", 0) or 0)
        + float(order_doc.get("delivery_fee", 0) or 0)
        + float(order_doc.get("tax", 0) or 0)
        + float(order_doc.get("tip", 0) or 0)
        + float(order_doc.get("service_fee", 0) or 0)
        - float(order_doc.get("discount", 0) or 0),
        2,
    )


@api_router.post("/orders/{order_id}/apply-promo")
async def apply_promo_to_order(order_id: str, payload: ApplyPromoToOrderRequest, request: Request):
    """Validate a promo code against an unpaid order and apply the discount."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id, "customer_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot apply a promo code after payment")

    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Promo code is required")

    promo = await db.promo_codes.find_one({"code": code}, {"_id": 0})
    if not promo or not promo.get("active"):
        # Fall back to a merchant self-service coupon scoped to this order's merchant
        return await _apply_merchant_coupon(order, order_id, code, current_user)

    _assert_promo_dates_valid(promo)
    _assert_promo_usage_within_limit(promo)

    subtotal = float(order.get("subtotal", 0) or 0)
    _assert_promo_min_order(promo, subtotal)
    _assert_promo_service_type(promo, order.get("service_type"))

    discount = _calc_promo_discount(promo, subtotal, delivery_fee=float(order.get("delivery_fee", 0) or 0))

    updated = {**order, "discount": discount, "promo_code": code}
    new_total = _recompute_order_total(updated)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "discount": discount,
            "promo_code": code,
            "total": new_total,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    # Atomically record usage (idempotent per (code, order_id))
    await db.promo_codes.update_one({"code": code}, {"$inc": {"used_count": 1}})
    await db.promo_code_usage.update_one(
        {"promo_code_id": promo["id"], "order_id": order_id},
        {"$setOnInsert": {
            "promo_code_id": promo["id"],
            "user_id": current_user.id,
            "order_id": order_id,
            "used_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    return {
        "success": True,
        "code": code,
        "discount": discount,
        "total": new_total,
        "message": f"Promo applied! You saved ${discount:.2f}",
    }


@api_router.delete("/orders/{order_id}/promo")
async def remove_promo_from_order(order_id: str, request: Request):
    """Remove a promo code previously applied to an unpaid order."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id, "customer_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot remove a promo code after payment")

    updated = {**order, "discount": 0, "promo_code": None}
    new_total = _recompute_order_total(updated)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"discount": 0, "promo_code": None, "total": new_total,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "total": new_total}


# ============================================================
# MERCHANT STOREFRONT + SELF-SERVICE COUPONS
# ============================================================
import random
import string


class StorefrontUpdate(BaseModel):
    logo: Optional[str] = None       # base64 data URL or hosted URL
    cover: Optional[str] = None      # banner/cover image
    bio: Optional[str] = None        # max 500 chars
    gallery: Optional[List[str]] = None  # up to 6 images


class MerchantCouponCreate(BaseModel):
    code: Optional[str] = None       # alphanumeric; auto-generated if blank
    discount_type: str               # 'percentage' | 'fixed'
    discount_value: float
    min_order_amount: Optional[float] = 0.0
    expiry_date: Optional[str] = None  # ISO date/datetime string
    usage_limit: Optional[int] = None


class MerchantCouponToggle(BaseModel):
    active: bool


MAX_STOREFRONT_IMG_LEN = 1_500_000  # ~1.1MB binary per image after client-side resize


async def _resolve_vendor_for_user(current_user) -> tuple:
    """Return (vendor_id, vendor_type) for the signed-in merchant, else 404."""
    restaurant = await db.restaurants.find_one({"user_id": current_user.id}, {"_id": 0, "id": 1})
    if restaurant:
        return restaurant["id"], "restaurant"
    business = await db.businesses.find_one({"user_id": current_user.id}, {"_id": 0, "id": 1, "business_type": 1})
    if business:
        return business["id"], business.get("business_type") or "business"
    rental = await db.car_rental_companies.find_one({"user_id": current_user.id}, {"_id": 0, "id": 1})
    if rental:
        return rental["id"], "car_rental"
    raise HTTPException(status_code=404, detail="No merchant account found for this user")


def _validate_storefront_images(payload: StorefrontUpdate):
    for field in ("logo", "cover"):
        val = getattr(payload, field)
        if val and len(val) > MAX_STOREFRONT_IMG_LEN:
            raise HTTPException(status_code=413, detail=f"{field.capitalize()} image is too large (max ~1MB)")
    if payload.gallery is not None:
        if len(payload.gallery) > 6:
            raise HTTPException(status_code=400, detail="Gallery is limited to 6 photos")
        for g in payload.gallery:
            if g and len(g) > MAX_STOREFRONT_IMG_LEN:
                raise HTTPException(status_code=413, detail="A gallery image is too large (max ~1MB each)")


@api_router.get("/merchant/storefront")
async def get_my_storefront(request: Request):
    """Get the signed-in merchant's storefront customisation."""
    current_user = await get_current_user_from_request(request)
    vendor_id, vendor_type = await _resolve_vendor_for_user(current_user)
    doc = await db.merchant_storefronts.find_one({"vendor_id": vendor_id}, {"_id": 0})
    if not doc:
        doc = {"vendor_id": vendor_id, "vendor_type": vendor_type,
               "logo": None, "cover": None, "bio": "", "gallery": []}
    return doc


@api_router.put("/merchant/storefront")
async def update_my_storefront(payload: StorefrontUpdate, request: Request):
    """Upsert the signed-in merchant's storefront (logo, cover, bio, gallery)."""
    current_user = await get_current_user_from_request(request)
    vendor_id, vendor_type = await _resolve_vendor_for_user(current_user)
    if payload.bio is not None and len(payload.bio) > 500:
        raise HTTPException(status_code=400, detail="Bio must be 500 characters or fewer")
    _validate_storefront_images(payload)
    update = {k: v for k, v in payload.dict().items() if v is not None}
    update.update({
        "vendor_id": vendor_id,
        "vendor_type": vendor_type,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.merchant_storefronts.update_one({"vendor_id": vendor_id}, {"$set": update}, upsert=True)
    doc = await db.merchant_storefronts.find_one({"vendor_id": vendor_id}, {"_id": 0})
    return {"success": True, "storefront": doc}


@api_router.get("/merchants/{vendor_id}/storefront")
async def get_public_storefront(vendor_id: str):
    """Public storefront customisation for a merchant (used by the customer-facing store page)."""
    doc = await db.merchant_storefronts.find_one({"vendor_id": vendor_id}, {"_id": 0})
    if not doc:
        return {"vendor_id": vendor_id, "logo": None, "cover": None, "bio": "", "gallery": []}
    return doc


def _gen_coupon_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _merchant_coupon_expired(exp: Optional[str]) -> bool:
    if not exp:
        return False
    try:
        d = datetime.fromisoformat(exp)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        # Date-only values count as valid through the end of that day
        if len(exp) <= 10:
            d = d + timedelta(days=1)
        return d < datetime.now(timezone.utc)
    except Exception:
        return False


@api_router.post("/merchant/coupons")
async def create_merchant_coupon(payload: MerchantCouponCreate, request: Request):
    """Merchant creates a self-service discount coupon."""
    current_user = await get_current_user_from_request(request)
    vendor_id, vendor_type = await _resolve_vendor_for_user(current_user)

    dtype = (payload.discount_type or "").lower()
    if dtype not in ("percentage", "fixed"):
        raise HTTPException(status_code=400, detail="discount_type must be 'percentage' or 'fixed'")
    if payload.discount_value is None or payload.discount_value <= 0:
        raise HTTPException(status_code=400, detail="discount_value must be greater than 0")
    if dtype == "percentage" and payload.discount_value > 100:
        raise HTTPException(status_code=400, detail="Percentage discount cannot exceed 100%")

    code = (payload.code or "").strip().upper() or _gen_coupon_code()
    if not re.match(r"^[A-Z0-9]{3,20}$", code):
        raise HTTPException(status_code=400, detail="Code must be 3-20 alphanumeric characters")
    if await db.merchant_coupons.find_one({"vendor_id": vendor_id, "code": code}):
        raise HTTPException(status_code=400, detail="You already have a coupon with this code")

    doc = {
        "id": str(uuid.uuid4()),
        "vendor_id": vendor_id,
        "vendor_type": vendor_type,
        "code": code,
        "discount_type": dtype,
        "discount_value": round(float(payload.discount_value), 2),
        "min_order_amount": round(float(payload.min_order_amount or 0), 2),
        "expiry_date": payload.expiry_date,
        "usage_limit": payload.usage_limit,
        "used_count": 0,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.merchant_coupons.insert_one(dict(doc))
    doc.pop("_id", None)
    return {"success": True, "coupon": doc}


@api_router.get("/merchant/coupons")
async def list_merchant_coupons(request: Request):
    """List the signed-in merchant's coupons with redemption counts + expiry status."""
    current_user = await get_current_user_from_request(request)
    vendor_id, _ = await _resolve_vendor_for_user(current_user)
    coupons = await db.merchant_coupons.find(
        {"vendor_id": vendor_id}, {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(length=200)
    for c in coupons:
        c["is_expired"] = _merchant_coupon_expired(c.get("expiry_date"))
    return coupons


@api_router.patch("/merchant/coupons/{coupon_id}")
async def toggle_merchant_coupon(coupon_id: str, payload: MerchantCouponToggle, request: Request):
    """Activate / deactivate a coupon."""
    current_user = await get_current_user_from_request(request)
    vendor_id, _ = await _resolve_vendor_for_user(current_user)
    res = await db.merchant_coupons.update_one(
        {"id": coupon_id, "vendor_id": vendor_id}, {"$set": {"active": bool(payload.active)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"success": True}


@api_router.delete("/merchant/coupons/{coupon_id}")
async def delete_merchant_coupon(coupon_id: str, request: Request):
    """Delete a coupon."""
    current_user = await get_current_user_from_request(request)
    vendor_id, _ = await _resolve_vendor_for_user(current_user)
    res = await db.merchant_coupons.delete_one({"id": coupon_id, "vendor_id": vendor_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"success": True}


async def _apply_merchant_coupon(order: dict, order_id: str, code: str, current_user) -> dict:
    """Validate + apply a merchant-scoped coupon to an unpaid order (shared discount slot)."""
    merchant_id = order.get("restaurant_id") or order.get("vendor_id")
    if not merchant_id:
        raise HTTPException(status_code=404, detail="Code not found")
    coupon = await db.merchant_coupons.find_one({"vendor_id": merchant_id, "code": code}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Code not valid for this store")
    if not coupon.get("active"):
        raise HTTPException(status_code=400, detail="This coupon is no longer active")
    if _merchant_coupon_expired(coupon.get("expiry_date")):
        raise HTTPException(status_code=400, detail="This coupon has expired")

    already_used_here = await db.merchant_coupon_usage.find_one(
        {"coupon_id": coupon["id"], "order_id": order_id}
    )
    limit = coupon.get("usage_limit")
    if limit is not None and not already_used_here and coupon.get("used_count", 0) >= limit:
        raise HTTPException(status_code=400, detail="This coupon has reached its usage limit")

    subtotal = float(order.get("subtotal", 0) or 0)
    min_order = float(coupon.get("min_order_amount", 0) or 0)
    if min_order and subtotal < min_order:
        raise HTTPException(status_code=400, detail=f"Minimum order of ${min_order:.2f} required for this coupon")

    if coupon["discount_type"] == "percentage":
        discount = round(subtotal * (float(coupon["discount_value"]) / 100), 2)
    else:
        discount = round(min(float(coupon["discount_value"]), subtotal), 2)

    updated = {**order, "discount": discount, "promo_code": code}
    new_total = _recompute_order_total(updated)
    await db.orders.update_one({"id": order_id}, {"$set": {
        "discount": discount, "promo_code": code, "coupon_vendor_id": merchant_id,
        "total": new_total, "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    if not already_used_here:
        await db.merchant_coupons.update_one({"id": coupon["id"]}, {"$inc": {"used_count": 1}})
        await db.merchant_coupon_usage.insert_one({
            "coupon_id": coupon["id"], "order_id": order_id,
            "user_id": current_user.id, "used_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"success": True, "code": code, "discount": discount, "total": new_total,
            "message": f"Coupon applied! You saved ${discount:.2f}"}


@api_router.put("/orders/{order_id}/tip")
async def update_order_tip(order_id: str, payload: TipUpdateRequest, request: Request):
    """
    Update the tip on an unpaid order. Recomputes total + driver_earnings.
    Customers can change the tip any time before they pay.
    """
    current_user = await get_current_user_from_request(request)
    if payload.tip < 0 or payload.tip > 500:
        raise HTTPException(status_code=400, detail="Tip must be between $0 and $500")

    order = await db.orders.find_one({"id": order_id, "customer_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot change tip after payment")

    new_tip = round(float(payload.tip), 2)
    driver_delivery_portion = float(order.get("driver_delivery_portion", 0) or 0)
    new_driver_earnings = round(driver_delivery_portion + new_tip, 2)
    new_total = _recompute_order_total({**order, "tip": new_tip})

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "tip": new_tip,
            "total": new_total,
            "driver_earnings": new_driver_earnings,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated


class CheckoutForOrderRequest(BaseModel):
    order_id: str
    origin_url: str  # window.location.origin from frontend

@api_router.post("/payments/checkout/session")
async def create_order_checkout_session(payload: CheckoutForOrderRequest, request: Request):
    """
    Phase A: Create Stripe-hosted checkout for an EXISTING order.
    Amount is taken from the order in DB — never trusted from frontend.
    """
    current_user = await get_current_user_from_request(request)

    order = await db.orders.find_one({"id": payload.order_id, "customer_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid")

    amount = float(order.get("total") or 0.0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid order total")

    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = payload.origin_url.rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&order_id={payload.order_id}"
    cancel_url = f"{origin}/payment/cancel?order_id={payload.order_id}"

    checkout_request = CheckoutSessionRequest(
        amount=float(amount),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": payload.order_id,
            "user_id": current_user.id,
            "user_email": current_user.email,
        },
        # 'card' on Stripe Checkout automatically enables Apple Pay & Google Pay
        # wallets on supported devices (Safari/iOS for Apple Pay, Chrome/Android for Google Pay).
        payment_methods=["card"],
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    payment = PaymentTransaction(
        session_id=session.session_id,
        user_id=current_user.id,
        email=current_user.email,
        amount=amount,
        currency="usd",
        payment_status="initiated",
        metadata={"order_id": payload.order_id, "user_id": current_user.id},
    )
    await db.payment_transactions.insert_one(prepare_for_mongo(payment.dict()))

    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/payments/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """
    Phase A: Poll Stripe checkout status. Idempotent — only marks the order paid
    once, even if called multiple times in parallel.
    """
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except stripe.error.InvalidRequestError as e:  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail=f"Checkout session not found: {e.user_message or str(e)}")
    except stripe.error.StripeError as e:  # type: ignore[attr-defined]
        raise HTTPException(status_code=502, detail=f"Stripe error: {e.user_message or str(e)}")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Checkout session not found: {e}")

    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Payment transaction not found")

    # Idempotency: only act on transition into a paid state
    already_paid = txn.get("payment_status") == "paid"
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    if status.payment_status == "paid" and not already_paid:
        order_id = (txn.get("metadata") or {}).get("order_id")
        if order_id:
            await db.orders.update_one(
                {"id": order_id, "payment_status": {"$ne": "paid"}},
                {"$set": {
                    "payment_status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            # Referral completion: credit referrer + referee on first paid order
            try:
                customer_id = txn.get("user_id")
                if customer_id:
                    await _maybe_complete_referral(customer_id)
            except Exception as ref_exc:
                logging.warning(f"Referral completion failed for txn {session_id}: {ref_exc}")

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "metadata": status.metadata,
    }


# ============================================================
# WiPay Caribbean hosted checkout (sandbox) — alternative to Stripe
# Customer is redirected to WiPay's hosted page; on return we verify the
# md5(transaction_id + total + api_key) hash and mark the order paid.
# ============================================================
class WiPayCheckoutRequest(BaseModel):
    order_id: str
    origin_url: str  # window.location.origin from frontend


@api_router.post("/payments/wipay/checkout/session")
async def create_wipay_checkout_session(payload: WiPayCheckoutRequest, request: Request):
    """Create a WiPay hosted payment request for an EXISTING order (amount from DB)."""
    current_user = await get_current_user_from_request(request)

    order = await db.orders.find_one({"id": payload.order_id, "customer_id": current_user.id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid")

    amount = float(order.get("total") or 0.0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid order total")

    host_url = str(request.base_url).rstrip('/')
    response_url = f"{host_url}/api/payments/wipay/callback?origin={payload.origin_url.rstrip('/')}"

    result = await wipay_client.create_payment_request(
        order_id=payload.order_id, amount=amount, response_url=response_url,
    )
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"WiPay request failed: {result.get('error')}")

    payment = PaymentTransaction(
        session_id=result.get("transaction_id") or f"wipay_{uuid.uuid4().hex[:16]}",
        user_id=current_user.id,
        email=current_user.email,
        amount=amount,
        currency=wipay_client._cfg()["currency"].lower(),
        payment_status="initiated",
        metadata={"order_id": payload.order_id, "user_id": current_user.id, "provider": "wipay"},
    )
    await db.payment_transactions.insert_one(prepare_for_mongo(payment.dict()))

    return {"url": result["url"], "transaction_id": result.get("transaction_id"),
            "environment": wipay_client.environment()}


@api_router.get("/payments/wipay/callback")
async def wipay_callback(request: Request):
    """Public callback hit by WiPay after the customer pays. Verifies hash, marks
    the order paid, then redirects the customer to the frontend result page."""
    params = dict(request.query_params)
    origin = (params.get("origin") or os.environ.get("FRONTEND_URL", "")).rstrip('/')
    status = (params.get("status") or "").lower()
    transaction_id = params.get("transaction_id")
    order_id = params.get("order_id")
    total = params.get("total")
    received_hash = params.get("hash")

    verified = wipay_client.verify_hash(transaction_id or "", total or "", received_hash or "")
    is_sandbox = wipay_client.environment() == "sandbox"
    success = status == "success" and (verified or is_sandbox)

    await db.wipay_callbacks.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "transaction_id": transaction_id,
        "status": status,
        "total": total,
        "hash": received_hash,
        "verified": verified,
        "raw_params": params,
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    if order_id:
        txn = await db.payment_transactions.find_one(
            {"metadata.order_id": order_id, "metadata.provider": "wipay"}, {"_id": 0})
        already_paid = bool(txn and txn.get("payment_status") == "paid")
        await db.payment_transactions.update_one(
            {"metadata.order_id": order_id, "metadata.provider": "wipay"},
            {"$set": {"payment_status": "paid" if success else "failed",
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        if success and not already_paid:
            await db.orders.update_one(
                {"id": order_id, "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
            )
            try:
                if txn and txn.get("user_id"):
                    await _maybe_complete_referral(txn["user_id"])
            except Exception as ref_exc:
                logging.warning(f"Referral completion failed for WiPay order {order_id}: {ref_exc}")

    result_status = "paid" if success else "failed"
    redirect_url = f"{origin}/payment/success?order_id={order_id or ''}&via=wipay&status={result_status}"
    return RedirectResponse(url=redirect_url, status_code=303)


# ============================================================
# PayPal Checkout (Orders v2) + Payouts (v1) + Webhooks
# Mode is driven by PAYPAL_MODE (sandbox|live). Used for wallet top-ups
# (deposit) and automatic withdrawals (payouts).
# ============================================================
class PayPalCreateOrderRequest(BaseModel):
    amount: float
    currency: str = "USD"
    purpose: str = "wallet_deposit"   # 'wallet_deposit' | 'order'
    order_id: Optional[str] = None     # when purpose == 'order'
    origin_url: str                    # window.location.origin


@api_router.post("/payments/paypal/create-order")
async def paypal_create_order(payload: PayPalCreateOrderRequest, request: Request):
    current_user = await get_current_user_from_request(request)
    if not paypal_client.is_configured():
        raise HTTPException(status_code=503, detail="PayPal is not configured")

    amount = _round_money(payload.amount)
    if amount <= 0 or amount > 50000:
        raise HTTPException(status_code=400, detail="Amount must be between 0.01 and 50,000")
    currency = (payload.currency or "USD").upper()

    reference_id = str(uuid.uuid4())
    origin = payload.origin_url.rstrip('/')
    return_url = f"{origin}/payment/success?via=paypal&ref={reference_id}"
    cancel_url = f"{origin}/wallet?paypal=cancelled"

    result = await paypal_client.create_order(
        amount=amount, currency=currency, reference_id=reference_id,
        return_url=return_url, cancel_url=cancel_url,
        description=f"IslandHop {payload.purpose}",
    )
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"PayPal order creation failed: {result.get('error')}")

    await db.paypal_orders.insert_one({
        "id": result["id"],
        "reference_id": reference_id,
        "user_id": current_user.id,
        "user_email": current_user.email,
        "amount": amount,
        "currency": currency,
        "purpose": payload.purpose,
        "linked_order_id": payload.order_id,
        "status": result.get("status", "CREATED"),
        "mode": paypal_client.mode(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "captured_at": None,
    })
    return {"order_id": result["id"], "approve_url": result.get("approve_url"),
            "status": result.get("status"), "mode": paypal_client.mode()}


async def _settle_paypal_order(order_id: str, capture: dict, current_user_id: Optional[str] = None) -> dict:
    """Credit the wallet / mark order paid for a COMPLETED PayPal capture. Idempotent."""
    rec = await db.paypal_orders.find_one({"id": order_id}, {"_id": 0})
    if not rec:
        return {"success": False, "error": "PayPal order not tracked"}
    if rec.get("status") == "COMPLETED":
        return {"success": True, "already": True, "purpose": rec.get("purpose")}

    amount = float(capture.get("amount") or rec["amount"])
    currency = (capture.get("currency") or rec["currency"]).upper()
    await db.paypal_orders.update_one(
        {"id": order_id},
        {"$set": {"status": "COMPLETED", "capture_id": capture.get("capture_id"),
                  "captured_at": datetime.now(timezone.utc).isoformat()}},
    )

    if rec.get("purpose") == "wallet_deposit":
        await _credit_wallet_with_txn(
            rec["user_id"], amount, currency, txn_type="deposit",
            external_transfer_id=capture.get("capture_id"),
            note=f"PayPal deposit ({paypal_client.mode()})",
        )
    elif rec.get("purpose") == "order" and rec.get("linked_order_id"):
        await db.orders.update_one(
            {"id": rec["linked_order_id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
        )
    return {"success": True, "purpose": rec.get("purpose"), "amount": amount, "currency": currency}


@api_router.post("/payments/paypal/capture-order")
async def paypal_capture_order(request: Request):
    current_user = await get_current_user_from_request(request)
    body = await request.json()
    order_id = body.get("order_id")
    if not order_id:
        raise HTTPException(status_code=400, detail="order_id is required")

    rec = await db.paypal_orders.find_one({"id": order_id}, {"_id": 0})
    if not rec or rec.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="PayPal order not found")

    result = await paypal_client.capture_order(order_id)
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"PayPal capture failed: {result.get('error') or result.get('status')}")

    settle = await _settle_paypal_order(order_id, result, current_user.id)
    return {"success": True, "status": result.get("status"), "purpose": settle.get("purpose"),
            "amount": result.get("amount"), "currency": result.get("currency")}


@api_router.get("/payments/paypal/order-status/{order_id}")
async def paypal_order_status(order_id: str, request: Request):
    current_user = await get_current_user_from_request(request)
    rec = await db.paypal_orders.find_one({"id": order_id}, {"_id": 0})
    if not rec or rec.get("user_id") != current_user.id:
        raise HTTPException(status_code=404, detail="PayPal order not found")
    live = await paypal_client.get_order(order_id)
    return {"order_id": order_id, "local_status": rec.get("status"),
            "paypal_status": live.get("status") if live.get("success") else None,
            "purpose": rec.get("purpose"), "amount": rec.get("amount"), "currency": rec.get("currency")}


class PayPalPayoutRequest(BaseModel):
    email: str
    amount: float
    currency: str = "USD"
    note: Optional[str] = None
    funding_request_id: Optional[str] = None


@api_router.post("/admin/paypal/payout")
async def admin_paypal_payout(payload: PayPalPayoutRequest, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not paypal_client.is_configured():
        raise HTTPException(status_code=503, detail="PayPal is not configured")
    amount = _round_money(payload.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid payout amount")

    batch_id = f"ih_{uuid.uuid4().hex[:18]}"
    result = await paypal_client.create_payout(
        email=payload.email, amount=amount, currency=(payload.currency or "USD").upper(),
        note=payload.note or "IslandHop withdrawal", sender_batch_id=batch_id,
    )
    await db.paypal_payouts.insert_one({
        "id": batch_id,
        "payout_batch_id": result.get("batch_id"),
        "email": payload.email,
        "amount": amount,
        "currency": (payload.currency or "USD").upper(),
        "funding_request_id": payload.funding_request_id,
        "status": result.get("status") if result.get("success") else "FAILED",
        "error": result.get("error"),
        "initiated_by": current_user.id,
        "mode": paypal_client.mode(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"PayPal payout failed: {result.get('error')}")
    return {"success": True, "payout_batch_id": result.get("batch_id"), "status": result.get("status")}


@api_router.post("/webhooks/paypal")
async def paypal_webhook(request: Request):
    body = await request.json()
    event_type = body.get("event_type")
    verified = await paypal_client.verify_webhook(dict(request.headers), body)

    await db.paypal_webhooks.insert_one({
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "verified": verified,
        "resource_id": (body.get("resource") or {}).get("id"),
        "raw": body,
        "received_at": datetime.now(timezone.utc).isoformat(),
    })
    # Only act on verified events (when PAYPAL_WEBHOOK_ID is configured).
    if not verified:
        return {"received": True, "verified": False}

    resource = body.get("resource") or {}
    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        order_id = None
        try:
            order_id = resource["supplementary_data"]["related_ids"]["order_id"]
        except (KeyError, TypeError):
            pass
        if order_id:
            cap = {"capture_id": resource.get("id"),
                   "amount": float((resource.get("amount") or {}).get("value", 0) or 0),
                   "currency": (resource.get("amount") or {}).get("currency_code")}
            await _settle_paypal_order(order_id, cap)
    elif event_type in ("PAYOUTS-ITEM.SUCCEEDED", "PAYOUTS-ITEM.FAILED"):
        batch_id = resource.get("payout_batch_id")
        if batch_id:
            await db.paypal_payouts.update_one(
                {"payout_batch_id": batch_id},
                {"$set": {"item_status": resource.get("transaction_status") or event_type}},
            )
    return {"received": True, "verified": True}



@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Phase A: Stripe webhook receiver (canonical path)."""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="", webhook_secret=STRIPE_WEBHOOK_SECRET)
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        # Invalid signature / malformed payload — Stripe expects a non-2xx so it retries
        raise HTTPException(status_code=400, detail=f"Webhook verification failed: {e}")

    if webhook_response.session_id:
        txn = await db.payment_transactions.find_one({"session_id": webhook_response.session_id}, {"_id": 0})
        already_paid = bool(txn and txn.get("payment_status") == "paid")
        await db.payment_transactions.update_one(
            {"session_id": webhook_response.session_id},
            {"$set": {
                "payment_status": webhook_response.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if webhook_response.payment_status == "paid" and not already_paid and txn:
            order_id = (txn.get("metadata") or {}).get("order_id")
            if order_id:
                await db.orders.update_one(
                    {"id": order_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
            try:
                customer_id = txn.get("user_id")
                if customer_id:
                    await _maybe_complete_referral(customer_id)
            except Exception as ref_exc:
                logging.warning(f"Referral completion failed (webhook) for sess {webhook_response.session_id}: {ref_exc}")
    return {"status": "ok"}


# Legacy alias kept for any older clients still calling /api/payments/webhook/stripe
@api_router.post("/payments/webhook/stripe")
async def stripe_webhook_legacy(request: Request):
    return await stripe_webhook(request)


# ============================================================
# Phase B: Vendor Stripe Connect onboarding (auth-gated wrapper)
# ============================================================
class ConnectOnboardingRequest(BaseModel):
    return_url: str  # frontend URL to return to after Stripe onboarding


@api_router.post("/vendor/connect/onboarding")
async def vendor_connect_onboarding(payload: ConnectOnboardingRequest, request: Request):
    """
    Phase B: Authenticated wrapper. Creates a Stripe Connect Express account
    for the current vendor user (restaurant/business/driver) if missing, and
    returns the hosted onboarding URL.
    """
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    current_user = await get_current_user_from_request(request)

    # Find the vendor entity owned by the current user
    vendor_id = None
    vendor_type = None
    if current_user.user_type == "restaurant":
        restaurant = await db.restaurants.find_one({"user_id": current_user.id}, {"_id": 0})
        if restaurant:
            vendor_id, vendor_type = restaurant["id"], "restaurant"
    elif current_user.user_type == "driver":
        driver = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0})
        if driver:
            vendor_id, vendor_type = driver["id"], "driver"
    elif current_user.user_type == "business":
        biz = await db.businesses.find_one({"user_id": current_user.id}, {"_id": 0})
        if biz:
            vendor_id, vendor_type = biz["id"], "business"

    if not vendor_id:
        raise HTTPException(status_code=404, detail="No vendor profile found for current user")

    existing = await db.vendor_stripe_accounts.find_one({"vendor_id": vendor_id}, {"_id": 0})

    try:
        if existing:
            account_id = existing["stripe_account_id"]
        else:
            account = stripe.Account.create(
                type="express",
                country="US",
                email=current_user.email,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
            )
            account_id = account.id
            sa = VendorStripeAccount(
                vendor_id=vendor_id,
                vendor_type=vendor_type,
                stripe_account_id=account_id,
            )
            await db.vendor_stripe_accounts.insert_one(prepare_for_mongo(sa.dict()))

        return_url = payload.return_url.rstrip('/')
        account_link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=f"{return_url}/vendor/stripe-refresh",
            return_url=f"{return_url}/vendor/stripe-return",
            type="account_onboarding",
        )
        return {
            "onboarding_url": account_link.url,
            "account_id": account_id,
            "vendor_id": vendor_id,
            "vendor_type": vendor_type,
        }
    except stripe.error.StripeError as e:  # type: ignore[attr-defined]
        raise HTTPException(status_code=502, detail=f"Stripe error: {e.user_message or str(e)}")


@api_router.get("/vendor/connect/status")
async def vendor_connect_status(request: Request):
    """Phase B: Returns the current vendor's Stripe Connect status (charges/payouts enabled)."""
    current_user = await get_current_user_from_request(request)

    vendor_id = None
    if current_user.user_type == "restaurant":
        v = await db.restaurants.find_one({"user_id": current_user.id}, {"_id": 0})
        vendor_id = v and v["id"]
    elif current_user.user_type == "driver":
        v = await db.drivers.find_one({"user_id": current_user.id}, {"_id": 0})
        vendor_id = v and v["id"]
    elif current_user.user_type == "business":
        v = await db.businesses.find_one({"user_id": current_user.id}, {"_id": 0})
        vendor_id = v and v["id"]

    if not vendor_id:
        return {"connected": False, "reason": "no_vendor_profile"}

    sa = await db.vendor_stripe_accounts.find_one({"vendor_id": vendor_id}, {"_id": 0})
    if not sa:
        return {"connected": False, "vendor_id": vendor_id}

    try:
        account = stripe.Account.retrieve(sa["stripe_account_id"])
        await db.vendor_stripe_accounts.update_one(
            {"vendor_id": vendor_id},
            {"$set": {
                "account_status": "active" if account.charges_enabled else "restricted",
                "onboarding_complete": account.details_submitted,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {
            "connected": True,
            "vendor_id": vendor_id,
            "account_id": sa["stripe_account_id"],
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
            "onboarding_complete": account.details_submitted,
        }
    except stripe.error.StripeError as e:  # type: ignore[attr-defined]
        return {"connected": False, "error": e.user_message or str(e)}


# ============================================================
# Phase C: Refunds
# ============================================================
class RefundRequest(BaseModel):
    amount: Optional[float] = None  # if None → full refund
    reason: Optional[str] = None    # 'duplicate' | 'fraudulent' | 'requested_by_customer'


@api_router.post("/orders/{order_id}/refund")
async def refund_order(order_id: str, payload: RefundRequest, request: Request):
    """
    Phase C: Issue a refund for an order.
    Only the customer who placed the order or an admin user can issue.
    Orchestrates: validate → fraud-flag → route to wallet or Stripe refund.
    """
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    current_user = await get_current_user_from_request(request)

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    _validate_refund_request(current_user, order)

    # Refund attempt is itself a fraud signal — surface this order for review.
    try:
        await _maybe_flag_order(order, extra_signals=["refund_requested"])
    except Exception as e:
        logging.warning(f"Fraud flag on refund failed for order {order_id}: {e}")

    if order.get("payment_method") == "wallet":
        return await _refund_to_wallet(order, order_id, payload, current_user)
    return await _refund_via_stripe(order, order_id, payload, current_user)


def _validate_refund_request(current_user, order: Optional[dict]) -> None:
    """Authorization + state guards for a refund. Raises HTTPException on failure."""
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.user_type != "admin" and order.get("customer_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to refund this order")
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Order is not paid; nothing to refund")
    if order.get("payment_status") == "refunded":
        raise HTTPException(status_code=400, detail="Order already refunded")


def _resolve_refund_amount(order: dict, requested: Optional[float]) -> float:
    """Resolve and validate the refund amount against the order total."""
    order_total = float(order.get("total") or 0)
    amount = _round_money(requested) if requested is not None else _round_money(order_total)
    if amount <= 0 or amount > order_total:
        raise HTTPException(status_code=400, detail="Invalid refund amount")
    return amount


async def _record_refund(order_id: str, amount: float, *, method: str,
                         stripe_refund_id: Optional[str], reason, issued_by: str) -> None:
    """Append an audit row to the refunds collection."""
    await db.refunds.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "amount": amount,
        "stripe_refund_id": stripe_refund_id,
        "method": method,
        "reason": reason,
        "issued_by": issued_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _refund_to_wallet(order: dict, order_id: str, payload: "RefundRequest", current_user) -> dict:
    """Refund an order that was paid from the IslandHop wallet (no Stripe charge to reverse)."""
    order_total = float(order.get("total") or 0)
    refund_amount = _resolve_refund_amount(order, payload.amount)
    is_full = abs(refund_amount - order_total) < 0.01
    new_status = "refunded" if is_full else "partially_refunded"

    # Acquire the order-level lock FIRST (compare-and-set on payment_status)
    # so we never double-credit a wallet under concurrent refund calls.
    lock = await db.orders.update_one(
        {"id": order_id, "payment_status": "paid"},
        {"$set": {
            "payment_status": new_status,
            "refunded_amount": float(order.get("refunded_amount", 0)) + refund_amount,
            "refunded_at": datetime.now(timezone.utc).isoformat(),
            "vendor_payout_status": "reversed",
        }},
    )
    if lock.matched_count == 0:
        raise HTTPException(status_code=400, detail="Order already refunded or not in a refundable state")

    await _credit_wallet_with_txn(
        order["customer_id"], refund_amount, "USD",
        txn_type="refund", order_id=order_id, note="Wallet refund",
    )
    await _record_refund(order_id, refund_amount, method="wallet",
                         stripe_refund_id=None, reason=payload.reason, issued_by=current_user.id)
    return {"success": True, "order_id": order_id, "method": "wallet",
            "amount": refund_amount, "status": new_status}


async def _refund_via_stripe(order: dict, order_id: str, payload: "RefundRequest", current_user) -> dict:
    """Reverse a Stripe charge for an order paid by card."""
    txn = await db.payment_transactions.find_one(
        {"metadata.order_id": order_id, "payment_status": "paid"},
        {"_id": 0},
    )
    if not txn:
        raise HTTPException(status_code=404, detail="No paid transaction found for this order")

    try:
        session = stripe.checkout.Session.retrieve(txn["session_id"])
        payment_intent_id = session.payment_intent
        if not payment_intent_id:
            raise HTTPException(status_code=400, detail="No payment intent on session")

        refund_kwargs = {"payment_intent": payment_intent_id}
        if payload.amount is not None:
            if payload.amount <= 0 or payload.amount > float(order.get("total") or 0):
                raise HTTPException(status_code=400, detail="Invalid refund amount")
            refund_kwargs["amount"] = int(round(payload.amount * 100))
        if payload.reason in {"duplicate", "fraudulent", "requested_by_customer"}:
            refund_kwargs["reason"] = payload.reason

        refund = stripe.Refund.create(**refund_kwargs)
    except stripe.error.StripeError as e:  # type: ignore[attr-defined]
        raise HTTPException(status_code=502, detail=f"Stripe refund failed: {e.user_message or str(e)}")

    refund_amount = (refund.amount or 0) / 100.0
    is_full = abs(refund_amount - float(order.get("total") or 0)) < 0.01
    new_status = "refunded" if is_full else "partially_refunded"

    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_status": new_status,
            "refunded_amount": float(order.get("refunded_amount", 0)) + refund_amount,
            "refund_id": refund.id,
            "refunded_at": datetime.now(timezone.utc).isoformat(),
            "vendor_payout_status": "reversed",
        }},
    )
    await _record_refund(order_id, refund_amount, method="stripe",
                         stripe_refund_id=refund.id, reason=payload.reason, issued_by=current_user.id)
    return {
        "success": True,
        "order_id": order_id,
        "refund_id": refund.id,
        "amount": refund_amount,
        "status": new_status,
    }


# ============================================================
# Phase C: Driver Payouts via Stripe Transfer to connected account
# ============================================================
@api_router.post("/drivers/{driver_id}/payout")
async def process_driver_payout(driver_id: str, request: Request):
    """Phase C: Pay out a driver's accumulated wallet balance to their connected Stripe account."""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    current_user = await get_current_user_from_request(request)

    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    # Only the driver themselves or admin
    if current_user.user_type != "admin" and driver.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    wallet = await db.driver_wallets.find_one({"driver_id": driver_id}, {"_id": 0})
    balance = float((wallet or {}).get("balance", 0) or 0)
    if balance < 10:
        raise HTTPException(status_code=400, detail="Minimum payout amount is $10")

    sa = await db.vendor_stripe_accounts.find_one({"vendor_id": driver_id}, {"_id": 0})
    if not sa or not sa.get("payouts_enabled"):
        raise HTTPException(status_code=400, detail="Driver Stripe Connect not enabled — complete onboarding first")

    try:
        transfer = stripe.Transfer.create(
            amount=int(round(balance * 100)),
            currency="usd",
            destination=sa["stripe_account_id"],
            description=f"Driver payout — {driver_id}",
        )
    except stripe.error.StripeError as e:  # type: ignore[attr-defined]
        raise HTTPException(status_code=502, detail=f"Stripe transfer failed: {e.user_message or str(e)}")

    await db.driver_wallets.update_one(
        {"driver_id": driver_id},
        {"$inc": {"balance": -balance, "total_withdrawn": balance},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await db.driver_withdrawals.insert_one({
        "id": str(uuid.uuid4()),
        "driver_id": driver_id,
        "amount": balance,
        "method": "stripe",
        "stripe_transfer_id": transfer.id,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "amount": balance, "transfer_id": transfer.id}


# ============================================================
# WALLET ROUTES — IslandHop in-app wallet (internal credits only)
# ============================================================


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


# Currency rates (USD as base). Trinidad TTD listed first since IslandHop
# launches in Trinidad. Real FX feed can replace these later.
DEFAULT_FX_RATES_VS_USD = {
    "USD": 1.0,
    "TTD": 6.78,   # 1 USD ≈ 6.78 TTD (approx)
    "JMD": 158.40,
    "BBD": 2.00,
    "GHS": 14.50,
    "NGN": 1530.0,
    "ZAR": 18.20,
}


@api_router.get("/currency/rates")
async def get_currency_rates(base: str = "USD"):
    """Return FX rates with `base` (default USD) as 1. Trinidad TTD listed first."""
    base = (base or "USD").upper()
    if base not in DEFAULT_FX_RATES_VS_USD:
        raise HTTPException(status_code=400, detail=f"Unsupported base currency. Supported: {sorted(DEFAULT_FX_RATES_VS_USD)}")
    base_to_usd = 1.0 / DEFAULT_FX_RATES_VS_USD[base]  # how many USD per 1 base
    rates = {}
    # Trinidad first, then USD, then everyone else
    order = ["TTD", "USD", "JMD", "BBD", "GHS", "NGN", "ZAR"]
    for code in order:
        if code == base:
            rates[code] = 1.0
        else:
            # rate = (USD per 1 base) * (target per 1 USD)
            rates[code] = round(base_to_usd * DEFAULT_FX_RATES_VS_USD[code], 4)
    return {
        "base": base,
        "rates": rates,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "static",  # flip to "live" once a real feed is wired
    }


def _round_money(amount: float) -> float:
    """Round to 2 decimal places (cents) — call on every external amount."""
    return round(float(amount or 0), 2)


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


@api_router.get("/wallet")
async def get_my_wallet(request: Request):
    current_user = await get_current_user_from_request(request)
    return await _get_or_create_wallet(current_user.id)


@api_router.get("/wallet/transactions")
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


@api_router.get("/wallet/payment-methods")
async def list_payment_methods(request: Request):
    current_user = await get_current_user_from_request(request)
    methods = await db.wallet_payment_methods.find(
        {"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(length=50)
    return {"payment_methods": methods}


@api_router.post("/wallet/payment-methods")
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


@api_router.delete("/wallet/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, request: Request):
    current_user = await get_current_user_from_request(request)
    res = await db.wallet_payment_methods.delete_one({"id": method_id, "user_id": current_user.id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return {"success": True}


@api_router.post("/wallet/funding-request")
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


@api_router.get("/wallet/funding-requests")
async def my_funding_requests(request: Request):
    current_user = await get_current_user_from_request(request)
    reqs = await db.wallet_funding_requests.find(
        {"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(length=100)
    return {"requests": reqs}


@api_router.get("/admin/wallet/funding-requests")
async def admin_list_funding_requests(request: Request, status: Optional[str] = "pending"):
    await _require_admin(request)
    query = {} if status in (None, "all") else {"status": status}
    reqs = await db.wallet_funding_requests.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(length=200)
    return {"requests": reqs}


@api_router.post("/admin/wallet/funding-requests/{request_id}/approve")
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


@api_router.post("/admin/wallet/funding-requests/{request_id}/reject")
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


@api_router.post("/wallet/send")
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


@api_router.post("/wallet/requests")
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


@api_router.get("/wallet/requests")
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


@api_router.post("/wallet/requests/{request_id}/approve")
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


@api_router.post("/wallet/requests/{request_id}/decline")
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


@api_router.delete("/wallet/requests/{request_id}")
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


@api_router.post("/wallet/pay-order")
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
    return {"success": True, "transaction": txn.dict(),
            "balance": (await db.wallets.find_one({"user_id": current_user.id}, {"_id": 0}))["balances"]}


# AI Chat Routes
@api_router.post("/chat/message")
async def send_chat_message(chat_request: ChatRequest):
    """Send message to AI customer support"""
    try:
        session_id = chat_request.session_id or str(uuid.uuid4())
        
        # Initialize AI chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="""You are a helpful Caribbean delivery app customer support assistant. 
            You help users with:
            - Order tracking and delivery questions
            - Business onboarding process
            - Payment and billing inquiries
            - General app support
            - Information about services (food, pharmacy, groceries, courier, taxi)
            
            Be friendly, helpful, and use a warm Caribbean tone. Always try to resolve issues quickly."""
        ).with_model("openai", "gpt-4o-mini")
        
        # Send message
        user_message = UserMessage(text=chat_request.message)
        response = await chat.send_message(user_message)
        
        # Store chat message
        chat_msg = ChatMessage(
            session_id=session_id,
            message=chat_request.message,
            response=response
        )
        
        chat_dict = prepare_for_mongo(chat_msg.dict())
        await db.chat_messages.insert_one(chat_dict)
        
        return {
            "response": response,
            "session_id": session_id
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Get chat history for session"""
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).to_list(length=50)
        
        return [ChatMessage(**msg) for msg in messages]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Scheduled Order Routes
class ScheduledOrderCreate(BaseModel):
    service_type: str
    restaurant_id: Optional[str] = None
    items: List[Dict] = []
    delivery_address_id: str = ""
    scheduled_date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # daily, weekly, monthly
    recurrence_days: List[int] = []
    end_date: Optional[str] = None

def _compute_next_occurrence(start_dt: datetime, pattern: str, days: List[int]) -> datetime:
    """Compute the next occurrence after start_dt for a recurring schedule."""
    if pattern == "daily":
        return start_dt + timedelta(days=1)
    if pattern == "weekly":
        if not days:
            return start_dt + timedelta(days=7)
        # find next day-of-week from `days`
        for offset in range(1, 15):
            candidate = start_dt + timedelta(days=offset)
            # Python weekday(): Mon=0..Sun=6. JS getDay(): Sun=0..Sat=6 — frontend uses Sun=0
            js_dow = (candidate.weekday() + 1) % 7
            if js_dow in days:
                return candidate
        return start_dt + timedelta(days=7)
    if pattern == "monthly":
        # naive +30 days
        return start_dt + timedelta(days=30)
    return start_dt + timedelta(days=1)

@api_router.post("/scheduled-orders", response_model=ScheduledOrder)
async def create_scheduled_order(payload: ScheduledOrderCreate, request: Request):
    """Schedule an order for a future date/time. Optionally recurring."""
    current_user = await get_current_user_from_request(request)
    try:
        scheduled_dt = datetime.fromisoformat(f"{payload.scheduled_date}T{payload.scheduled_time}:00")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date or time format")

    if scheduled_dt <= datetime.now():
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")

    recurring_id: Optional[str] = None
    if payload.is_recurring:
        if not payload.recurrence_pattern:
            raise HTTPException(status_code=400, detail="recurrence_pattern required for recurring orders")
        end_dt = None
        if payload.end_date:
            try:
                end_dt = datetime.fromisoformat(f"{payload.end_date}T23:59:59")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format")
        recurring = RecurringOrder(
            user_id=current_user.id,
            service_type=payload.service_type,
            restaurant_id=payload.restaurant_id,
            items=payload.items,
            delivery_address_id=payload.delivery_address_id,
            recurrence_pattern=payload.recurrence_pattern,
            recurrence_days=payload.recurrence_days,
            start_date=scheduled_dt,
            end_date=end_dt,
            next_occurrence=_compute_next_occurrence(scheduled_dt, payload.recurrence_pattern, payload.recurrence_days),
            orders_created=1,
        )
        await db.recurring_orders.insert_one(recurring.dict())
        recurring_id = recurring.id

    scheduled = ScheduledOrder(
        user_id=current_user.id,
        service_type=payload.service_type,
        restaurant_id=payload.restaurant_id,
        items=payload.items,
        delivery_address_id=payload.delivery_address_id,
        scheduled_datetime=scheduled_dt,
        is_recurring=payload.is_recurring,
        recurring_pattern=payload.recurrence_pattern,
        recurrence_days=payload.recurrence_days,
        recurring_order_id=recurring_id,
    )
    await db.scheduled_orders.insert_one(scheduled.dict())
    return scheduled

@api_router.get("/scheduled-orders", response_model=List[ScheduledOrder])
async def list_scheduled_orders(request: Request):
    """List upcoming scheduled orders for the current user."""
    current_user = await get_current_user_from_request(request)
    cursor = db.scheduled_orders.find(
        {"user_id": current_user.id, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0},
    ).sort("scheduled_datetime", 1)
    orders = await cursor.to_list(length=200)
    return [ScheduledOrder(**o) for o in orders]

@api_router.delete("/scheduled-orders/{order_id}")
async def cancel_scheduled_order(order_id: str, request: Request):
    """Cancel a scheduled order."""
    current_user = await get_current_user_from_request(request)
    result = await db.scheduled_orders.update_one(
        {"id": order_id, "user_id": current_user.id},
        {"$set": {"status": "cancelled"}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled order not found")
    return {"success": True, "id": order_id, "status": "cancelled"}

@api_router.get("/recurring-orders", response_model=List[RecurringOrder])
async def list_recurring_orders(request: Request):
    """List active recurring orders for the current user."""
    current_user = await get_current_user_from_request(request)
    cursor = db.recurring_orders.find(
        {"user_id": current_user.id, "active": True},
        {"_id": 0},
    ).sort("next_occurrence", 1)
    items = await cursor.to_list(length=200)
    return [RecurringOrder(**r) for r in items]

@api_router.delete("/recurring-orders/{recurring_id}")
async def delete_recurring_order(recurring_id: str, request: Request):
    """Delete (deactivate) a recurring order and cancel its pending children."""
    current_user = await get_current_user_from_request(request)
    result = await db.recurring_orders.update_one(
        {"id": recurring_id, "user_id": current_user.id},
        {"$set": {"active": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recurring order not found")
    # Cancel its future pending scheduled orders
    await db.scheduled_orders.update_many(
        {"user_id": current_user.id, "recurring_order_id": recurring_id, "status": "pending"},
        {"$set": {"status": "cancelled"}},
    )
    return {"success": True, "id": recurring_id, "active": False}

# Status Routes
@api_router.get("/")
async def root():
    return {"message": "Caribbean Delivery App API"}


@api_router.get("/download/android-project")
async def download_android_project():
    """Public download of the Capacitor Android project zip (for local .aab builds)."""
    zip_path = ROOT_DIR / "static" / "android-project.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Android project archive not found")
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename="islandhop-android-project.zip",
    )


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# ============================================================
# P1 FEATURE: OTP VERIFICATION (Phone Signup) — Twilio (mocked)
# ============================================================
import twilio_client


class OTPSendRequest(BaseModel):
    phone: str
    purpose: str = "signup"  # signup | login | verify | password_reset


class OTPVerifyRequest(BaseModel):
    phone: str
    code: str
    purpose: str = "signup"


def _normalize_phone(p: str) -> str:
    """Normalize to E.164. Defaults bare local numbers to Trinidad & Tobago (+1868)."""
    if not p:
        return ""
    p = p.strip()
    had_plus = p.startswith("+")
    digits = re.sub(r"\D", "", p)
    if not digits:
        return ""
    if had_plus:
        return "+" + digits
    # No '+' provided — infer country code for the Caribbean (NANP)
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits                 # 1XXXXXXXXXX → +1XXXXXXXXXX
    if len(digits) == 10:
        return "+1" + digits                # NANP 10-digit (incl. +1868/+1868) → +1XXXXXXXXXX
    if len(digits) == 7:
        return "+1868" + digits             # bare TT local 7-digit → +1868XXXXXXX
    return "+" + digits                      # best effort


@api_router.post("/otp/send")
async def otp_send(payload: OTPSendRequest):
    """Send a one-time code via SMS (mocked in MOCK_TWILIO mode).

    Throttling: max 5 sends per phone per hour.
    """
    phone = _normalize_phone(payload.phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")

    hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent = await db.otp_codes.count_documents({"phone": phone, "created_at": {"$gte": hour_ago}})
    if recent >= 5:
        raise HTTPException(status_code=429, detail="Too many OTP requests — try again later")

    code = twilio_client.generate_otp(6)
    expires_in = int(os.environ.get("OTP_EXPIRE_MINUTES", "10"))
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=expires_in))

    otp_doc = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "code": code,
        "purpose": payload.purpose,
        "attempts": 0,
        "verified": False,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.otp_codes.insert_one(otp_doc)

    body = f"Your IslandHop verification code is {code}. It expires in {expires_in} minutes."
    send_result = twilio_client.send_sms(phone, body)
    dev_return = os.environ.get("OTP_DEV_RETURN_CODE", "true").lower() in {"1", "true", "yes"}

    if not send_result.get("success"):
        logger.warning(f"OTP SMS send failed for {phone}: {send_result.get('error')} (code={send_result.get('error_code')})")
        # In dev/preview we still return the code so testing isn't blocked.
        if not dev_return:
            raise HTTPException(
                status_code=400,
                detail="We couldn't send your code by SMS right now. Please double-check the phone number (include the country code, e.g. +1868…) and try again.",
            )

    response = {
        "success": True,
        "expires_at": expires_at.isoformat(),
        "channel": "sms",
        "mock": send_result.get("mock", False),
        "phone": phone,
    }
    if not send_result.get("success"):
        response["sms_delivered"] = False
        response["warning"] = send_result.get("error")
    # In dev/mock mode return the code so test flows + the UI can show it.
    if dev_return:
        response["dev_code"] = code
    return response


@api_router.post("/otp/verify")
async def otp_verify(payload: OTPVerifyRequest):
    """Verify a previously-sent OTP code. Marks phone as verified for that purpose."""
    phone = _normalize_phone(payload.phone)
    if not phone or not payload.code:
        raise HTTPException(status_code=400, detail="Phone and code required")

    now_iso = datetime.now(timezone.utc).isoformat()
    otp = await db.otp_codes.find_one(
        {"phone": phone, "purpose": payload.purpose, "verified": False, "expires_at": {"$gt": now_iso}},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not otp:
        raise HTTPException(status_code=400, detail="No active OTP — request a new one")

    if otp.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many wrong attempts — request a new code")

    if str(otp["code"]) != str(payload.code).strip():
        await db.otp_codes.update_one({"id": otp["id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid code")

    await db.otp_codes.update_one(
        {"id": otp["id"]},
        {"$set": {"verified": True, "verified_at": now_iso}},
    )
    # If a user exists with this phone, mark phone_verified
    await db.users.update_one({"phone": phone}, {"$set": {"phone_verified": True}})
    return {"success": True, "phone": phone, "verified": True}


# ============================================================
# P1 FEATURE: REFERRAL ENGINE
# ============================================================
def _gen_referral_code(name: str) -> str:
    base = re.sub(r"[^A-Z0-9]", "", (name or "ISLE").upper())[:4] or "ISLE"
    return f"{base}{uuid.uuid4().hex[:4].upper()}"


REFERRAL_REWARD_AMOUNT = float(os.environ.get("REFERRAL_REWARD_AMOUNT", "10"))
REFERRAL_REWARD_CURRENCY = os.environ.get("REFERRAL_REWARD_CURRENCY", "TTD")


class ApplyReferralRequest(BaseModel):
    code: str


async def _get_or_create_referral_code(user: User) -> dict:
    existing = await db.referral_codes.find_one({"user_id": user.id}, {"_id": 0})
    if existing:
        return existing
    # Build a unique code (collisions are extremely unlikely with hex suffix)
    for _ in range(5):
        code = _gen_referral_code(user.name)
        if not await db.referral_codes.find_one({"code": code}):
            break
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "code": code,
        "total_referrals": 0,
        "total_rewards": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.referral_codes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/referrals/my-code")
async def get_my_referral_code(request: Request):
    """Return (or create) the current user's referral code."""
    current_user = await get_current_user_from_request(request)
    code = await _get_or_create_referral_code(current_user)
    code.pop("_id", None)
    return code


@api_router.post("/referrals/apply")
async def apply_referral(payload: ApplyReferralRequest, request: Request):
    """Apply a referral code to the current user (one-time, at signup)."""
    current_user = await get_current_user_from_request(request)
    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code required")

    # Already referred?
    existing_ref = await db.referrals.find_one({"referee_id": current_user.id})
    if existing_ref:
        raise HTTPException(status_code=400, detail="A referral has already been applied to this account")

    code_doc = await db.referral_codes.find_one({"code": code})
    if not code_doc:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if code_doc["user_id"] == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot use your own referral code")

    referral_doc = {
        "id": str(uuid.uuid4()),
        "referrer_id": code_doc["user_id"],
        "referee_id": current_user.id,
        "code_used": code,
        "status": "pending",  # pending until first paid order
        "reward_amount": REFERRAL_REWARD_AMOUNT,
        "reward_currency": REFERRAL_REWARD_CURRENCY,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }
    await db.referrals.insert_one(referral_doc)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"referred_by": code_doc["user_id"], "referral_code_used": code}},
    )
    referral_doc.pop("_id", None)
    return {"success": True, "referral": referral_doc}


@api_router.get("/referrals/my-referrals")
async def list_my_referrals(request: Request):
    """List referrals made by the current user."""
    current_user = await get_current_user_from_request(request)
    refs = await db.referrals.find({"referrer_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    code = await _get_or_create_referral_code(current_user)
    code.pop("_id", None)
    pending = sum(1 for r in refs if r.get("status") == "pending")
    completed = sum(1 for r in refs if r.get("status") == "completed")
    total_earned = sum(r.get("reward_amount", 0) for r in refs if r.get("status") == "completed")
    return {
        "code": code["code"],
        "total_referrals": len(refs),
        "pending": pending,
        "completed": completed,
        "total_earned": total_earned,
        "reward_currency": REFERRAL_REWARD_CURRENCY,
        "reward_amount": REFERRAL_REWARD_AMOUNT,
        "referrals": refs,
    }


async def _maybe_complete_referral(referee_id: str):
    """Called when a referee pays for an order — completes pending referral and credits both wallets."""
    ref = await db.referrals.find_one({"referee_id": referee_id, "status": "pending"})
    if not ref:
        return
    amount = float(ref.get("reward_amount", 0) or 0)
    currency = ref.get("reward_currency", REFERRAL_REWARD_CURRENCY)
    referrer_id = ref["referrer_id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    # Credit referrer's wallet
    for uid, role in [(referrer_id, "referrer"), (referee_id, "referee")]:
        wallet = await db.wallets.find_one({"user_id": uid})
        if not wallet:
            wallet_doc = {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "balances": {"USD": 0.0, "TTD": 0.0},
                "default_currency": "TTD",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            await db.wallets.insert_one(wallet_doc)
            wallet = wallet_doc
        await db.wallets.update_one(
            {"id": wallet["id"]},
            {"$inc": {f"balances.{currency}": amount}, "$set": {"updated_at": now_iso}},
        )
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "wallet_id": wallet["id"],
            "type": "referral_reward",
            "amount": amount,
            "currency": currency,
            "status": "completed",
            "note": f"Referral reward ({role})",
            "created_at": now_iso,
        })

    await db.referrals.update_one(
        {"id": ref["id"]},
        {"$set": {"status": "completed", "completed_at": now_iso}},
    )
    await db.referral_codes.update_one(
        {"user_id": referrer_id},
        {"$inc": {"total_referrals": 1, "total_rewards": amount}},
    )
    # Promoter (QR) compensation for the customer-onboarding milestone.
    await _award_promo_reward(referee_id, "customer", "first_paid_order")


# ============================================================
# PROMOTER / AMBASSADOR QR SYSTEM
# Each user has a referral code (reused) + QR. Promoters earn wallet
# rewards when people they onboarded complete a qualifying action.
# Paid immediately if the promoter is ELIGIBLE (admin-approved Ambassador
# OR an active/approved account); otherwise HELD until they become eligible.
# ============================================================
PROMO_REWARD_CURRENCY = os.environ.get("PROMO_REWARD_CURRENCY", "USD")
PROMO_REWARDS = {
    "customer": float(os.environ.get("PROMO_REWARD_CUSTOMER", "5")),
    "driver": float(os.environ.get("PROMO_REWARD_DRIVER", "15")),
    "merchant": float(os.environ.get("PROMO_REWARD_MERCHANT", "20")),
    "supplier": float(os.environ.get("PROMO_REWARD_SUPPLIER", "25")),
}
PROMO_TYPE_LABEL = {
    "customer": "Customer", "driver": "Driver",
    "merchant": "Business/Merchant", "supplier": "Supplier",
}


async def _is_eligible_promoter(promoter: Optional[dict]) -> bool:
    """Eligible = admin-approved Ambassador OR an active/approved account."""
    if not promoter:
        return False
    if promoter.get("is_promoter"):
        return True
    if promoter.get("user_type") in ("driver", "restaurant", "business", "admin", "agent"):
        return True
    uid = promoter.get("id")
    if uid:
        if await db.drivers.find_one({"user_id": uid, "status": {"$in": ["active", "online", "busy"]}}, {"_id": 1}):
            return True
        if await db.restaurants.find_one({"user_id": uid, "status": {"$in": ["active", "approved"]}}, {"_id": 1}):
            return True
        if await db.car_rental_companies.find_one({"user_id": uid, "status": {"$in": ["active", "approved"]}}, {"_id": 1}):
            return True
        if await db.business_applications.find_one({"user_id": uid, "verification_status": "verified"}, {"_id": 1}):
            return True
    return False


async def _release_held_promo_rewards(promoter_id: str) -> int:
    """If the promoter is now eligible, credit any HELD rewards to their wallet."""
    promoter = await db.users.find_one({"id": promoter_id}, {"_id": 0})
    if not await _is_eligible_promoter(promoter):
        return 0
    held = await db.promo_rewards.find({"promoter_id": promoter_id, "status": "held"}).limit(1000).to_list(length=1000)
    now_iso = datetime.now(timezone.utc).isoformat()
    for r in held:
        await _credit_wallet_with_txn(
            promoter_id, r["amount"], r.get("currency", PROMO_REWARD_CURRENCY),
            txn_type="promoter_reward", counterparty_user_id=r.get("referred_user_id"),
            note=f"Promoter reward: {PROMO_TYPE_LABEL.get(r.get('type'), r.get('type'))} onboarding",
        )
        await db.promo_rewards.update_one({"id": r["id"]}, {"$set": {"status": "paid", "paid_at": now_iso}})
    return len(held)


async def _award_promo_reward(referred_user_id: str, reward_type: str, qualifying_event: str, require_first_order: bool = False) -> None:
    """Grant the promoter (referred_user.referred_by) a reward for an onboarding milestone. Idempotent.

    If require_first_order=True (Drivers / Businesses / Merchants / Suppliers) the reward is created in a
    'pending_first_order' state and is NOT paid out until the referred entity completes their first order
    (see _settle_partner_first_order_rewards). Otherwise it pays immediately when the promoter is eligible
    (or is 'held' until they become eligible)."""
    user = await db.users.find_one({"id": referred_user_id}, {"_id": 0})
    if not user or not user.get("referred_by") or user["referred_by"] == referred_user_id:
        return
    promoter_id = user["referred_by"]
    if await db.promo_rewards.find_one(
        {"promoter_id": promoter_id, "referred_user_id": referred_user_id, "type": reward_type}, {"_id": 1}
    ):
        return  # one reward per (promoter, referred_user, type)
    amount = float(PROMO_REWARDS.get(reward_type, 0) or 0)
    if amount <= 0:
        return
    promoter = await db.users.find_one({"id": promoter_id}, {"_id": 0})
    eligible = await _is_eligible_promoter(promoter)
    now_iso = datetime.now(timezone.utc).isoformat()
    reward = {
        "id": str(uuid.uuid4()),
        "promoter_id": promoter_id,
        "referred_user_id": referred_user_id,
        "referred_name": user.get("name"),
        "referred_entity_type": reward_type,
        "type": reward_type,
        "amount": amount,
        "currency": PROMO_REWARD_CURRENCY,
        "qualifying_event": qualifying_event,
        "signup_date": user.get("created_at"),
        "first_order_at": None,
        "created_at": now_iso,
        "paid_at": None,
    }
    if require_first_order:
        # Held in escrow until the referred entity completes their FIRST order.
        reward["status"] = "pending_first_order"
        await db.promo_rewards.insert_one(reward)
        return
    reward["status"] = "paid" if eligible else "held"
    if eligible:
        reward["paid_at"] = now_iso
        await _credit_wallet_with_txn(
            promoter_id, amount, PROMO_REWARD_CURRENCY, txn_type="promoter_reward",
            counterparty_user_id=referred_user_id,
            note=f"Promoter reward: {PROMO_TYPE_LABEL.get(reward_type, reward_type)} onboarding",
        )
    await db.promo_rewards.insert_one(reward)


async def _settle_partner_first_order_rewards(order: dict) -> None:
    """When a referred partner (Driver / Merchant / Business / Supplier) completes their FIRST order,
    move their promoter's 'pending_first_order' reward to paid (or 'held' if the promoter is not yet
    eligible). Idempotent — only transitions rewards still in 'pending_first_order'. Never raises."""
    try:
        user_ids = set()
        vendor_id = order.get("restaurant_id") or order.get("vendor_id")
        if vendor_id:
            for coll in ("restaurants", "business_applications", "car_rental_companies"):
                doc = await db[coll].find_one({"id": vendor_id}, {"_id": 0, "user_id": 1})
                if doc and doc.get("user_id"):
                    user_ids.add(doc["user_id"])
                    break
        driver_id = order.get("driver_id")
        if driver_id:
            d = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "user_id": 1})
            if d and d.get("user_id"):
                user_ids.add(d["user_id"])
        if not user_ids:
            return
        now_iso = datetime.now(timezone.utc).isoformat()
        for uid in user_ids:
            rewards = await db.promo_rewards.find(
                {"referred_user_id": uid, "status": "pending_first_order"}
            ).to_list(length=50)
            for r in rewards:
                promoter = await db.users.find_one({"id": r["promoter_id"]}, {"_id": 0})
                eligible = await _is_eligible_promoter(promoter)
                update = {"first_order_at": now_iso}
                if eligible:
                    update["status"] = "paid"
                    update["paid_at"] = now_iso
                    await _credit_wallet_with_txn(
                        r["promoter_id"], r["amount"], r.get("currency", PROMO_REWARD_CURRENCY),
                        txn_type="promoter_reward", counterparty_user_id=uid,
                        note=f"Promoter reward: {PROMO_TYPE_LABEL.get(r.get('type'), r.get('type'))} first order",
                    )
                else:
                    update["status"] = "held"
                await db.promo_rewards.update_one({"id": r["id"]}, {"$set": update})
    except Exception as exc:
        logging.warning(f"Partner first-order reward settlement failed for order {order.get('id')}: {exc}")


@api_router.get("/promoter/me")
async def get_promoter_me(request: Request):
    """Promoter dashboard summary: code, eligibility, reward schedule, totals."""
    current_user = await get_current_user_from_request(request)
    code_doc = await _get_or_create_referral_code(current_user)
    await _release_held_promo_rewards(current_user.id)
    promoter = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    eligible = await _is_eligible_promoter(promoter)
    rewards = await db.promo_rewards.find({"promoter_id": current_user.id}, {"_id": 0}).to_list(length=None)
    paid = sum(r["amount"] for r in rewards if r.get("status") == "paid")
    held = sum(r["amount"] for r in rewards if r.get("status") == "held")
    by_type: dict = {}
    for r in rewards:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1
    return {
        "code": code_doc["code"],
        "is_eligible": eligible,
        "is_ambassador": bool((promoter or {}).get("is_promoter")),
        "currency": PROMO_REWARD_CURRENCY,
        "reward_schedule": PROMO_REWARDS,
        "totals": {"paid": round(paid, 2), "held": round(held, 2), "count": len(rewards), "by_type": by_type},
    }


@api_router.get("/promoter/onboards")
async def get_promoter_onboards(request: Request):
    """List people this promoter onboarded, with status + rewards earned."""
    current_user = await get_current_user_from_request(request)
    referred = await db.users.find(
        {"referred_by": current_user.id},
        {"_id": 0, "id": 1, "name": 1, "user_type": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(length=500)
    rewards = await db.promo_rewards.find({"promoter_id": current_user.id}, {"_id": 0}).to_list(length=None)
    rewards_by_user: dict = {}
    for r in rewards:
        rewards_by_user.setdefault(r["referred_user_id"], []).append(
            {"type": r["type"], "amount": r["amount"], "status": r["status"]}
        )
    out = [{
        "user_id": u["id"], "name": u.get("name"), "role": u.get("user_type"),
        "joined_at": u.get("created_at"), "rewards": rewards_by_user.get(u["id"], []),
    } for u in referred]
    return {"onboards": out, "count": len(out)}


@api_router.get("/promoter/leaderboard")
async def get_promoter_leaderboard(limit: int = 20):
    """Top promoters by total PAID rewards (public, names only)."""
    pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {"_id": "$promoter_id", "total": {"$sum": "$amount"}, "onboards": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": int(limit)},
    ]
    rows = await db.promo_rewards.aggregate(pipeline).to_list(length=limit)
    ids = [r["_id"] for r in rows]
    names: dict = {}
    if ids:
        async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1}):
            names[u["id"]] = u.get("name")
    out = [{
        "rank": i + 1, "name": names.get(r["_id"], "Promoter"),
        "total": round(r["total"], 2), "onboards": r["onboards"],
    } for i, r in enumerate(rows)]
    return {"leaderboard": out, "currency": PROMO_REWARD_CURRENCY}


@api_router.get("/promoter/social-proof")
async def get_promoter_social_proof():
    """Public: top promoter's earnings THIS MONTH for homepage social proof (first name only)."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline = [
        {"$match": {"status": "paid", "paid_at": {"$gte": month_start}}},
        {"$group": {"_id": "$promoter_id", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 1},
    ]
    rows = await db.promo_rewards.aggregate(pipeline).to_list(length=1)
    onboards_this_month = await db.promo_rewards.count_documents({"status": "paid", "paid_at": {"$gte": month_start}})
    if not rows:
        return {"has_data": False, "currency": PROMO_REWARD_CURRENCY, "onboards_this_month": 0}
    top = rows[0]
    promoter = await db.users.find_one({"id": top["_id"]}, {"_id": 0, "name": 1})
    full = (promoter or {}).get("name") or "A promoter"
    first = full.split()[0] if full else "A promoter"
    return {
        "has_data": True,
        "top_name": first,
        "top_earnings": round(top["total"], 2),
        "onboards_this_month": onboards_this_month,
        "currency": PROMO_REWARD_CURRENCY,
    }


@api_router.get("/promoter/resolve/{code}")
async def resolve_promoter_code(code: str):
    """Public: resolve a promoter code to a display name for the join landing page."""
    code_doc = await db.referral_codes.find_one({"code": (code or "").strip().upper()}, {"_id": 0})
    if not code_doc:
        return {"valid": False}
    promoter = await db.users.find_one({"id": code_doc["user_id"]}, {"_id": 0, "name": 1})
    return {"valid": True, "code": code_doc["code"], "promoter_name": (promoter or {}).get("name", "an IslandHop promoter")}


@api_router.get("/admin/promoters")
async def admin_list_promoters(request: Request, limit: int = 200):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin access required")
    promoter_ids = set()
    async for u in db.users.find({"is_promoter": True}, {"_id": 0, "id": 1}):
        promoter_ids.add(u["id"])
    async for r in db.promo_rewards.find({}, {"_id": 0, "promoter_id": 1}):
        promoter_ids.add(r["promoter_id"])
    out = []
    if promoter_ids:
        rewards = await db.promo_rewards.find({"promoter_id": {"$in": list(promoter_ids)}}, {"_id": 0}).to_list(length=None)
        by_promoter: dict = {}
        for r in rewards:
            d = by_promoter.setdefault(r["promoter_id"], {"paid": 0.0, "held": 0.0, "count": 0})
            d["count"] += 1
            d[r["status"]] = d.get(r["status"], 0) + r["amount"]
        async for u in db.users.find(
            {"id": {"$in": list(promoter_ids)}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "is_promoter": 1, "user_type": 1},
        ):
            stats = by_promoter.get(u["id"], {})
            out.append({**u, "paid": round(stats.get("paid", 0), 2), "held": round(stats.get("held", 0), 2), "onboards": stats.get("count", 0)})
    out.sort(key=lambda x: x.get("paid", 0), reverse=True)
    return {"promoters": out[:limit]}


@api_router.get("/admin/payment-mode")
async def admin_payment_mode(request: Request):
    """Admin/agent: report whether each payment rail is in LIVE or TEST/SANDBOX mode.
    Reads env only; never returns secret values."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin access required")
    stripe_key = os.environ.get("STRIPE_API_KEY", "") or ""
    if stripe_key.startswith("sk_live"):
        stripe_mode = "live"
    elif stripe_key.startswith("sk_test"):
        stripe_mode = "test"
    else:
        stripe_mode = "unconfigured"
    paypal_mode = (os.environ.get("PAYPAL_MODE", "sandbox") or "sandbox").lower()
    wipay_env = (os.environ.get("WIPAY_ENVIRONMENT", "sandbox") or "sandbox").lower()
    wipay_mode = "live" if wipay_env in ("live", "production") else "sandbox"
    twilio_mocked = (os.environ.get("MOCK_TWILIO", "false") or "false").lower() == "true"
    payment_providers = [
        {"name": "Stripe", "mode": stripe_mode, "live": stripe_mode == "live", "kind": "payment"},
        {"name": "PayPal", "mode": paypal_mode, "live": paypal_mode == "live", "kind": "payment"},
        {"name": "WiPay", "mode": wipay_mode, "live": wipay_mode == "live", "kind": "payment"},
    ]
    other_providers = [
        {"name": "Twilio SMS", "mode": "mocked" if twilio_mocked else "live", "live": not twilio_mocked, "kind": "messaging"},
    ]
    any_live = any(p["live"] for p in payment_providers)
    all_live = all(p["live"] for p in payment_providers)
    return {
        "providers": payment_providers + other_providers,
        "any_payment_live": any_live,
        "all_payment_live": all_live,
    }



@api_router.get("/admin/promo-rewards")
async def admin_list_promo_rewards(request: Request, status: Optional[str] = None, limit: int = 500):
    """Per-referral reward records for the admin Promotions view.
    Shows referred entity, type, signup date, first-order date and payout status
    ('pending_first_order' | 'held' | 'paid')."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Admin access required")
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    cap = min(limit, 2000)
    rewards = await db.promo_rewards.find(query, {"_id": 0}).sort("created_at", -1).limit(cap).to_list(length=cap)
    promoter_ids = list({r.get("promoter_id") for r in rewards if r.get("promoter_id")})
    pmap: Dict[str, Any] = {}
    if promoter_ids:
        async for u in db.users.find({"id": {"$in": promoter_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}):
            pmap[u["id"]] = u
    out = []
    for r in rewards:
        p = pmap.get(r.get("promoter_id"), {})
        out.append({
            **r,
            "referred_entity_type": r.get("referred_entity_type") or r.get("type"),
            "promoter_name": p.get("name"),
            "promoter_email": p.get("email"),
        })
    # Totals across ALL records (not just this page) for the summary cards.
    counts = {}
    for st in ("pending_first_order", "held", "paid"):
        counts[st] = await db.promo_rewards.count_documents({"status": st})
    return {"rewards": out, "counts": counts, "currency": PROMO_REWARD_CURRENCY,
            "reward_schedule": PROMO_REWARDS}



class PromoterApprove(BaseModel):
    user_id: str


@api_router.post("/admin/promoters/approve")
async def admin_approve_promoter(payload: PromoterApprove, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.users.update_one({"id": payload.user_id}, {"$set": {"is_promoter": True}})
    released = await _release_held_promo_rewards(payload.user_id)
    return {"success": True, "released_rewards": released}


@api_router.post("/admin/promoters/revoke")
async def admin_revoke_promoter(payload: PromoterApprove, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.users.update_one({"id": payload.user_id}, {"$set": {"is_promoter": False}})
    return {"success": True}


# ============================================================
# P1 FEATURE: PROOF OF DELIVERY (Driver photo at drop-off)
# ============================================================
class DeliveryProofUpload(BaseModel):
    photo_base64: str  # data URI or raw base64 string
    notes: Optional[str] = None
    recipient_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@api_router.post("/orders/{order_id}/proof")
async def upload_delivery_proof(order_id: str, payload: DeliveryProofUpload, request: Request):
    """Driver uploads proof-of-delivery photo/notes at drop-off."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can upload delivery proof")

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Optional: ensure this driver is the assigned driver
    driver_doc = await db.drivers.find_one({"user_id": current_user.id})
    driver_id = driver_doc["id"] if driver_doc else current_user.id
    if order.get("driver_id") and order.get("driver_id") not in (driver_id, current_user.id):
        raise HTTPException(status_code=403, detail="You are not the assigned driver for this order")

    photo = payload.photo_base64.strip()
    # Light sanity check on size (~ 5 MB base64 cap)
    if len(photo) > 7_000_000:
        raise HTTPException(status_code=413, detail="Proof photo too large (max ~5 MB)")
    if not photo:
        raise HTTPException(status_code=400, detail="Photo required")

    proof = {
        "photo_base64": photo,
        "notes": payload.notes,
        "recipient_name": payload.recipient_name,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "uploaded_by": current_user.id,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"delivery_proof": proof, "status": "delivered", "actual_delivery_time": proof["uploaded_at"]}},
    )
    return {"success": True, "order_id": order_id, "proof_uploaded_at": proof["uploaded_at"]}


@api_router.get("/orders/{order_id}/proof")
async def get_delivery_proof(order_id: str, request: Request):
    """Customer/driver/admin can view delivery proof for an order."""
    current_user = await get_current_user_from_request(request)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    proof = order.get("delivery_proof")
    if not proof:
        raise HTTPException(status_code=404, detail="No proof of delivery yet")

    # Authorization
    is_customer = order.get("customer_id") == current_user.id
    driver_doc = await db.drivers.find_one({"user_id": current_user.id})
    driver_id = driver_doc["id"] if driver_doc else None
    is_driver = order.get("driver_id") in (current_user.id, driver_id) if driver_id else False
    is_admin = current_user.user_type == "admin"
    if not (is_customer or is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this proof")
    return {"order_id": order_id, "proof": proof}


# ============================================================
# P1 FEATURE: SERVICE-ZONE MANAGEMENT
# ============================================================
class ServiceZone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    country: str = "Trinidad and Tobago"
    polygon: List[List[float]] = []  # list of [lat, lng] vertices
    allowed_services: List[str] = []  # food, taxi, grocery, pharmacy, courier, car_rental
    active: bool = True
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ServiceZoneCreate(BaseModel):
    name: str
    country: str = "Trinidad and Tobago"
    polygon: List[List[float]]
    allowed_services: List[str] = []
    active: bool = True
    description: Optional[str] = None


class ServiceZoneCheck(BaseModel):
    latitude: float
    longitude: float
    service: Optional[str] = None


def _point_in_polygon(lat: float, lng: float, polygon: List[List[float]]) -> bool:
    """Ray-casting point-in-polygon. Polygon is list of [lat, lng]."""
    n = len(polygon)
    if n < 3:
        return False
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = polygon[i][0], polygon[i][1]
        yj, xj = polygon[j][0], polygon[j][1]
        intersect = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


@api_router.post("/service-zones", response_model=ServiceZone)
async def create_service_zone(payload: ServiceZoneCreate, request: Request):
    """Admin: create a service zone (polygon of [lat,lng] coordinates)."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if len(payload.polygon) < 3:
        raise HTTPException(status_code=400, detail="Polygon needs at least 3 points")
    zone = ServiceZone(**payload.dict())
    await db.service_zones.insert_one(prepare_for_mongo(zone.dict()))
    return zone


@api_router.get("/service-zones", response_model=List[ServiceZone])
async def list_service_zones(active_only: bool = False):
    """List all service zones (public — needed by client to soft-block unsupported regions)."""
    query = {"active": True} if active_only else {}
    docs = await db.service_zones.find(query, {"_id": 0}).limit(500).to_list(length=500)
    return [ServiceZone(**d) for d in docs]


@api_router.put("/service-zones/{zone_id}", response_model=ServiceZone)
async def update_service_zone(zone_id: str, payload: ServiceZoneCreate, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    existing = await db.service_zones.find_one({"id": zone_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Service zone not found")
    updates = payload.dict()
    await db.service_zones.update_one({"id": zone_id}, {"$set": prepare_for_mongo(updates)})
    merged = {**existing, **updates}
    return ServiceZone(**merged)


@api_router.delete("/service-zones/{zone_id}")
async def delete_service_zone(zone_id: str, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.service_zones.delete_one({"id": zone_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service zone not found")
    return {"success": True}


@api_router.post("/service-zones/check")
async def check_service_zone(payload: ServiceZoneCheck):
    """Check if a coordinate is inside any active service zone (optionally filtered by service)."""
    zones = await db.service_zones.find({"active": True}, {"_id": 0}).limit(500).to_list(length=500)
    matches = []
    for z in zones:
        polygon = z.get("polygon") or []
        if not _point_in_polygon(payload.latitude, payload.longitude, polygon):
            continue
        if payload.service and z.get("allowed_services") and payload.service not in z["allowed_services"]:
            continue
        matches.append({"id": z["id"], "name": z["name"], "allowed_services": z.get("allowed_services", [])})
    return {
        "in_service_area": len(matches) > 0,
        "zones": matches,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "service": payload.service,
    }


# ============================================================
# P1 FEATURE: WHATSAPP SUPPORT BRIDGE (Twilio — mocked)
# ============================================================
class WhatsAppSendRequest(BaseModel):
    to: str
    body: str
    user_id: Optional[str] = None
    ticket_id: Optional[str] = None


@api_router.post("/whatsapp/send")
async def whatsapp_send(payload: WhatsAppSendRequest, request: Request):
    """Send an outbound WhatsApp message (admin/agent only)."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in {"admin", "agent"}:
        raise HTTPException(status_code=403, detail="Only support agents can send WhatsApp messages")

    to = _normalize_phone(payload.to)
    if not to or not payload.body.strip():
        raise HTTPException(status_code=400, detail="to and body are required")

    send_result = twilio_client.send_whatsapp(to, payload.body)
    if not send_result.get("success"):
        logger.warning(f"WhatsApp send failed for {to}: {send_result.get('error')}")
        raise HTTPException(status_code=400, detail=send_result.get("error", "Could not send WhatsApp message."))
    msg_doc = {
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "ticket_id": payload.ticket_id,
        "phone": to,
        "direction": "outbound",
        "body": payload.body,
        "status": send_result.get("status", "queued"),
        "twilio_sid": send_result.get("sid"),
        "sent_by": current_user.id,
        "mock": send_result.get("mock", False),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.whatsapp_messages.insert_one(msg_doc)
    msg_doc.pop("_id", None)
    return {"success": True, "message": msg_doc}


@api_router.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request):
    """Legacy inbound WhatsApp webhook path. Delegates to the canonical handler so
    there is a SINGLE source of truth (prevents duplicate/divergent processing if
    Twilio is configured to hit both /webhook/whatsapp and /webhooks/whatsapp)."""
    return await whatsapp_webhook_inbound(request)


def _verify_meta_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """Verify Meta WhatsApp Cloud API webhook signature (X-Hub-Signature-256)
    = 'sha256=' + HMAC-SHA256(raw_body, META_APP_SECRET). Returns True if valid."""
    secret = os.environ.get("META_APP_SECRET")
    if not (secret and signature_header):
        return False
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@api_router.get("/webhooks/whatsapp")
async def whatsapp_webhook_verify(request: Request):
    """Meta Cloud API webhook verification handshake (GET). Echoes hub.challenge
    when hub.verify_token matches META_WEBHOOK_VERIFY_TOKEN."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    expected = os.environ.get("META_WEBHOOK_VERIFY_TOKEN")
    if mode == "subscribe" and expected and token == expected:
        return Response(content=challenge or "", media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@api_router.post("/webhooks/whatsapp")
async def whatsapp_webhook_inbound(request: Request):
    """Inbound WhatsApp webhook. Supports Twilio (form-encoded) and Meta Cloud API (JSON).

    Security: if an X-Hub-Signature-256 header is present (Meta), the request body is
    validated against META_APP_SECRET and rejected (403) on mismatch. Requests without
    that header (e.g. Twilio) are processed as before."""
    raw_body = await request.body()
    meta_sig = request.headers.get("X-Hub-Signature-256")
    if meta_sig is not None and not _verify_meta_signature(raw_body, meta_sig):
        logger.warning("WhatsApp webhook: invalid X-Hub-Signature-256 — rejected.")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        form = dict(await request.form())
    except Exception:
        form = {}

    # Meta Cloud API delivers JSON (no form fields) — extract the first message if present.
    if not form and raw_body:
        try:
            payload = json.loads(raw_body)
            change = payload["entry"][0]["changes"][0]["value"]
            msg = (change.get("messages") or [{}])[0]
            form = {
                "From": msg.get("from", ""),
                "Body": (msg.get("text") or {}).get("body", ""),
                "MessageSid": msg.get("id"),
                "ProfileName": (((change.get("contacts") or [{}])[0]).get("profile") or {}).get("name"),
            }
        except (KeyError, IndexError, ValueError, TypeError):
            pass

    from_raw = form.get("From") or form.get("from") or ""
    body_text = form.get("Body") or form.get("body") or ""
    twilio_sid = form.get("MessageSid") or form.get("SmsMessageSid") or form.get("sid")
    profile_name = form.get("ProfileName")
    phone = _normalize_phone(str(from_raw).replace("whatsapp:", ""))

    if phone:
        # Idempotency: Twilio (or a double-registered webhook) may deliver the same
        # inbound message more than once. Dedupe on MessageSid so a single incoming
        # message is only ever recorded/processed ONCE.
        if twilio_sid:
            existing = await db.whatsapp_messages.find_one(
                {"twilio_sid": twilio_sid, "direction": "inbound"}, {"_id": 1}
            )
            if existing:
                logger.info(f"Duplicate inbound WhatsApp {twilio_sid} ignored (idempotent).")
                return Response(
                    content="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>",
                    media_type="application/xml",
                )

        user = await db.users.find_one({"phone": phone}, {"_id": 0})
        await db.whatsapp_messages.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"] if user else None,
            "phone": phone,
            "profile_name": profile_name,
            "direction": "inbound",
            "body": body_text,
            "status": "received",
            "twilio_sid": twilio_sid,
            "num_media": form.get("NumMedia"),
            "signature_verified": meta_sig is not None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Inbound WhatsApp from {phone}: {body_text[:120]}")

    return Response(content="<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>",
                    media_type="application/xml")


@api_router.post("/webhooks/twilio-status")
async def twilio_status_callback(request: Request):
    """Delivery status callback for Twilio messages (SMS + WhatsApp).
    Updates the matching whatsapp_messages row with the latest delivery status."""
    try:
        form = dict(await request.form())
    except Exception:
        form = {}

    message_sid = form.get("MessageSid") or form.get("SmsSid")
    message_status = form.get("MessageStatus") or form.get("SmsStatus")
    error_code = form.get("ErrorCode")

    if message_sid:
        await db.whatsapp_messages.update_one(
            {"twilio_sid": message_sid},
            {"$set": {"status": message_status, "error_code": error_code,
                      "status_updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        await db.twilio_status_events.insert_one({
            "id": str(uuid.uuid4()),
            "message_sid": message_sid,
            "status": message_status,
            "error_code": error_code,
            "raw": form,
            "received_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Twilio status callback: {message_sid} → {message_status}"
                    + (f" (error {error_code})" if error_code else ""))

    return Response(content="", media_type="text/plain")




@api_router.get("/whatsapp/messages")
async def list_whatsapp_messages(request: Request, phone: Optional[str] = None, limit: int = 100):
    """Admin/agent: list WhatsApp messages, optionally filtered by phone."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in {"admin", "agent"}:
        raise HTTPException(status_code=403, detail="Admin/agent only")
    query = {}
    if phone:
        query["phone"] = _normalize_phone(phone)
    msgs = await db.whatsapp_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=None)
    return msgs


@api_router.get("/whatsapp/conversations")
async def list_whatsapp_conversations(request: Request):
    """Group messages by phone; show last message + count per conversation."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type not in {"admin", "agent"}:
        raise HTTPException(status_code=403, detail="Admin/agent only")
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$phone",
            "last_message": {"$first": "$body"},
            "last_direction": {"$first": "$direction"},
            "last_at": {"$first": "$created_at"},
            "user_id": {"$first": "$user_id"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"last_at": -1}},
        {"$project": {"_id": 0, "phone": "$_id", "last_message": 1, "last_direction": 1, "last_at": 1, "user_id": 1, "count": 1}},
    ]
    convos = await db.whatsapp_messages.aggregate(pipeline).to_list(length=None)
    return convos


# ============================================================
# P1 FEATURE: DRIVER / MERCHANT APPROVAL UI (Admin Panel)
# ============================================================
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


# ---------------------------------------------------------------------------
# Admin: Test-data cleanup (soft launch). Removes seeded/sample + test-pattern
# data while preserving real applicants and a keep-list. Dry-run preview first,
# then an explicit confirm to execute. Admin-only, irreversible.
# ---------------------------------------------------------------------------
CLEANUP_KEEP_RESTAURANT_NAMES = {"caribbean spice kitchen"}
_CLEANUP_SEED_RESTAURANTS = {"island spice kitchen", "tropical grill", "beach bites cafe"}
_CLEANUP_TEST_RE = re.compile(
    r"(test|sub pizza|slice pizza|chat pizza|e2e|\bqa\b|qa[_ ]|\bdemo\b|sample|"
    r"tier hut|ui eatery|ui merch|ad spice kitchen|featured_iter|jerk hut|"
    r"\bfe diner\b|\bi14|diner\s*\d|\d{8,}|@example\.com|\+test|noreply\+)",
    re.I,
)
_CLEANUP_PROTECTED_USER_TYPES = {"admin", "staff", "owner"}


def _cleanup_is_test(*values) -> bool:
    for v in values:
        if v and _CLEANUP_TEST_RE.search(str(v)):
            return True
    return False


def _cleanup_restaurant_should_delete(doc: dict) -> bool:
    name = str(doc.get("name") or "").strip().lower()
    if name in CLEANUP_KEEP_RESTAURANT_NAMES:
        return False
    if name in _CLEANUP_SEED_RESTAURANTS:
        return True
    return _cleanup_is_test(doc.get("name"))


async def _build_cleanup_plan(requesting_user_id: str) -> dict:
    """Return {collection: {ids, labels, ...}} describing exactly what would be deleted."""
    plan = {}
    keep_owner_ids = set()

    del_rest_ids, rest_labels = [], []
    async for r in db.restaurants.find({}, {"_id": 0, "id": 1, "name": 1, "user_id": 1}):
        if _cleanup_restaurant_should_delete(r):
            del_rest_ids.append(r.get("id")); rest_labels.append(r.get("name"))
        elif r.get("user_id"):
            keep_owner_ids.add(r.get("user_id"))
    plan["restaurants"] = {"ids": del_rest_ids, "labels": rest_labels}

    del_biz_ids, biz_labels = [], []
    async for b in db.businesses.find({}, {"_id": 0, "id": 1, "business_name": 1, "name": 1, "user_id": 1}):
        nm = b.get("business_name") or b.get("name")
        if _cleanup_is_test(nm):
            del_biz_ids.append(b.get("id")); biz_labels.append(nm)
        elif b.get("user_id"):
            keep_owner_ids.add(b.get("user_id"))
    plan["businesses"] = {"ids": del_biz_ids, "labels": biz_labels}

    del_cr_ids, cr_labels = [], []
    async for cr in db.car_rental_companies.find({}, {"_id": 0, "id": 1, "name": 1, "company_name": 1, "user_id": 1}):
        nm = cr.get("company_name") or cr.get("name")
        if _cleanup_is_test(nm):
            del_cr_ids.append(cr.get("id")); cr_labels.append(nm)
        elif cr.get("user_id"):
            keep_owner_ids.add(cr.get("user_id"))
    plan["car_rental_companies"] = {"ids": del_cr_ids, "labels": cr_labels}

    del_driver_ids, del_driver_user_ids, drv_labels = [], [], []
    async for d in db.drivers.find({}, {"_id": 0, "id": 1, "user_id": 1, "personal_info": 1, "license_number": 1}):
        pi = d.get("personal_info") or {}
        if _cleanup_is_test(pi.get("name"), pi.get("email"), d.get("license_number")):
            del_driver_ids.append(d.get("id"))
            if d.get("user_id"):
                del_driver_user_ids.append(d.get("user_id"))
            drv_labels.append(pi.get("name") or d.get("id"))
    plan["drivers"] = {"ids": del_driver_ids, "labels": drv_labels, "user_ids": del_driver_user_ids}

    del_app_ids, app_labels = [], []
    async for a in db.business_applications.find({}, {"_id": 0, "id": 1, "business_name": 1, "email": 1, "business_owner": 1}):
        owner = a.get("business_owner") or {}
        if _cleanup_is_test(a.get("business_name"), a.get("email"), owner.get("name"), owner.get("email")):
            del_app_ids.append(a.get("id")); app_labels.append(a.get("business_name") or a.get("email"))
    plan["business_applications"] = {"ids": del_app_ids, "labels": app_labels}

    del_user_ids, user_labels = [], []
    async for u in db.users.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1, "user_type": 1}):
        uid = u.get("id")
        if not uid or uid == requesting_user_id:
            continue
        if (u.get("user_type") or "").lower() in _CLEANUP_PROTECTED_USER_TYPES:
            continue
        if uid in keep_owner_ids:
            continue
        if _cleanup_is_test(u.get("name"), u.get("email")):
            del_user_ids.append(uid); user_labels.append(u.get("email") or u.get("name"))
    plan["users"] = {"ids": del_user_ids, "labels": user_labels}

    deleted_vendor_ids = set(del_rest_ids) | set(del_biz_ids) | set(del_cr_ids)
    deleted_user_ids_all = set(del_user_ids) | set(del_driver_user_ids)
    del_order_ids = []
    async for o in db.orders.find({}, {"_id": 0, "id": 1, "restaurant_id": 1, "vendor_id": 1, "customer_id": 1, "customer_phone": 1, "notes": 1}):
        if (o.get("restaurant_id") in deleted_vendor_ids or o.get("vendor_id") in deleted_vendor_ids
                or o.get("customer_id") in deleted_user_ids_all
                or _cleanup_is_test(o.get("customer_phone"), o.get("notes"))):
            del_order_ids.append(o.get("id"))
    plan["orders"] = {"ids": del_order_ids, "labels": []}

    return plan


def _cleanup_summary(plan: dict) -> dict:
    return {
        coll: {
            "count": len(data.get("ids") or []),
            "sample": (data.get("labels") or [])[:40],
        }
        for coll, data in plan.items()
    }


@api_router.get("/admin/cleanup/preview")
async def admin_cleanup_preview(request: Request):
    """Dry-run: report exactly what the test-data cleanup WOULD delete. No changes made."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    plan = await _build_cleanup_plan(current_user.id)
    summary = _cleanup_summary(plan)
    total = sum(v["count"] for v in summary.values())
    return {"total": total, "keep_restaurant": sorted(CLEANUP_KEEP_RESTAURANT_NAMES), "summary": summary}


@api_router.post("/admin/cleanup/execute")
async def admin_cleanup_execute(request: Request):
    """Permanently delete the test data identified by the preview. Requires
    body {"confirm": "DELETE"}. Preserves real applicants + the keep-list."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if (body or {}).get("confirm") != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmation required: send {\"confirm\": \"DELETE\"}")

    plan = await _build_cleanup_plan(current_user.id)
    deleted = {}
    for coll, data in plan.items():
        ids = data.get("ids") or []
        deleted[coll] = (await db[coll].delete_many({"id": {"$in": ids}})).deleted_count if ids else 0

    # Best-effort cascade of dependent records for deleted drivers/users.
    driver_ids = plan.get("drivers", {}).get("ids") or []
    driver_user_ids = plan.get("drivers", {}).get("user_ids") or []
    user_ids = plan.get("users", {}).get("ids") or []
    if driver_ids:
        await db.driver_wallets.delete_many({"driver_id": {"$in": driver_ids}})
    all_affected_users = list(set(user_ids) | set(driver_user_ids))
    if all_affected_users:
        for coll in ("user_subscriptions", "driver_subscriptions", "wallets"):
            try:
                await db[coll].delete_many({"user_id": {"$in": all_affected_users}})
            except Exception:
                pass

    logging.info(f"Admin {current_user.email} ran test-data cleanup: {deleted}")
    return {"success": True, "deleted": deleted, "total": sum(deleted.values())}



@api_router.get("/admin/applicants")
async def admin_list_applicants(request: Request):
    """Admin-only: full detail of pending Driver + Merchant applications, incl. uploaded files."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    drivers = []
    async for d in db.drivers.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).limit(500):
        pi = d.get("personal_info") or {}
        docs = []
        if d.get("user_id"):
            async for doc in db.driver_documents.find(
                {"user_id": d["user_id"], "is_deleted": False},
                {"_id": 0, "id": 1, "doc_type": 1, "original_filename": 1},
            ):
                docs.append({"document_id": doc["id"], "doc_type": doc.get("doc_type"), "filename": doc.get("original_filename")})
        drivers.append({
            "id": d.get("id"), "user_id": d.get("user_id"),
            "name": d.get("name") or pi.get("name"),
            "email": d.get("email") or pi.get("email"),
            "phone": d.get("phone") or pi.get("phone"),
            "city": d.get("city") or pi.get("city"),
            "vehicle_type": d.get("vehicle_type"), "vehicle_plate": d.get("vehicle_plate"),
            "license_number": d.get("license_number"),
            "source": d.get("source"), "is_external_lead": bool(d.get("is_external_lead")),
            "created_at": d.get("created_at"), "documents": docs,
        })

    merchants = []
    async for b in db.business_applications.find({"verification_status": "pending"}, {"_id": 0}).sort("created_at", -1).limit(500):
        bd = b.get("business_details") or {}
        bo = b.get("business_owner") or {}
        raw_docs = b.get("documents") or bd.get("documents") or {}
        docs = []
        if isinstance(raw_docs, dict):
            for k, v in raw_docs.items():
                if v:
                    docs.append({"label": k, "url": v})
        elif isinstance(raw_docs, list):
            for it in raw_docs:
                docs.append(it if isinstance(it, dict) else {"label": "document", "url": it})
        merchants.append({
            "id": b.get("id"), "user_id": b.get("user_id"),
            "business_name": b.get("business_name") or bd.get("business_name"),
            "owner_name": bo.get("name"),
            "email": b.get("email") or bo.get("email"),
            "phone": b.get("phone") or bo.get("phone"),
            "business_type": bd.get("business_type"),
            "address": bd.get("address") or bo.get("address"),
            "description": bd.get("description"), "website": bd.get("website"),
            "source": b.get("source"), "is_external_lead": bool(b.get("is_external_lead")),
            "created_at": b.get("created_at") or b.get("application_date"), "documents": docs,
        })

    return {"drivers": drivers, "merchants": merchants,
            "counts": {"drivers": len(drivers), "merchants": len(merchants)}}


@api_router.post("/admin/impersonate/{user_id}")
async def admin_impersonate(user_id: str, request: Request):
    """Admin-only: mint a short-lived token so the admin can view a user's own portal.
    Refuses to impersonate other admins; audit-logged."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "user_type": 1})
    if not target:
        raise HTTPException(status_code=404, detail="This applicant has no user account yet (external lead) — nothing to view.")
    if (target.get("user_type") or "").lower() == "admin":
        raise HTTPException(status_code=403, detail="Cannot impersonate another admin")
    token = create_access_token(
        {"sub": user_id, "impersonated_by": current_user.id},
        expires_delta=timedelta(minutes=30),
    )
    await db.impersonation_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": current_user.id, "admin_email": current_user.email,
        "target_user_id": user_id, "target_email": target.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    logging.info(f"Admin {current_user.email} started viewing portal of {target.get('email')}")
    return {"token": token, "user": target, "expires_in_minutes": 30}


# ============================================================
# ADMIN "APPROVALS" — full records by category + order history
# ============================================================
_RECORD_CATEGORIES = {
    "restaurants": {"collection": "restaurants", "status_field": "status"},
    "drivers": {"collection": "drivers", "status_field": "status"},
    "car_rentals": {"collection": "car_rental_companies", "status_field": "status"},
    "businesses": {"collection": "business_applications", "status_field": "verification_status"},
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


@api_router.get("/admin/records/{category}")
async def admin_list_records(category: str, request: Request, q: Optional[str] = None, limit: int = 500):
    """Admin: all records of a category (any status) with full submitted data.
    category ∈ restaurants | drivers | car_rentals | businesses | users."""
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
            "users": ["name", "email", "phone"],
        }[category]
        query = {"$or": [{f: rx} for f in fields]}
    cap = min(limit, 2000)
    records = []
    async for doc in coll.find(query, {"_id": 0}).sort("created_at", -1).limit(cap):
        rec = _record_summary(doc, category)
        rec["full"] = _clean_full(doc, category)
        records.append(rec)
    return {"category": category, "count": len(records), "records": records}


@api_router.get("/admin/records/{category}/{record_id}/orders")
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
        "users": {"customer_id": record_id},
    }[category]
    orders = await db.orders.find(order_query, {"_id": 0}).sort("created_at", -1).limit(cap).to_list(length=cap)
    return {"type": "order", "count": len(orders), "orders": orders}




@api_router.get("/admin/pending-approvals")
async def admin_pending_approvals(request: Request):
    """Aggregate pending drivers, restaurants, car rentals, and business onboarding applications."""
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    drivers = await db.drivers.find({"status": {"$in": ["pending", "pending_approval"]}}).to_list(length=None)
    restaurants = await db.restaurants.find({"status": {"$in": ["pending", "pending_approval"]}}).to_list(length=None)
    rentals = await db.car_rental_companies.find({"status": {"$in": ["pending", "pending_approval"]}}).to_list(length=None)
    businesses = await db.business_applications.find({"verification_status": "pending"}).to_list(length=None)

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


@api_router.post("/admin/drivers/{driver_id}/approve")
async def admin_approve_driver(driver_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("drivers", driver_id, "active", current_user.id, payload.notes)
    # Promote the user to a driver now that identity has been reviewed & approved.
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "user_id": 1})
    if driver and driver.get("user_id"):
        await db.users.update_one({"id": driver["user_id"]}, {"$set": {"user_type": "driver"}})
        await _notify_driver_status(driver["user_id"], "approved")
        await _award_promo_reward(driver["user_id"], "driver", "driver_approved", require_first_order=True)
        await _release_held_promo_rewards(driver["user_id"])
    return result


@api_router.post("/admin/drivers/{driver_id}/reject")
async def admin_reject_driver(driver_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("drivers", driver_id, "rejected", current_user.id, payload.notes)
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "user_id": 1})
    if driver and driver.get("user_id"):
        await _notify_driver_status(driver["user_id"], "rejected", payload.notes)
    return result


@api_router.post("/admin/restaurants/{restaurant_id}/approve")
async def admin_approve_restaurant(restaurant_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("restaurants", restaurant_id, "active", current_user.id, payload.notes)


@api_router.post("/admin/restaurants/{restaurant_id}/reject")
async def admin_reject_restaurant(restaurant_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("restaurants", restaurant_id, "rejected", current_user.id, payload.notes)


@api_router.post("/admin/car-rentals/{company_id}/approve")
async def admin_approve_rental(company_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("car_rental_companies", company_id, "active", current_user.id, payload.notes)


@api_router.post("/admin/car-rentals/{company_id}/reject")
async def admin_reject_rental(company_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _set_partner_status("car_rental_companies", company_id, "rejected", current_user.id, payload.notes)


@api_router.post("/admin/businesses/{application_id}/approve")
async def admin_approve_business(application_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("business_applications", application_id, "verified", current_user.id, payload.notes, status_field="verification_status")
    await _notify_merchant_status(application_id, "verified", payload.notes)
    app_doc = await db.business_applications.find_one({"id": application_id}, {"_id": 0})
    if app_doc and app_doc.get("user_id"):
        btype = str((app_doc.get("business_details", {}) or {}).get("business_type", "") or app_doc.get("business_type", "")).lower()
        rtype = "supplier" if "supplier" in btype else "merchant"
        await _award_promo_reward(app_doc["user_id"], rtype, "business_approved", require_first_order=True)
        await _release_held_promo_rewards(app_doc["user_id"])
    return result


@api_router.post("/admin/businesses/{application_id}/reject")
async def admin_reject_business(application_id: str, payload: ApprovalAction, request: Request):
    current_user = await get_current_user_from_request(request)
    if current_user.user_type != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await _set_partner_status("business_applications", application_id, "rejected", current_user.id, payload.notes, status_field="verification_status")
    await _notify_merchant_status(application_id, "rejected", payload.notes)
    return result


async def _notify_merchant_status(application_id: str, decision: str, notes: Optional[str] = None):
    """WhatsApp-first notification to a merchant on an application decision. Never raises."""
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


# ---------------------------------------------------------------------------
# PUBLIC application intake (from external marketing site islandhoptt.com)
# Unauthenticated; protected by rate-limit + honeypot + optional X-API-Key.
# Leads land in the SAME collections as in-app applications (status=pending),
# so they appear in Admin → Pending Approvals, tagged with source.
# ---------------------------------------------------------------------------
PUBLIC_APP_RATE_LIMIT = 5
PUBLIC_APP_RATE_WINDOW_MIN = 60


class PublicDriverApplication(BaseModel):
    full_name: str
    email: str
    phone: str
    vehicle_type: str
    license_number: Optional[str] = None
    vehicle_plate: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    hp: Optional[str] = ""  # honeypot — must stay empty


class PublicMerchantApplication(BaseModel):
    business_name: str
    owner_name: str
    email: str
    phone: str
    business_type: str
    category: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    hp: Optional[str] = ""  # honeypot — must stay empty


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _check_public_app_guard(request: Request) -> str:
    """Optional API key + per-IP rate limiting. Returns the client IP."""
    configured_key = os.environ.get("PUBLIC_APPLICATIONS_API_KEY")
    provided = request.headers.get("x-api-key")
    if provided and configured_key and provided != configured_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    ip = _client_ip(request)
    since = (datetime.now(timezone.utc) - timedelta(minutes=PUBLIC_APP_RATE_WINDOW_MIN)).isoformat()
    recent = await db.public_application_log.count_documents({"ip": ip, "created_at": {"$gte": since}})
    if recent >= PUBLIC_APP_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many applications from this network. Please try again later.")
    return ip


async def _log_public_app(ip: str, kind: str):
    await db.public_application_log.insert_one({
        "ip": ip, "kind": kind, "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def _notify_new_application(kind: str, doc: dict):
    """Email an internal alert (to the correct team mailbox) + an acknowledgement to
    the applicant when an application lands. Never raises — best effort.
    Driver apps route via drivers@; merchant/partner apps via partners@."""
    if kind == "driver":
        inbox = graph_mail.notify_mailbox("driver")   # drivers@islandhoptt.com
        label = "driver"
        summary = (
            f"<li><b>Name:</b> {doc.get('name','')}</li>"
            f"<li><b>Email:</b> {doc.get('email','')}</li>"
            f"<li><b>Phone:</b> {doc.get('phone','')}</li>"
            f"<li><b>Vehicle:</b> {doc.get('vehicle_type','')}</li>"
            f"<li><b>City:</b> {doc.get('city','') or '—'}</li>"
        )
    else:
        inbox = graph_mail.notify_mailbox("merchant")  # partners@islandhoptt.com
        label = "merchant"
        summary = (
            f"<li><b>Business:</b> {doc.get('business_name','')}</li>"
            f"<li><b>Owner:</b> {doc.get('business_owner',{}).get('name','')}</li>"
            f"<li><b>Email:</b> {doc.get('email','')}</li>"
            f"<li><b>Phone:</b> {doc.get('phone','')}</li>"
            f"<li><b>Type:</b> {doc.get('business_details',{}).get('business_type','')}</li>"
        )

    internal_html = (
        f"<h2>New {label} application from {doc.get('source','the website')}</h2>"
        f"<p>A new {label} lead just came in. Review it in Admin → Approvals.</p>"
        f"<ul>{summary}</ul>"
        f"<p style='color:#888'>Application ID: {doc.get('id')}</p>"
    )
    ack_html = (
        f"<h2>Thanks for applying to IslandHop 🌴</h2>"
        f"<p>We've received your {label} application and our team will review it shortly. "
        f"You'll hear from us at <b>{doc.get('email','')}</b>.</p>"
        f"<p>— The IslandHop Team</p>"
    )

    # Internal alert → sent FROM and TO the correct team inbox (drivers@ / partners@).
    try:
        await graph_mail.send_mail(
            inbox,
            f"New {label} application — {doc.get('name') or doc.get('business_name','')}",
            internal_html, mailbox=inbox)
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"New-application internal alert email failed ({kind}): {exc}")
    # Acknowledgement to the applicant, sent FROM the team inbox so replies route correctly.
    try:
        if doc.get("email"):
            await graph_mail.send_mail(doc["email"], "We received your IslandHop application",
                                       ack_html, mailbox=inbox)
    except Exception as exc:  # noqa: BLE001
        logging.warning(f"New-application ack email failed ({kind}): {exc}")

    # WhatsApp-first alert to the ops/admin team (mentions which mailbox handled it).
    admin_phone = os.environ.get("ADMIN_NOTIFY_PHONE")
    if admin_phone:
        who = doc.get("name") or doc.get("business_name", "")
        await _wa_notify(
            admin_phone,
            f"🌐 New {label} application: {who} ({doc.get('phone','')}). "
            f"📧 Email routed to {inbox}. Review it in Admin → Approvals.",
            event=f"new_{label}_application",
        )


@api_router.post("/public/applications/driver")
async def public_driver_application(payload: PublicDriverApplication, request: Request):
    """Receive a driver application from the external site (islandhoptt.com)."""
    ip = await _check_public_app_guard(request)
    if payload.hp:  # bot tripped the honeypot — pretend success, store nothing
        return {"success": True, "message": "Application received."}
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": None,
        "status": "pending",
        "source": "islandhoptt.com",
        "is_external_lead": True,
        "name": payload.full_name,
        "email": payload.email,
        "phone": payload.phone,
        "vehicle_type": payload.vehicle_type,
        "license_number": payload.license_number,
        "vehicle_plate": payload.vehicle_plate,
        "city": payload.city,
        "lead_notes": payload.notes,
        "created_at": now,
    }
    await db.drivers.insert_one({**doc})
    await _log_public_app(ip, "driver")
    asyncio.create_task(_notify_new_application("driver", doc))
    return {"success": True, "id": doc["id"], "message": "Driver application received — our team will review it shortly."}


@api_router.post("/public/applications/merchant")
async def public_merchant_application(payload: PublicMerchantApplication, request: Request):
    """Receive a merchant/restaurant application from the external site (islandhoptt.com)."""
    ip = await _check_public_app_guard(request)
    if payload.hp:  # honeypot
        return {"success": True, "message": "Application received."}
    now = datetime.now(timezone.utc).isoformat()
    address_obj = {"line1": payload.address or "", "city": payload.city or ""}
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": None,
        "verification_status": "pending",
        "source": "islandhoptt.com",
        "is_external_lead": True,
        # top-level fields for admin list display
        "business_name": payload.business_name,
        "name": payload.business_name,
        "email": payload.email,
        "phone": payload.phone,
        # nested structures matching BusinessOnboarding shape
        "business_owner": {
            "name": payload.owner_name,
            "email": payload.email,
            "phone": payload.phone,
            "address": address_obj,
        },
        "business_details": {
            "business_name": payload.business_name,
            "business_type": payload.business_type,
            "category_id": payload.category or "",
            "description": payload.description or "",
            "address": address_obj,
            "phone": payload.phone,
            "email": payload.email,
            "website": payload.website,
        },
        "lead_notes": payload.notes,
        "application_date": now,
        "created_at": now,
    }
    await db.business_applications.insert_one({**doc})
    await _log_public_app(ip, "merchant")
    asyncio.create_task(_notify_new_application("merchant", doc))
    return {"success": True, "id": doc["id"], "message": "Merchant application received — our team will review it shortly."}




# Initialize data on startup
@app.on_event("startup")
async def initialize_data():
    """Initialize default data and indexes"""
    # Phase B: Schedule nightly vendor payouts at 02:00 UTC
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        if not hasattr(app.state, "scheduler") or app.state.scheduler is None:
            scheduler = AsyncIOScheduler(timezone="UTC")

            async def _nightly_payouts():
                try:
                    await process_daily_vendor_payouts()
                    logger.info("✅ Nightly vendor payout batch completed")
                except Exception as e:
                    logger.error(f"❌ Nightly vendor payout failed: {e}")

            scheduler.add_job(_nightly_payouts, CronTrigger(hour=2, minute=0), id="nightly_vendor_payouts", replace_existing=True)

            async def _weekly_top_drivers():
                try:
                    n = await award_weekly_top_driver_bonus()
                    logger.info(f"✅ Weekly top-driver bonus job awarded {n} drivers")
                except Exception as e:
                    logger.error(f"❌ Weekly top-driver bonus failed: {e}")

            scheduler.add_job(_weekly_top_drivers, CronTrigger(day_of_week="mon", hour=3, minute=0), id="weekly_top_driver_bonus", replace_existing=True)

            from apscheduler.triggers.interval import IntervalTrigger

            async def _poll_mail_autoreply():
                try:
                    n = await process_inbound_mail_autoreply()
                    if n:
                        logger.info(f"✉️ Auto-replied to {n} new client email(s)")
                except Exception as e:
                    logger.error(f"❌ Mail auto-reply poll failed: {e}")

            # Background polling is gated by env so only ONE environment (production)
            # auto-replies to the shared mailboxes. Manual "Run now" works everywhere.
            if (os.environ.get("MAIL_AUTOREPLY_POLL_ENABLED", "false").lower() == "true"):
                scheduler.add_job(_poll_mail_autoreply, IntervalTrigger(minutes=2), id="mail_autoreply_poll", replace_existing=True)
                print("✅ Mail auto-reply background poller enabled (every 2 min)")
            scheduler.start()
            app.state.scheduler = scheduler
            print("✅ APScheduler started — nightly vendor payouts scheduled at 02:00 UTC")
    except Exception as e:
        print(f"⚠️ Could not start scheduler: {e}")

    try:
        await asyncio.to_thread(storage_client.init_storage)
        print("✅ Object storage initialized")
    except Exception as e:
        print(f"⚠️ Could not initialize object storage: {e}")

    try:
        await seed_owner_admin()
    except Exception as e:
        print(f"⚠️ Could not seed owner admin: {e}")

    try:
        # Create geospatial index for driver locations (for smart matching)
        await db.drivers.create_index([("current_location", "2dsphere")])
        print("✅ Created geospatial index for driver locations")
        
        # Create TTL index for driver location history (auto-delete after 1 hour)
        await db.driver_locations.create_index("timestamp", expireAfterSeconds=3600)
        print("✅ Created TTL index for driver location history")

        # Performance indexes for high-traffic collections (idempotent; Mongo skips existing).
        # The app uses a logical string `id` field as the primary key plus several FK/filter fields.
        perf_indexes = {
            "users": [[("email", 1)], [("id", 1)], [("user_type", 1)], [("session_token", 1)]],
            "orders": [
                [("id", 1)], [("customer_id", 1)], [("driver_id", 1)], [("restaurant_id", 1)],
                [("vendor_id", 1)], [("status", 1)], [("service_type", 1)], [("payment_status", 1)],
                [("created_at", -1)], [("customer_id", 1), ("created_at", -1)],
                [("status", 1), ("created_at", -1)],
            ],
            "drivers": [[("id", 1)], [("user_id", 1)], [("status", 1)]],
            "restaurants": [[("id", 1)], [("user_id", 1)], [("status", 1)]],
            "businesses": [[("id", 1)], [("user_id", 1)], [("verification_status", 1)]],
            "business_applications": [[("id", 1)], [("user_id", 1)], [("verification_status", 1)]],
            "car_rental_companies": [[("id", 1)], [("user_id", 1)]],
            "menu_items": [[("restaurant_id", 1)], [("id", 1)]],
            "ratings": [[("order_id", 1)], [("vendor_id", 1)], [("driver_id", 1)]],
            "merchant_reviews": [[("merchant_id", 1)], [("customer_id", 1)]],
            "addresses": [[("user_id", 1)]],
            "support_tickets": [[("user_id", 1)], [("status", 1)], [("assigned_to", 1)], [("created_at", -1)]],
            "ticket_messages": [[("ticket_id", 1)]],
            "order_chat_messages": [[("order_id", 1)], [("created_at", 1)]],
            "substitution_proposals": [[("order_id", 1)]],
            "whatsapp_messages": [[("MessageSid", 1)], [("direction", 1)], [("created_at", -1)]],
            "notifications": [[("user_id", 1)], [("read", 1)]],
            "wallets": [[("user_id", 1)]],
            "wallet_transactions": [[("user_id", 1)], [("order_id", 1)], [("created_at", -1)]],
            "driver_wallets": [[("driver_id", 1)]],
            "driver_withdrawals": [[("driver_id", 1)]],
            "driver_incentives": [[("driver_id", 1)], [("month", 1)]],
            "fraud_flags": [[("status", 1)], [("order_id", 1)], [("created_at", -1)]],
            "promo_codes": [[("code", 1)]],
            "promo_rewards": [[("user_id", 1)]],
            "referral_codes": [[("user_id", 1)], [("code", 1)]],
            "referrals": [[("referrer_id", 1)], [("referred_user_id", 1)]],
            "scheduled_orders": [[("user_id", 1)], [("scheduled_datetime", 1)]],
            "recurring_orders": [[("user_id", 1)], [("next_occurrence", 1)]],
            "rental_bookings": [[("customer_id", 1)], [("rental_company_id", 1)]],
            "vendor_stripe_accounts": [[("vendor_id", 1)]],
            "vendor_payouts": [[("vendor_id", 1)]],
            "payment_transactions": [[("session_id", 1)], [("user_id", 1)]],
            "paypal_orders": [[("order_id", 1)]],
            "otp_codes": [[("phone", 1)], [("created_at", -1)]],
            "push_subscriptions": [[("user_id", 1)]],
            "money_requests": [[("requester_id", 1)], [("payer_id", 1)]],
            "mail_tickets": [[("message_id", 1)], [("conversation_id", 1)]],
            "admin_invites": [[("token", 1)]],
            "user_subscriptions": [[("user_id", 1)], [("status", 1)], [("user_id", 1), ("status", 1), ("plan_tier", 1)]],
            "service_zones": [[("active", 1)]],
            "driver_documents": [[("id", 1)], [("driver_user_id", 1)]],
            "public_application_log": [[("ip", 1)], [("created_at", -1)]],
            "merchant_storefronts": [[("vendor_id", 1)]],
            "merchant_coupons": [[("vendor_id", 1)], [("vendor_id", 1), ("code", 1)]],
            "merchant_coupon_usage": [[("coupon_id", 1), ("order_id", 1)]],
            "merchant_ads": [[("placement", 1), ("status", 1)], [("vendor_id", 1)]],
        }
        idx_count = 0
        for coll, keys_list in perf_indexes.items():
            for keys in keys_list:
                try:
                    await db[coll].create_index(keys, background=True)
                    idx_count += 1
                except Exception as ie:
                    print(f"⚠️ index {coll} {keys} skipped: {ie}")
        print(f"✅ Ensured {idx_count} performance indexes across {len(perf_indexes)} collections")

        
        # Check if business categories exist
        existing_categories = await db.business_categories.count_documents({})
        
        if existing_categories == 0:
            # Create default business categories
            default_categories = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Restaurant",
                    "description": "Food delivery services",
                    "commission_rate": 15.0,
                    "requirements": ["Food handler's license", "Business registration", "Insurance"]
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Pharmacy",
                    "description": "Prescription and health product delivery",
                    "commission_rate": 8.0,
                    "requirements": ["Pharmacy license", "Controlled substances permit", "Insurance"]
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Grocery Store",
                    "description": "Grocery and household items delivery",
                    "commission_rate": 12.0,
                    "requirements": ["Business registration", "Food safety certification", "Insurance"]
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "General Business",
                    "description": "Other business types requiring delivery services",
                    "commission_rate": 20.0,
                    "requirements": ["Business registration", "Insurance", "Product compliance certificates"]
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Car Rental",
                    "description": "Vehicle rental services including airport pickups",
                    "commission_rate": 10.0,
                    "requirements": ["Business license", "Fleet insurance", "Commercial vehicle registration", "Driver verification system"]
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Business Supplier",
                    "description": "Any business needing delivery services - retail, grocery, specialty stores",
                    "commission_rate": 15.0,
                    "requirements": ["Business license", "Tax ID/EIN", "Proof of address", "Insurance", "Product compliance"]
                }
            ]
            
            await db.business_categories.insert_many(default_categories)
        
        # Check if pricing tiers exist
        existing_tiers = await db.pricing_tiers.count_documents({})
        
        if existing_tiers == 0:
            # Create default pricing tiers
            default_tiers = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Starter",
                    "business_type": "all",
                    "commission_rate": 20.0,
                    "monthly_fee": 0.0,
                    "transaction_fee": 2.5,
                    "features": ["Basic delivery tracking", "Standard support", "Mobile app access"],
                    "is_premium": False
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Professional",
                    "business_type": "all", 
                    "commission_rate": 15.0,
                    "monthly_fee": 49.99,
                    "transaction_fee": 1.8,
                    "features": ["Advanced analytics", "Priority support", "Custom branding", "API access"],
                    "is_premium": True
                },
                {
                    "id": str(uuid.uuid4()),
                    "name": "Enterprise",
                    "business_type": "all",
                    "commission_rate": 10.0,
                    "monthly_fee": 199.99,
                    "transaction_fee": 1.2,
                    "features": ["Dedicated account manager", "Custom integrations", "White-label options", "Advanced reporting"],
                    "is_premium": True
                }
            ]
            
            await db.pricing_tiers.insert_many(default_tiers)
        
        # Initialize sample restaurants (gated — never re-seed on production).
        existing_restaurants = await db.restaurants.count_documents({})
        if existing_restaurants == 0 and os.environ.get("SEED_SAMPLE_DATA", "false").lower() == "true":
            sample_restaurants = [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": "sample_user_1",
                    "name": "Caribbean Spice Kitchen",
                    "description": "Authentic Caribbean cuisine with fresh local ingredients",
                    "cuisine_type": "Caribbean",
                    "address": {
                        "street": "123 Bay Street",
                        "city": "Kingston",
                        "parish": "St. Andrew",
                        "country": "Jamaica"
                    },
                    "phone": "+1-876-555-0123",
                    "email": "info@caribbeanspice.com",
                    "status": "active",
                    "rating": 4.5,
                    "delivery_fee": 5.0,
                    "minimum_order": 15.0,
                    "estimated_delivery_time": 30,
                    "menu_items": [
                        {
                            "id": str(uuid.uuid4()),
                            "name": "Jerk Chicken",
                            "description": "Spicy marinated chicken grilled to perfection",
                            "price": 18.99,
                            "category": "Main Course",
                            "available": True,
                            "preparation_time": 20
                        },
                        {
                            "id": str(uuid.uuid4()),
                            "name": "Curry Goat",
                            "description": "Traditional Caribbean curry goat with rice and peas",
                            "price": 22.99,
                            "category": "Main Course",
                            "available": True,
                            "preparation_time": 25
                        },
                        {
                            "id": str(uuid.uuid4()),
                            "name": "Festival",
                            "description": "Sweet fried dumplings - perfect side dish",
                            "price": 4.99,
                            "category": "Sides",
                            "available": True,
                            "preparation_time": 10
                        }
                    ],
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            ]
            
            await db.restaurants.insert_many(sample_restaurants)
        
        # Initialize sample car rental companies
        existing_rentals = await db.car_rental_companies.count_documents({})
        if existing_rentals == 0:
            sample_rentals = [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": "sample_rental_user_1",
                    "company_name": "Caribbean Wheels",
                    "description": "Premier car rental service with airport pickup and island-wide coverage",
                    "business_license": "CRB-2024-001",
                    "insurance_info": {
                        "provider": "Caribbean General Insurance",
                        "policy_number": "CG-FL-789456",
                        "coverage": "Comprehensive Commercial Fleet"
                    },
                    "locations": [
                        {
                            "name": "Norman Manley International Airport",
                            "address": {
                                "street": "Airport Terminal Building",
                                "city": "Kingston",
                                "parish": "St. Andrew",
                                "country": "Jamaica"
                            },
                            "hours": {
                                "monday": {"open": "06:00", "close": "23:00"},
                                "tuesday": {"open": "06:00", "close": "23:00"},
                                "wednesday": {"open": "06:00", "close": "23:00"},
                                "thursday": {"open": "06:00", "close": "23:00"},
                                "friday": {"open": "06:00", "close": "23:00"},
                                "saturday": {"open": "06:00", "close": "23:00"},
                                "sunday": {"open": "06:00", "close": "23:00"}
                            }
                        },
                        {
                            "name": "Downtown Kingston",
                            "address": {
                                "street": "15 King Street",
                                "city": "Kingston",
                                "parish": "St. Andrew", 
                                "country": "Jamaica"
                            },
                            "hours": {
                                "monday": {"open": "08:00", "close": "18:00"},
                                "tuesday": {"open": "08:00", "close": "18:00"},
                                "wednesday": {"open": "08:00", "close": "18:00"},
                                "thursday": {"open": "08:00", "close": "18:00"},
                                "friday": {"open": "08:00", "close": "18:00"},
                                "saturday": {"open": "09:00", "close": "17:00"},
                                "sunday": {"open": "10:00", "close": "16:00"}
                            }
                        }
                    ],
                    "contact_info": {
                        "phone": "+1-876-555-RENT",
                        "email": "bookings@caribbeanwheels.com",
                        "website": "www.caribbeanwheels.com"
                    },
                    "fleet": [
                        {
                            "id": str(uuid.uuid4()),
                            "make": "Toyota",
                            "model": "Corolla",
                            "year": 2023,
                            "vehicle_type": "economy",
                            "color": "White",
                            "license_plate": "JA-ECO-001",
                            "fuel_type": "gasoline",
                            "transmission": "automatic",
                            "passenger_capacity": 5,
                            "daily_rate": 45.0,
                            "weekly_rate": 280.0,
                            "monthly_rate": 1050.0,
                            "mileage": 15000,
                            "features": ["Air Conditioning", "Bluetooth", "USB Charging", "Backup Camera"],
                            "images": [],
                            "status": "available",
                            "location": "airport"
                        },
                        {
                            "id": str(uuid.uuid4()),
                            "make": "Nissan",
                            "model": "Altima",
                            "year": 2023,
                            "vehicle_type": "mid_size",
                            "color": "Silver",
                            "license_plate": "JA-MID-002",
                            "fuel_type": "gasoline",
                            "transmission": "automatic",
                            "passenger_capacity": 5,
                            "daily_rate": 65.0,
                            "weekly_rate": 420.0,
                            "monthly_rate": 1580.0,
                            "mileage": 12000,
                            "features": ["Air Conditioning", "GPS Navigation", "Bluetooth", "Sunroof", "Premium Audio"],
                            "images": [],
                            "status": "available",
                            "location": "airport"
                        },
                        {
                            "id": str(uuid.uuid4()),
                            "make": "Honda",
                            "model": "CR-V",
                            "year": 2023,
                            "vehicle_type": "suv",
                            "color": "Black",
                            "license_plate": "JA-SUV-003",
                            "fuel_type": "gasoline",
                            "transmission": "automatic",
                            "passenger_capacity": 7,
                            "daily_rate": 85.0,
                            "weekly_rate": 560.0,
                            "monthly_rate": 2100.0,
                            "mileage": 8000,
                            "features": ["Air Conditioning", "GPS Navigation", "4WD", "Roof Rack", "Premium Sound", "Leather Seats"],
                            "images": [],
                            "status": "available",
                            "location": "airport"
                        },
                        {
                            "id": str(uuid.uuid4()),
                            "make": "BMW",
                            "model": "X3",
                            "year": 2024,
                            "vehicle_type": "luxury",
                            "color": "Blue",
                            "license_plate": "JA-LUX-004",
                            "fuel_type": "gasoline",
                            "transmission": "automatic",
                            "passenger_capacity": 5,
                            "daily_rate": 150.0,
                            "weekly_rate": 980.0,
                            "monthly_rate": 3700.0,
                            "mileage": 5000,
                            "features": ["Premium Interior", "GPS Navigation", "Heated Seats", "Panoramic Sunroof", "Premium Sound", "All-Wheel Drive"],
                            "images": [],
                            "status": "available",
                            "location": "downtown"
                        }
                    ],
                    "policies": {
                        "minimum_age": 21,
                        "maximum_age": 75,
                        "security_deposit": 200.0,
                        "cancellation_policy": "Free cancellation up to 24 hours before pickup",
                        "fuel_policy": "Return with same fuel level",
                        "mileage_policy": "Unlimited local mileage"
                    },
                    "rating": 4.7,
                    "total_bookings": 156,
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            ]
            
            await db.car_rental_companies.insert_many(sample_rentals)
            
    except Exception as e:
        logging.error(f"Error initializing data: {e}")

# Include the router in the main app
app.include_router(api_router)

# CORS: when origins are wildcard we must use a reflecting regex instead of
# allow_origins=["*"], because browsers forbid "*" together with credentials.
# allow_origin_regex echoes the caller's exact origin + Allow-Credentials: true,
# which is required for cross-origin (custom-domain) requests with withCredentials.
_cors_origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()]
if _cors_origins == ['*'] or not _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origin_regex=".*",
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=_cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        sched = getattr(app.state, "scheduler", None)
        if sched:
            sched.shutdown(wait=False)
    except Exception:
        pass
    client.close()
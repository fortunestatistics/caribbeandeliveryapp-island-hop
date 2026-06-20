"""
Pydantic data models for IslandHop backend.

Extracted from server.py to keep route handlers focused on logic.
Server.py imports everything from this module via `from models import *`.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, EmailStr


# Currency constants used by wallet logic
SUPPORTED_WALLET_CURRENCIES = {"USD", "JMD", "TTD", "BBD", "GHS", "NGN", "ZAR"}


# Authentication Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    user_type: str = "customer"  # customer, restaurant, driver
    referral_code: Optional[str] = None
    otp_code: Optional[str] = None  # if provided, will be verified against pending OTP for phone


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]


class TeamPromote(BaseModel):
    email: EmailStr
    role: str  # "admin" or "agent"


class TeamInvite(BaseModel):
    email: EmailStr
    role: str  # "admin" or "agent"


class InviteAccept(BaseModel):
    token: str
    name: str
    password: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


# Order Models
class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    quantity: int
    price: float
    notes: Optional[str] = None


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    restaurant_id: Optional[str] = None
    vendor_id: Optional[str] = None  # Generic vendor ID for non-restaurant services
    driver_id: Optional[str] = None
    service_type: str  # food, taxi, grocery, pharmacy, courier, car_rental
    items: List[OrderItem] = []
    subtotal: float
    delivery_fee: float
    tip: float = 0.0
    tax: float = 0.0
    discount: float = 0.0
    promo_code: Optional[str] = None
    total: float

    # Commission and payout fields
    commission_rate: float = 0.0
    commission_amount: float = 0.0
    vendor_payout: float = 0.0
    platform_earnings: float = 0.0
    driver_earnings: float = 0.0
    driver_delivery_portion: float = 0.0
    platform_delivery_portion: float = 0.0

    # Payout tracking
    vendor_payout_status: str = "pending"
    driver_payout_status: str = "pending"
    vendor_payout_date: Optional[datetime] = None
    driver_payout_date: Optional[datetime] = None

    status: str = "pending"
    pickup_address: Dict[str, Any]
    delivery_address: Dict[str, Any]
    customer_phone: str
    payment_status: str = "pending"
    payment_method: str
    payment_intent_id: Optional[str] = None
    estimated_delivery_time: Optional[datetime] = None
    actual_delivery_time: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderCreate(BaseModel):
    restaurant_id: Optional[str] = None
    service_type: str
    items: List[OrderItem] = []
    subtotal: float
    delivery_fee: float
    tip: float = 0.0
    total: float
    pickup_address: Dict[str, Any]
    delivery_address: Dict[str, Any]
    customer_phone: str
    payment_method: str


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    driver_id: Optional[str] = None
    estimated_delivery_time: Optional[datetime] = None


# Subscription Models
class SubscriptionPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    user_type: str  # business, driver
    tier: str
    price_monthly: float
    price_yearly: float
    features: List[str]
    commission_rate: float
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None


class UserSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    plan_id: str
    stripe_subscription_id: Optional[str] = None
    status: str = "active"
    billing_cycle: str = "monthly"
    current_period_start: datetime
    current_period_end: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubscriptionCreate(BaseModel):
    plan_id: str
    billing_cycle: str
    payment_method_id: str


# Status Check Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


# User Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    session_token: Optional[str] = None
    user_type: str = "customer"
    phone: Optional[str] = None
    phone_verified: bool = False
    address: Optional[Dict[str, str]] = None
    referred_by: Optional[str] = None
    referral_code_used: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionCreate(BaseModel):
    session_id: str


# Restaurant Models
class Restaurant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    description: str
    cuisine_type: str
    address: Dict[str, str]
    phone: str
    email: str
    status: str = "active"
    rating: float = 0.0
    delivery_fee: float = 5.0
    minimum_order: float = 15.0
    estimated_delivery_time: int = 30
    menu_items: List[Dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Menu Item Models (later/canonical definition)
class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    restaurant_id: str
    name: str
    description: Optional[str] = None
    price: float
    category: str
    image_url: Optional[str] = None
    available: bool = True
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_gluten_free: bool = False
    spice_level: str = "none"
    preparation_time: int = 15
    customizations: List[str] = []
    variants: List[Dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Driver Models
class Driver(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    license_number: str
    vehicle_type: str
    vehicle_plate: str
    status: str = "offline"
    rating: float = 0.0
    current_location: Optional[Dict[str, float]] = None
    wallet_balance: float = 0.0
    total_earnings: float = 0.0
    # Onboarding / KYC fields (set when a driver applies; reviewed by an admin)
    personal_info: Optional[Dict[str, Any]] = None
    vehicle_info: Optional[Dict[str, Any]] = None
    banking_info: Optional[Dict[str, Any]] = None
    documents: Optional[Dict[str, str]] = None  # doc_type -> driver_documents.id
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DriverWallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    balance: float = 0.0
    total_earned: float = 0.0
    total_withdrawn: float = 0.0
    pending_amount: float = 0.0
    stripe_account_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DriverWithdrawal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    amount: float
    status: str = "pending"
    method: str
    bank_details: Optional[Dict[str, Any]] = None
    stripe_transfer_id: Optional[str] = None
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None


# Vendor Stripe Connect Models
class VendorStripeAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    vendor_type: str
    stripe_account_id: str
    account_status: str = "pending"
    onboarding_complete: bool = False
    charges_enabled: bool = False
    payouts_enabled: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VendorPayout(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    vendor_type: str
    amount: float
    order_ids: List[str]
    payout_date: datetime
    status: str = "scheduled"
    stripe_payout_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


# Rating & Review Models
class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    customer_id: str
    vendor_id: Optional[str] = None
    driver_id: Optional[str] = None
    vendor_rating: Optional[int] = None
    driver_rating: Optional[int] = None
    food_quality: Optional[int] = None
    delivery_speed: Optional[int] = None
    driver_professionalism: Optional[int] = None
    driver_care: Optional[int] = None
    driver_communication: Optional[int] = None
    vendor_review: Optional[str] = None
    driver_review: Optional[str] = None
    response_from_vendor: Optional[str] = None
    response_date: Optional[datetime] = None
    is_flagged: bool = False
    flag_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RatingCreate(BaseModel):
    order_id: str
    vendor_rating: Optional[int] = None
    driver_rating: Optional[int] = None
    food_quality: Optional[int] = None
    delivery_speed: Optional[int] = None
    driver_professionalism: Optional[int] = None
    driver_care: Optional[int] = None
    driver_communication: Optional[int] = None
    vendor_review: Optional[str] = None
    driver_review: Optional[str] = None


# Driver Location Tracking Models
class DriverLocation(BaseModel):
    driver_id: str
    latitude: float
    longitude: float
    heading: Optional[float] = None
    speed: Optional[float] = None
    accuracy: Optional[float] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Notification Models
class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    read: bool = False
    sent_via: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Promo Code Models
class PromoCode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    type: str
    value: float
    min_order_amount: float = 0.0
    max_discount: Optional[float] = None
    usage_limit: Optional[int] = None
    usage_per_user: int = 1
    used_count: int = 0
    service_types: List[str] = []
    valid_from: datetime
    valid_until: datetime
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Address Models
class Address(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    label: str
    street_address: str
    city: str
    state: str
    postal_code: Optional[str] = None
    country: str = "Jamaica"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    delivery_instructions: Optional[str] = None
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Support Ticket Models
class SupportTicket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject: str
    category: str  # general, order_issue, payment, refund, account, technical, claim
    order_id: Optional[str] = None
    description: str
    status: str = "open"
    priority: str = "normal"
    assigned_to: Optional[str] = None
    # Claim-specific fields (used when category == "claim")
    claim_type: Optional[str] = None  # wrong_item, missing_item, damaged, late, quality, other
    photo_url: Optional[str] = None   # base64 data URL or hosted URL
    resolution_credit: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None


class TicketMessageCreate(BaseModel):
    message: str
    sender_type: str = "customer"  # customer | agent | system


class TicketMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    sender_id: str
    sender_type: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResolveClaimRequest(BaseModel):
    resolution: str  # "approved" | "rejected"
    credit_amount: Optional[float] = None  # if approved, credits wallet (USD)
    notes: Optional[str] = None


# Scheduled Order Models
class ScheduledOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    service_type: str
    restaurant_id: Optional[str] = None
    items: List[Dict] = []
    delivery_address_id: str
    scheduled_datetime: datetime
    status: str = "pending"
    is_recurring: bool = False
    recurring_pattern: Optional[str] = None
    recurrence_days: List[int] = []
    recurring_order_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RecurringOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    service_type: str
    restaurant_id: Optional[str] = None
    items: List[Dict] = []
    delivery_address_id: str
    recurrence_pattern: str
    recurrence_days: List[int] = []
    start_date: datetime
    end_date: Optional[datetime] = None
    next_occurrence: datetime
    active: bool = True
    orders_created: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Car Rental Models
class RentalVehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    make: str
    model: str
    year: int
    vehicle_type: str
    color: str
    license_plate: str
    fuel_type: str
    transmission: str
    passenger_capacity: int
    daily_rate: float
    weekly_rate: float
    monthly_rate: float
    mileage: int
    features: List[str]
    images: List[str] = []
    status: str = "available"
    location: str


class CarRentalCompany(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    company_name: str
    description: str
    business_license: str
    insurance_info: Dict[str, str]
    locations: List[Dict[str, Any]]
    contact_info: Dict[str, str]
    fleet: List[RentalVehicle] = []
    policies: Dict[str, Any]
    rating: float = 0.0
    total_bookings: int = 0
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RentalBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_number: str = Field(default_factory=lambda: f"RNT{str(uuid.uuid4())[:8].upper()}")
    customer_id: str
    rental_company_id: str
    vehicle_id: str
    pickup_location: str
    dropoff_location: str
    pickup_datetime: datetime
    dropoff_datetime: datetime
    rental_duration_days: int
    daily_rate: float
    total_cost: float
    security_deposit: float
    insurance_selected: bool = False
    insurance_cost: float = 0.0
    driver_info: Dict[str, str]
    additional_services: List[str] = []
    status: str = "pending"
    payment_status: str = "pending"
    special_requests: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None


# Wallet Models (IslandHop in-app multi-currency wallet)
class Wallet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    balances: Dict[str, float] = Field(default_factory=lambda: {"USD": 0.0, "TTD": 0.0})
    default_currency: str = "USD"
    caripay_handle: Optional[str] = None
    caripay_country: Optional[str] = None
    caripay_linked_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WalletTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    wallet_id: str
    type: str
    amount: float
    currency: str
    status: str = "pending"
    counterparty_user_id: Optional[str] = None
    counterparty_handle: Optional[str] = None
    external_transfer_id: Optional[str] = None
    order_id: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Business Onboarding Models
class BusinessType(BaseModel):
    type: str
    name: str
    description: str


class BusinessCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    commission_rate: float
    requirements: List[str]


class BusinessOwner(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    phone: str
    identification_type: str
    identification_number: str
    address: Dict[str, str]


class BusinessDetails(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_name: str
    business_type: str
    category_id: str
    description: str
    address: Dict[str, str]
    phone: str
    email: str
    website: Optional[str] = None
    operating_hours: Dict[str, Dict[str, str]]
    delivery_radius: float
    minimum_order: float
    delivery_fee: float
    estimated_prep_time: int


class BusinessOnboarding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_owner: BusinessOwner
    business_details: BusinessDetails
    documents: List[Dict[str, str]]
    verification_status: str = "pending"
    application_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    approved_date: Optional[datetime] = None


# Pricing Models
class PricingTier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    business_type: str
    commission_rate: float
    monthly_fee: float
    transaction_fee: float
    features: List[str]
    is_premium: bool = False


class PayoutSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_id: str
    payout_schedule: str
    minimum_payout: float
    bank_details: Dict[str, str]
    auto_payout: bool = True


# Payment Models
class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    payment_id: Optional[str] = None
    user_id: Optional[str] = None
    email: Optional[str] = None
    amount: float
    currency: str = "usd"
    payment_status: str = "initiated"
    metadata: Optional[Dict[str, str]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# AI Chat Models (canonical "ChatMessage" — supersedes earlier order-chat definition)
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Per-order multi-party chat (customer ↔ driver ↔ merchant)
class OrderChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    sender_id: str
    sender_user_type: str  # customer | driver | vendor | system
    sender_name: Optional[str] = None
    message: str
    read_by: List[str] = []  # user ids that have read this message
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderChatMessageCreate(BaseModel):
    order_id: str
    message: str


# Vendor substitution proposal (lives inside the order chat thread)
class SubstitutionProposal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    vendor_id: str  # user id of the merchant proposing
    original_item_name: str
    proposed_item_name: Optional[str] = None  # null when item is marked unavailable
    price_delta: float = 0.0  # +/- USD change relative to original
    note: Optional[str] = None
    status: str = "pending"  # pending, accepted, declined, cancelled
    responded_by: Optional[str] = None
    responded_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubstitutionCreate(BaseModel):
    order_id: str
    original_item_name: str
    proposed_item_name: Optional[str] = None  # if None, item is marked unavailable
    price_delta: float = 0.0
    note: Optional[str] = None


class ChatMessageCreate(BaseModel):
    order_id: str
    sender_type: str
    message: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


# KPI Models
class CustomerRating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    customer_id: str
    restaurant_id: str
    driver_id: Optional[str] = None
    food_rating: float
    delivery_rating: float
    overall_rating: float
    feedback: Optional[str] = None
    delivery_time_satisfaction: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DriverPerformance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    date: datetime
    orders_completed: int
    total_delivery_time: int
    average_delivery_time: float
    on_time_deliveries: int
    late_deliveries: int
    earnings: float
    distance_traveled: float
    fuel_cost: float
    customer_ratings: float
    active_hours: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DailyOperations(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime
    total_orders: int
    completed_orders: int
    cancelled_orders: int
    total_revenue: float
    total_delivery_time: int
    average_delivery_time: float
    on_time_deliveries: int
    late_deliveries: int
    active_drivers: int
    total_customers: int
    new_customers: int
    customer_satisfaction_avg: float
    operational_costs: float
    profit: float
    peak_hours: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class KPIMetrics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime
    avg_delivery_time: float
    on_time_delivery_rate: float
    customer_satisfaction_score: float
    net_promoter_score: float
    driver_retention_rate: float
    avg_driver_rating: float
    driver_earnings_per_hour: float
    avg_order_value: float
    order_completion_cost: float
    revenue_per_order: float
    profit_margin: float
    order_completion_rate: float
    peak_hour_efficiency: float
    customer_acquisition_cost: float
    customer_lifetime_value: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Fraud Review Models
class FraudFlag(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    customer_id: str
    amount: float
    signals: List[str] = []  # heuristic codes, e.g. ["high_value", "velocity", "new_account"]
    severity: str = "low"  # low, medium, high
    status: str = "open"  # open, cleared, confirmed_fraud
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FraudReviewAction(BaseModel):
    action: str  # "clear" or "confirm"
    notes: Optional[str] = None



class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class PushSubscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    endpoint: str
    keys: PushSubscriptionKeys
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

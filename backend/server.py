from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import json

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

# Models
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
    user_type: str = "customer"  # customer, restaurant, driver, admin
    phone: Optional[str] = None
    address: Optional[Dict[str, str]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    session_id: str

# Restaurant Models
class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    category: str
    image_url: Optional[str] = None
    available: bool = True
    preparation_time: int = 15  # minutes

class Restaurant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    description: str
    cuisine_type: str
    address: Dict[str, str]
    phone: str
    email: str
    status: str = "active"  # active, inactive, suspended
    rating: float = 0.0
    delivery_fee: float = 5.0
    minimum_order: float = 15.0
    estimated_delivery_time: int = 30
    menu_items: List[MenuItem] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Driver Models
class Driver(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    license_number: str
    vehicle_type: str
    vehicle_plate: str
    status: str = "offline"  # offline, online, busy
    rating: float = 0.0
    current_location: Optional[Dict[str, float]] = None  # lat, lng
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Car Rental Models
class RentalVehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    make: str
    model: str
    year: int
    vehicle_type: str  # economy, compact, mid_size, full_size, luxury, suv, convertible
    color: str
    license_plate: str
    fuel_type: str  # gasoline, diesel, electric, hybrid
    transmission: str  # automatic, manual
    passenger_capacity: int
    daily_rate: float
    weekly_rate: float
    monthly_rate: float
    mileage: int
    features: List[str]  # ["GPS", "AC", "Bluetooth", "Backup Camera"]
    images: List[str] = []
    status: str = "available"  # available, rented, maintenance, out_of_service
    location: str  # airport, downtown, hotel_pickup

class CarRentalCompany(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    company_name: str
    description: str
    business_license: str
    insurance_info: Dict[str, str]
    locations: List[Dict[str, Any]]  # [{"name": "Airport", "address": {...}, "hours": {...}}]
    contact_info: Dict[str, str]
    fleet: List[RentalVehicle] = []
    policies: Dict[str, Any]  # age_requirement, deposit, cancellation_policy
    rating: float = 0.0
    total_bookings: int = 0
    status: str = "active"  # active, inactive, suspended
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
    driver_info: Dict[str, str]  # license info, age verification
    additional_services: List[str] = []  # ["GPS", "Child Seat", "Additional Driver"]
    status: str = "pending"  # pending, confirmed, picked_up, completed, cancelled
    payment_status: str = "pending"
    special_requests: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None

# Order Models
class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int
    special_instructions: Optional[str] = None

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = Field(default_factory=lambda: f"ORD{str(uuid.uuid4())[:8].upper()}")
    customer_id: str
    restaurant_id: str
    driver_id: Optional[str] = None
    items: List[OrderItem]
    subtotal: float
    delivery_fee: float
    tax: float
    total: float
    status: str = "pending"  # pending, confirmed, preparing, ready, picked_up, delivered, cancelled
    delivery_address: Dict[str, str]
    customer_phone: str
    special_instructions: Optional[str] = None
    estimated_delivery_time: datetime
    payment_status: str = "pending"  # pending, paid, refunded
    payment_session_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    prepared_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

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
    identification_type: str  # passport, drivers_license, national_id
    identification_number: str
    address: Dict[str, str]

class BusinessDetails(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    business_name: str
    business_type: str  # restaurant, pharmacy, grocery, courier, general_business
    category_id: str
    description: str
    address: Dict[str, str]
    phone: str
    email: str
    website: Optional[str] = None
    operating_hours: Dict[str, Dict[str, str]]
    delivery_radius: float  # in kilometers
    minimum_order: float
    delivery_fee: float
    estimated_prep_time: int  # in minutes

class BusinessOnboarding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_owner: BusinessOwner
    business_details: BusinessDetails
    documents: List[Dict[str, str]]  # Document uploads
    verification_status: str = "pending"  # pending, verified, rejected
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
    payout_schedule: str  # daily, weekly, bi_weekly, monthly
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
    payment_status: str = "initiated"  # initiated, pending, paid, failed, expired
    metadata: Optional[Dict[str, str]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# AI Chat Models
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    food_rating: float  # 1-5 stars
    delivery_rating: float  # 1-5 stars
    overall_rating: float  # 1-5 stars
    feedback: Optional[str] = None
    delivery_time_satisfaction: float  # 1-5 stars
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DriverPerformance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    date: datetime
    orders_completed: int
    total_delivery_time: int  # in minutes
    average_delivery_time: float
    on_time_deliveries: int
    late_deliveries: int
    earnings: float
    distance_traveled: float  # in kilometers
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
    total_delivery_time: int  # total minutes
    average_delivery_time: float
    on_time_deliveries: int
    late_deliveries: int
    active_drivers: int
    total_customers: int
    new_customers: int
    customer_satisfaction_avg: float
    operational_costs: float
    profit: float
    peak_hours: List[Dict[str, Any]]  # [{"hour": 12, "orders": 45}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class KPIMetrics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime
    # Delivery Performance KPIs
    avg_delivery_time: float  # minutes
    on_time_delivery_rate: float  # percentage
    # Customer Satisfaction KPIs
    customer_satisfaction_score: float  # 1-5 scale
    net_promoter_score: float  # -100 to +100
    # Driver Performance KPIs
    driver_retention_rate: float  # percentage
    avg_driver_rating: float  # 1-5 scale
    driver_earnings_per_hour: float
    # Financial KPIs
    avg_order_value: float
    order_completion_cost: float
    revenue_per_order: float
    profit_margin: float  # percentage
    # Operational KPIs
    order_completion_rate: float  # percentage
    peak_hour_efficiency: float  # percentage
    customer_acquisition_cost: float
    customer_lifetime_value: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
                except:
                    pass
            elif isinstance(value, dict):
                item[key] = parse_from_mongo(value)
    return item

# Authentication helper
async def get_current_user_from_request(request: Request):
    """Get current authenticated user from request"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = await db.users.find_one({"session_token": session_token})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    return User(**user)

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

@api_router.get("/auth/me")
async def get_current_user(request: Request):
    """Get current authenticated user"""
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = await db.users.find_one({"session_token": session_token})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    return User(**user)

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

@api_router.get("/restaurants", response_model=List[Restaurant])
async def get_restaurants():
    """Get all active restaurants"""
    restaurants = await db.restaurants.find({"status": "active"}).to_list(length=None)
    return [Restaurant(**restaurant) for restaurant in restaurants]

@api_router.get("/restaurants/{restaurant_id}", response_model=Restaurant)
async def get_restaurant(restaurant_id: str):
    """Get restaurant by ID"""
    restaurant = await db.restaurants.find_one({"id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return Restaurant(**restaurant)

# Order Management Routes
@api_router.post("/orders", response_model=Order)
async def create_order(order: Order, request: Request):
    """Create new order"""
    current_user = await get_current_user_from_request(request)
    order.customer_id = current_user.id
    
    # Calculate estimated delivery time
    order.estimated_delivery_time = datetime.now(timezone.utc)
    
    order_dict = prepare_for_mongo(order.dict())
    await db.orders.insert_one(order_dict)
    
    # Notify restaurant via WebSocket
    await manager.send_personal_message(
        json.dumps({
            "type": "new_order",
            "order_id": order.id,
            "order_number": order.order_number
        }),
        order.restaurant_id
    )
    
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_user_orders(request: Request):
    """Get orders for current user"""
    current_user = await get_current_user_from_request(request)
    
    if current_user.user_type == "customer":
        orders = await db.orders.find({"customer_id": current_user.id}).to_list(length=None)
    elif current_user.user_type == "restaurant":
        restaurant = await db.restaurants.find_one({"user_id": current_user.id})
        if restaurant:
            orders = await db.orders.find({"restaurant_id": restaurant["id"]}).to_list(length=None)
        else:
            orders = []
    elif current_user.user_type == "driver":
        driver = await db.drivers.find_one({"user_id": current_user.id})
        if driver:
            orders = await db.orders.find({"driver_id": driver["id"]}).to_list(length=None)
        else:
            orders = []
    else:
        orders = []
    
    return [Order(**order) for order in orders]

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, request: Request):
    """Update order status"""
    current_user = await get_current_user_from_request(request)
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Validate user can update this order
    can_update = False
    if current_user.user_type == "restaurant":
        restaurant = await db.restaurants.find_one({"user_id": current_user.id})
        if restaurant and restaurant["id"] == order["restaurant_id"]:
            can_update = True
    elif current_user.user_type == "driver":
        driver = await db.drivers.find_one({"user_id": current_user.id})
        if driver and driver["id"] == order.get("driver_id"):
            can_update = True
    
    if not can_update:
        raise HTTPException(status_code=403, detail="Not authorized to update this order")
    
    # Update order status with timestamp
    update_data = {"status": status}
    if status == "confirmed":
        update_data["confirmed_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "ready":
        update_data["prepared_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "picked_up":
        update_data["picked_up_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": update_data}
    )
    
    # Notify relevant parties
    notification = {
        "type": "order_status_update",
        "order_id": order_id,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Notify customer
    await manager.send_personal_message(json.dumps(notification), order["customer_id"])
    
    # Notify driver if assigned
    if order.get("driver_id"):
        await manager.send_personal_message(json.dumps(notification), order["driver_id"])
    
    return {"message": f"Order status updated to {status}"}

# Driver Management Routes
@api_router.post("/drivers", response_model=Driver)
async def create_driver(driver: Driver, request: Request):
    """Create driver profile"""
    current_user = await get_current_user_from_request(request)
    driver.user_id = current_user.id
    
    driver_dict = prepare_for_mongo(driver.dict())
    await db.drivers.insert_one(driver_dict)
    
    # Update user type
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"user_type": "driver"}}
    )
    
    return driver

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

@api_router.get("/analytics/kpi-dashboard")
async def get_kpi_dashboard(date: Optional[str] = None):
    """Get comprehensive KPI dashboard data"""
    try:
        target_date = datetime.fromisoformat(date) if date else datetime.now(timezone.utc)
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Get orders for the day
        orders = await db.orders.find({
            "created_at": {
                "$gte": start_of_day.isoformat(),
                "$lte": end_of_day.isoformat()
            }
        }).to_list(length=None)
        
        # Calculate delivery performance KPIs
        completed_orders = [o for o in orders if o.get('status') == 'delivered']
        total_orders = len(orders)
        completed_count = len(completed_orders)
        
        # Average delivery time calculation
        delivery_times = []
        on_time_count = 0
        
        for order in completed_orders:
            if order.get('delivered_at') and order.get('created_at'):
                created = datetime.fromisoformat(order['created_at'])
                delivered = datetime.fromisoformat(order['delivered_at'])
                delivery_time = (delivered - created).total_seconds() / 60  # minutes
                delivery_times.append(delivery_time)
                
                # Check if on time (assuming 30 min standard)
                if delivery_time <= 30:
                    on_time_count += 1
        
        avg_delivery_time = sum(delivery_times) / len(delivery_times) if delivery_times else 0
        on_time_rate = (on_time_count / completed_count * 100) if completed_count > 0 else 0
        
        # Customer satisfaction
        ratings = await db.customer_ratings.find({
            "created_at": {
                "$gte": start_of_day.isoformat(),
                "$lte": end_of_day.isoformat()
            }
        }).to_list(length=None)
        
        avg_rating = sum(r.get('overall_rating', 0) for r in ratings) / len(ratings) if ratings else 0
        
        # Financial metrics
        total_revenue = sum(o.get('total', 0) for o in completed_orders)
        avg_order_value = total_revenue / completed_count if completed_count > 0 else 0
        
        # Order completion cost (estimated)
        estimated_cost_per_order = 8.50  # Base cost including driver pay, fuel, operations
        total_costs = completed_count * estimated_cost_per_order
        order_completion_cost = estimated_cost_per_order
        
        # Driver performance
        active_drivers = await db.drivers.count_documents({"status": {"$in": ["online", "busy"]}})
        all_drivers = await db.drivers.count_documents({})
        
        # Get driver ratings
        driver_ratings = await db.customer_ratings.find({
            "created_at": {
                "$gte": start_of_day.isoformat(),
                "$lte": end_of_day.isoformat()
            }
        }).to_list(length=None)
        
        avg_driver_rating = sum(r.get('delivery_rating', 0) for r in driver_ratings) / len(driver_ratings) if driver_ratings else 0
        
        kpi_data = {
            "date": target_date.isoformat(),
            "delivery_performance": {
                "avg_delivery_time": round(avg_delivery_time, 2),
                "on_time_delivery_rate": round(on_time_rate, 2),
                "total_orders": total_orders,
                "completed_orders": completed_count,
                "order_completion_rate": round((completed_count / total_orders * 100) if total_orders > 0 else 0, 2)
            },
            "customer_satisfaction": {
                "avg_rating": round(avg_rating, 2),
                "total_ratings": len(ratings),
                "delivery_satisfaction": round(sum(r.get('delivery_time_satisfaction', 0) for r in ratings) / len(ratings) if ratings else 0, 2)
            },
            "driver_performance": {
                "active_drivers": active_drivers,
                "total_drivers": all_drivers,
                "avg_driver_rating": round(avg_driver_rating, 2),
                "driver_utilization_rate": round((active_drivers / all_drivers * 100) if all_drivers > 0 else 0, 2)
            },
            "financial_metrics": {
                "total_revenue": round(total_revenue, 2),
                "avg_order_value": round(avg_order_value, 2),
                "order_completion_cost": round(order_completion_cost, 2),
                "estimated_profit": round(total_revenue - total_costs, 2),
                "profit_margin": round(((total_revenue - total_costs) / total_revenue * 100) if total_revenue > 0 else 0, 2)
            }
        }
        
        return kpi_data
        
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
        }).to_list(length=None)
        
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
        }).to_list(length=None)
        
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
                
                # Calculate driver earnings (80% of delivery fee)
                earnings += order.get('delivery_fee', 0) * 0.8
        
        # Get driver ratings
        ratings = await db.customer_ratings.find({
            "driver_id": driver_id,
            "created_at": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat()
            }
        }).to_list(length=None)
        
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
        
        # Cost calculations (estimates)
        driver_payouts = delivery_fee_revenue * 0.8  # Drivers get 80% of delivery fee
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
    """Get all pricing tiers"""
    tiers = await db.pricing_tiers.find().to_list(length=None)
    return [PricingTier(**tier) for tier in tiers]

# Business Onboarding Routes
@api_router.post("/business/onboarding", response_model=BusinessOnboarding)
async def create_business_application(application: BusinessOnboarding, request: Request):
    """Submit business onboarding application"""
    try:
        # Get current user
        current_user = await get_current_user(request)
        application.user_id = current_user.id
        
        # Store application
        app_dict = prepare_for_mongo(application.dict())
        await db.business_applications.insert_one(app_dict)
        
        return application
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/business/onboarding", response_model=List[BusinessOnboarding])
async def get_business_applications(request: Request):
    """Get business applications for current user"""
    try:
        current_user = await get_current_user(request)
        applications = await db.business_applications.find({"user_id": current_user.id}).to_list(length=None)
        return [BusinessOnboarding(**app) for app in applications]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/business/onboarding/{application_id}", response_model=BusinessOnboarding)
async def get_business_application(application_id: str, request: Request):
    """Get specific business application"""
    try:
        current_user = await get_current_user(request)
        application = await db.business_applications.find_one({
            "id": application_id,
            "user_id": current_user.id
        })
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        return BusinessOnboarding(**application)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Payment Routes
@api_router.post("/payments/checkout/session")
async def create_checkout_session(request_data: dict, request: Request):
    """Create Stripe checkout session"""
    try:
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/payments/webhook/stripe"
        
        stripe_checkout = StripeCheckout(
            api_key=STRIPE_API_KEY,
            webhook_url=webhook_url
        )
        
        # Create checkout session request
        checkout_request = CheckoutSessionRequest(**request_data)
        
        # Create session
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store payment transaction
        payment = PaymentTransaction(
            session_id=session.session_id,
            amount=request_data.get("amount", 0.0),
            currency=request_data.get("currency", "usd"),
            metadata=request_data.get("metadata", {})
        )
        
        payment_dict = prepare_for_mongo(payment.dict())
        await db.payment_transactions.insert_one(payment_dict)
        
        return {"url": session.url, "session_id": session.session_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/payments/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get checkout session status"""
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        
        # Get status from Stripe
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update local payment record
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "payment_status": status.payment_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return status.dict()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/payments/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update payment transaction
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {
                    "$set": {
                        "payment_status": webhook_response.payment_status,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
        
        return {"status": "success"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

# Status Routes
@api_router.get("/")
async def root():
    return {"message": "Caribbean Delivery App API"}

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

# Initialize data on startup
@app.on_event("startup")
async def initialize_data():
    """Initialize default data"""
    try:
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
        
        # Initialize sample restaurants
        existing_restaurants = await db.restaurants.count_documents({})
        if existing_restaurants == 0:
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
            
    except Exception as e:
        logging.error(f"Error initializing data: {e}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
    client.close()
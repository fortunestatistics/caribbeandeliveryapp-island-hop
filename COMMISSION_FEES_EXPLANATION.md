# IslandHop Commission & Fee Structure 💰

## Overview
IslandHop operates on a commission-based revenue model where the platform takes a percentage of each transaction. This guide explains how fees are calculated and distributed.

---

## 🏢 Partner Commission Rates (By Business Type)

### Current Commission Structure

| Business Type | Commission Rate | Description |
|--------------|----------------|-------------|
| **Pharmacy** | 8% | Lowest rate due to essential health services |
| **Car Rental** | 10% | Vehicle rental and airport pickup services |
| **Grocery Store** | 12% | Fresh groceries and household items |
| **Restaurant** | 15% | Food delivery services |
| **Business Supplier** | 12-18% | Variable based on category and volume |
| **General Business** | 20% | Highest rate for miscellaneous services |

---

## 📊 Pricing Tiers (Subscription Plans)

Partners can reduce their commission rates by subscribing to premium plans:

### Starter Tier (Free)
- **Commission:** 20%
- **Monthly Fee:** $0
- **Transaction Fee:** 2.5%
- **Features:**
  - Basic delivery tracking
  - Standard support
  - Mobile app access

### Professional Tier
- **Commission:** 15%
- **Monthly Fee:** $49.99
- **Transaction Fee:** 1.8%
- **Features:**
  - Advanced analytics
  - Priority support
  - Custom branding
  - API access

### Enterprise Tier
- **Commission:** 10%
- **Monthly Fee:** $199.99
- **Transaction Fee:** 1.2%
- **Features:**
  - Dedicated account manager
  - Custom integrations
  - White-label options
  - Advanced reporting

---

## 💳 How Fees Are Calculated on Each Order

### Order Breakdown Example (Restaurant - 15% Commission)

```
Customer Order Total: $50.00
├── Subtotal (Food items): $40.00
├── Delivery Fee: $5.00
├── Tax (10%): $4.00
├── Tip (optional): $5.00
└── Total Charged to Customer: $54.00
```

### Fee Distribution:

```
Total Order Value: $54.00
│
├── Platform Commission (15% of subtotal): $6.00
│   └── Goes to IslandHop
│
├── Restaurant Payout: $34.00
│   └── ($40.00 subtotal - $6.00 commission)
│
├── Delivery Fee: $5.00
│   ├── Platform portion: $2.00
│   └── Driver portion: $3.00
│
├── Tax: $4.00
│   └── Goes to government
│
└── Tip: $5.00
    └── Goes 100% to driver
```

### Summary:
- **IslandHop Earnings:** $6.00 (commission) + $2.00 (delivery fee) = $8.00
- **Restaurant Earnings:** $34.00
- **Driver Earnings:** $3.00 (delivery) + $5.00 (tip) = $8.00
- **Government (Tax):** $4.00

---

## 🚗 Commission Calculation Logic

### Current Implementation Status:

**✅ DEFINED IN CODE:**
- Commission rates per business type
- Pricing tier structures
- Subscription plan details

**⚠️ NOT YET IMPLEMENTED:**
The actual commission calculation and automatic payment splitting during order processing is **not currently implemented**. 

### What's Missing:

1. **Automatic Commission Deduction:**
   - Orders currently store `subtotal`, `delivery_fee`, `tax`, and `total`
   - No automatic calculation of platform commission from vendor payout
   - No field tracking vendor net payout (subtotal - commission)

2. **Payment Splitting:**
   - No Stripe Connect integration for automatic payouts
   - No logic to split payment between platform, vendor, and driver
   - All payments currently go to a single account

3. **Commission Tracking:**
   - No dashboard showing commission earned per order
   - No monthly commission reports for vendors
   - No automatic invoicing based on commission

---

## 🔧 How to Implement Commission Calculation

### Step 1: Update Order Model
Add commission tracking fields:
```python
class Order(BaseModel):
    # ... existing fields ...
    subtotal: float
    commission_rate: float  # Get from vendor's plan
    commission_amount: float  # Calculated: subtotal * commission_rate
    vendor_payout: float  # Calculated: subtotal - commission_amount
    platform_earnings: float  # commission_amount + platform_delivery_fee
    driver_earnings: float  # driver_delivery_fee + tip
```

### Step 2: Calculate on Order Creation
```python
@api_router.post("/orders")
async def create_order(order: OrderCreate):
    # Get vendor's subscription plan
    vendor = await db.businesses.find_one({"id": order.vendor_id})
    subscription = await db.subscriptions.find_one({"user_id": vendor["id"]})
    plan = await db.subscription_plans.find_one({"id": subscription["plan_id"]})
    
    # Calculate commission
    commission_rate = plan["commission_rate"] / 100
    commission_amount = order.subtotal * commission_rate
    vendor_payout = order.subtotal - commission_amount
    
    # Save calculated values
    order.commission_rate = commission_rate
    order.commission_amount = commission_amount
    order.vendor_payout = vendor_payout
```

### Step 3: Integrate Stripe Connect (for automatic payouts)
- Set up Stripe Connect accounts for each vendor
- Use `transfer_data` in payment intents to split payments
- Automatically transfer vendor_payout to vendor's Stripe account

---

## 📈 Partner Benefits by Tier

### Why Upgrade?

**Starter → Professional:**
- Save 5% on every order
- On 100 orders of $1,000 total: Save $50 in commission
- Break-even at ~17 orders/month ($50 monthly fee ÷ $3 avg savings)

**Professional → Enterprise:**
- Save additional 5% on commission
- On 500 orders of $5,000 total: Save $250 in commission
- Advanced features justify higher monthly fee for high-volume partners

---

## 🎯 Driver Earnings

Drivers earn from two sources:

1. **Delivery Fee Portion:** 60% of delivery fee
   - If delivery fee is $5, driver gets $3

2. **Tips:** 100% goes to driver
   - Customers can tip before or after delivery

### Example Driver Calculation:
- 20 deliveries/day
- Average delivery fee: $5 (driver gets $3)
- Average tip: $4
- Daily earnings: 20 × ($3 + $4) = $140
- Monthly earnings (25 days): $3,500

---

## 🔐 Transparent Pricing Philosophy

IslandHop believes in:
- **No Hidden Fees:** All fees clearly communicated upfront
- **Fair Commission:** Lower rates for essential services (pharmacy, groceries)
- **Flexible Plans:** Partners can choose the tier that fits their volume
- **Driver First:** 100% of tips go to drivers, no platform fee

---

## 📞 Questions?

For custom enterprise pricing or questions about commission structure:
- Email: partners@islandhop.com
- Phone: 1-800-ISLAND-HOP
- Visit: Partner Portal → Billing & Fees

---

**Last Updated:** 2025-01-11
**Version:** 1.0

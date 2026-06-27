"""Taxi fare engine for IslandHop (Trinidad & Tobago).

Rate card approved Jun 2026 (aligned to local ride-hailing rates). Rates are
authored in TT$; the rest of the app stores money in USD, so callers convert the
returned TT$ fare to USD via `to_usd()` before persisting it on an order.
"""
import os
import logging
from typing import Dict, Tuple

import httpx

logger = logging.getLogger(__name__)

# TT$ per US$ — keep in sync with frontend CurrencyContext.RATE_TTD_PER_USD.
TTD_PER_USD = float(os.environ.get("RATE_TTD_PER_USD", "6.78"))

# Rate card in TT$. Distance/time based, with a higher per-km rate beyond 20 km
# and a minimum fare floor.
TAXI_RATE_CARD: Dict[str, Dict] = {
    "economy":  {"name": "Economy",       "base": 16.0, "per_km": 1.70, "per_min": 1.10, "min_fare": 28.0, "over20_per_km": 3.00, "seats": 3, "icon": "🚗"},
    "standard": {"name": "Standard",       "base": 22.0, "per_km": 2.15, "per_min": 1.45, "min_fare": 35.0, "over20_per_km": 3.00, "seats": 4, "icon": "🚘"},
    "premium":  {"name": "Premium",        "base": 22.0, "per_km": 2.15, "per_min": 1.45, "min_fare": 35.0, "over20_per_km": 3.00, "seats": 4, "icon": "🚙"},
    "van":      {"name": "Van (7-seater)", "base": 42.0, "per_km": 2.00, "per_min": 1.50, "min_fare": 50.0, "over20_per_km": 4.50, "seats": 7, "icon": "🚐"},
}


def to_usd(ttd: float) -> float:
    return round(ttd / TTD_PER_USD, 2)


def rate_card_public() -> list:
    """Rate card for the booking UI (TT$ + USD equivalents)."""
    out = []
    for vid, c in TAXI_RATE_CARD.items():
        out.append({
            "id": vid, "name": c["name"], "icon": c["icon"], "seats": c["seats"],
            "base_ttd": c["base"], "per_km_ttd": c["per_km"], "per_min_ttd": c["per_min"],
            "min_fare_ttd": c["min_fare"],
            "base_usd": to_usd(c["base"]), "per_km_usd": to_usd(c["per_km"]),
        })
    return out


def compute_fare(distance_km: float, duration_min: float, vehicle_type: str) -> Dict:
    """Compute a taxi fare. Returns a breakdown in BOTH TT$ and USD."""
    card = TAXI_RATE_CARD.get(vehicle_type, TAXI_RATE_CARD["standard"])
    distance_km = max(0.0, float(distance_km or 0))
    duration_min = max(0.0, float(duration_min or 0))

    if distance_km <= 20:
        distance_charge = distance_km * card["per_km"]
    else:
        distance_charge = 20 * card["per_km"] + (distance_km - 20) * card["over20_per_km"]
    time_charge = duration_min * card["per_min"]

    metered = card["base"] + distance_charge + time_charge
    fare_ttd = round(max(metered, card["min_fare"]), 2)
    min_applied = metered < card["min_fare"]

    return {
        "vehicle_type": vehicle_type if vehicle_type in TAXI_RATE_CARD else "standard",
        "vehicle_name": card["name"],
        "distance_km": round(distance_km, 2),
        "duration_min": round(duration_min, 1),
        "breakdown_ttd": {
            "base": round(card["base"], 2),
            "distance_charge": round(distance_charge, 2),
            "time_charge": round(time_charge, 2),
            "minimum_fare_applied": min_applied,
        },
        "fare_ttd": fare_ttd,
        "fare_usd": to_usd(fare_ttd),
    }


async def road_distance_duration(
    pickup: Tuple[float, float], dropoff: Tuple[float, float]
) -> Tuple[float, float]:
    """Driving distance (km) and duration (min) via Google Directions API.
    Distance Matrix/Geocode are not enabled on this project, so we use Directions.
    """
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY not configured")
    params = {
        "origin": f"{pickup[0]},{pickup[1]}",
        "destination": f"{dropoff[0]},{dropoff[1]}",
        "mode": "driving",
        "key": key,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get("https://maps.googleapis.com/maps/api/directions/json", params=params)
    data = resp.json()
    if data.get("status") != "OK" or not data.get("routes"):
        raise ValueError(f"Directions API error: {data.get('status')} {data.get('error_message', '')}")
    leg = data["routes"][0]["legs"][0]
    return leg["distance"]["value"] / 1000.0, leg["duration"]["value"] / 60.0

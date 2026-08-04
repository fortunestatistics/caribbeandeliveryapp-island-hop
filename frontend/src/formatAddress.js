// Flexible address helpers — our orders store addresses with mixed key shapes
// ({street, city, country, latitude, longitude, full_address, location, ...}),
// so components must not assume a single key like `street_address`.

export const formatAddress = (addr) => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  const parts = [
    addr.full_address,
    addr.street_address,
    addr.street,
    addr.address_line1 || addr.line1,
    addr.location,
    addr.area,
    addr.city,
    addr.parish || addr.state,
    addr.postal_code,
    addr.country,
  ];
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const v = (p == null ? '' : String(p)).trim();
    if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); out.push(v); }
  }
  return out.join(', ');
};

export const addrCoords = (addr) => {
  if (!addr) return null;
  const lat = addr.latitude ?? addr.lat;
  const lng = addr.longitude ?? addr.lng;
  if (lat == null || lng == null) return null;
  const nlat = Number(lat); const nlng = Number(lng);
  if (Number.isNaN(nlat) || Number.isNaN(nlng)) return null;
  return { lat: nlat, lng: nlng };
};

export const mapsLink = (addr) => {
  const c = addrCoords(addr);
  if (c) return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
  const q = formatAddress(addr);
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
};

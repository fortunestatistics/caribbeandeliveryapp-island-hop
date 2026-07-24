import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'islandhop_cart_v1';

const loadCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
};

// Global multi-store cart. Items are grouped by vendor so one basket can hold
// products from several merchants and check out at once (one order per merchant).
export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (_) { /* storage may be full/blocked */ }
  }, [cart]);

  // vendor: { vendor_id, vendor_name, vendor_type, service_type, delivery_fee, address }
  const addItem = useCallback((vendor, item, qty = 1) => {
    const vid = vendor.vendor_id;
    if (!vid) return;
    setCart((prev) => {
      const group = prev[vid] || { ...vendor, items: [] };
      const existing = group.items.find((i) => String(i.id) === String(item.id));
      const items = existing
        ? group.items.map((i) => (String(i.id) === String(item.id) ? { ...i, quantity: i.quantity + qty } : i))
        : [...group.items, { id: item.id, name: item.name, price: Number(item.price) || 0, quantity: qty }];
      return { ...prev, [vid]: { ...group, ...vendor, items } };
    });
  }, []);

  const setQty = useCallback((vid, itemId, qty) => {
    setCart((prev) => {
      const group = prev[vid];
      if (!group) return prev;
      const items = group.items
        .map((i) => (String(i.id) === String(itemId) ? { ...i, quantity: Math.max(0, qty) } : i))
        .filter((i) => i.quantity > 0);
      if (items.length === 0) {
        const { [vid]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [vid]: { ...group, items } };
    });
  }, []);

  const removeItem = useCallback((vid, itemId) => setQty(vid, itemId, 0), [setQty]);

  const clearVendor = useCallback((vid) => {
    setCart((prev) => {
      const { [vid]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const clear = useCallback(() => setCart({}), []);

  const vendors = useMemo(() => Object.values(cart), [cart]);
  const totalCount = useMemo(
    () => vendors.reduce((s, g) => s + g.items.reduce((n, i) => n + i.quantity, 0), 0),
    [vendors]
  );
  const vendorCount = vendors.length;
  const grandSubtotal = useMemo(
    () => vendors.reduce((s, g) => s + g.items.reduce((n, i) => n + i.price * i.quantity, 0), 0),
    [vendors]
  );

  const value = {
    cart, vendors, addItem, setQty, removeItem, clearVendor, clear,
    totalCount, vendorCount, grandSubtotal,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

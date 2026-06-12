import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  Package,
  ChevronDown,
  Utensils,
  Pill,
  ShoppingBasket,
  Send,
  Car,
  CarFront,
  User,
  Truck,
  Store,
  ShieldCheck,
} from 'lucide-react';

// IslandHop service catalogue surfaced in the top-left brand dropdown.
const SUB_APPS = [
  { id: 'food',       label: 'Food Delivery',  desc: 'Order from local restaurants',  icon: Utensils,       to: '/order/food' },
  { id: 'pharmacy',   label: 'Pharmacy',       desc: 'Prescriptions & wellness',      icon: Pill,           to: '/order/pharmacy' },
  { id: 'groceries',  label: 'Groceries',      desc: 'Fresh produce & essentials',    icon: ShoppingBasket, to: '/order/grocery' },
  { id: 'courier',    label: 'Courier',        desc: 'Send packages island-wide',     icon: Send,           to: '/order/courier' },
  { id: 'taxi',       label: 'Taxi',           desc: 'Premium rides on demand',       icon: Car,            to: '/order/taxi' },
  { id: 'car_rental', label: 'Car Rental',     desc: 'Self-drive across the islands', icon: CarFront,       to: '/car-rental' },
];

// Role-based panels (Super App view-switching).
const ROLE_PANELS = [
  { id: 'public',   label: 'Public Site',    desc: 'Landing page, browse services',     icon: User,        to: '/',                  roles: null /* anyone */ },
  { id: 'driver',   label: 'Driver Panel',   desc: 'Active deliveries & earnings',      icon: Truck,       to: '/driver-dashboard',  roles: ['driver', 'admin'] },
  { id: 'merchant', label: 'Merchant Panel', desc: 'Vendor orders, menu, payouts',      icon: Store,       to: '/vendor-dashboard',  roles: ['restaurant', 'business', 'admin'] },
  { id: 'admin',    label: 'Admin Panel',    desc: 'Users, fraud, claims, analytics',   icon: ShieldCheck, to: '/admin',             roles: ['admin'] },
];

/**
 * Brand button on the top-left of the header. Opens a panel with two
 * sections: role-based panels (Customer / Driver / Merchant / Admin) and the
 * service catalogue (Food, Pharmacy, Groceries, Courier, Taxi, Car Rental).
 * Role-panel entries the current user can't access are dimmed but still
 * clickable (they'll see the polished Forbidden403 page).
 */
const SubAppsDropdown = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const pick = (route) => {
    setOpen(false);
    navigate(route);
  };

  const canAccessRole = (panel) => {
    if (!panel.roles) return true;
    return user ? panel.roles.includes(user.user_type) : false;
  };

  return (
    <div className="relative flex-shrink-0" ref={wrapperRef} data-testid="sub-apps-dropdown">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Choose IslandHop sub-app"
        data-testid="sub-apps-trigger"
        className="flex items-center gap-2 group focus:outline-none"
      >
        <div className="w-10 h-10 bg-gold-gradient rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
          <Package className="h-6 w-6 text-white" />
        </div>
        <div className="hidden sm:block text-left">
          <h1 className="text-xl font-bold text-foreground leading-tight">IslandHop</h1>
          <p className="text-xs text-gold-500 flex items-center gap-1">
            Choose a sub-app <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </p>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          data-testid="sub-apps-menu"
          className="absolute left-0 top-full mt-2 w-[340px] sm:w-[460px] max-h-[80vh] overflow-y-auto bg-matte-900 border border-gold-500/30 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl z-50"
        >
          {/* Role panels section */}
          <div className="p-3 border-b border-matte-800/80">
            <p className="text-xs uppercase tracking-wider text-gold-500 font-semibold">Panels</p>
            <p className="text-sm text-muted-foreground mt-0.5">Switch between roles</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2">
            {ROLE_PANELS.map((panel) => {
              const Icon = panel.icon;
              const allowed = canAccessRole(panel);
              return (
                <button
                  key={panel.id}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(panel.to)}
                  data-testid={`sub-app-panel-${panel.id}`}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left hover:bg-matte-800/80 transition-colors group ${allowed ? '' : 'opacity-50'}`}
                  title={allowed ? '' : 'Restricted to specific roles'}
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-gold-500/20 transition-colors">
                    <Icon className="h-5 w-5 text-gold-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{panel.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{panel.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Services section */}
          <div className="p-3 border-t border-b border-matte-800/80 bg-matte-900/40">
            <p className="text-xs uppercase tracking-wider text-gold-500 font-semibold">Services</p>
            <p className="text-sm text-muted-foreground mt-0.5">Pick what you want to order</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2">
            {SUB_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(app.to)}
                  data-testid={`sub-app-${app.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl text-left hover:bg-matte-800/80 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-gold-500/20 transition-colors">
                    <Icon className="h-5 w-5 text-gold-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{app.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubAppsDropdown;

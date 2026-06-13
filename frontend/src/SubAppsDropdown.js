import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  Package,
  ChevronDown,
  User,
  Truck,
  Store,
  ShieldCheck,
} from 'lucide-react';

// Role-based panels surfaced from the top-left brand dropdown.
// `roles: null` = anyone (including logged-out visitors) can access.
const ROLE_PANELS = [
  { id: 'customer', label: 'Customer',  desc: 'Orders, wallet, claims & rewards', icon: User,        to: '/dashboard',         roles: null /* anyone */ },
  { id: 'driver',   label: 'Driver',    desc: 'Active deliveries & earnings',     icon: Truck,       to: '/driver-dashboard',  roles: ['driver', 'admin'] },
  { id: 'merchant', label: 'Merchant',  desc: 'Vendor orders, menu, payouts',     icon: Store,       to: '/vendor-dashboard',  roles: ['restaurant', 'business', 'admin'] },
  { id: 'admin',    label: 'Admin',     desc: 'Users, fraud, claims, analytics',  icon: ShieldCheck, to: '/admin',             roles: ['admin'] },
];

/**
 * Brand button on the top-left of the header. Opens a dropdown listing the
 * four IslandHop role panels (Customer / Driver / Merchant / Admin).
 * Panels the current user can't access are dimmed but still clickable —
 * they'll see the Forbidden403 page.
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

  const canAccess = (panel) => {
    if (!panel.roles) return true;
    return user ? panel.roles.includes(user.user_type) : false;
  };

  return (
    <div className="relative flex-shrink-0" ref={wrapperRef} data-testid="sub-apps-dropdown">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Choose IslandHop panel"
        data-testid="sub-apps-trigger"
        className="flex items-center gap-2 group focus:outline-none"
      >
        <div className="w-10 h-10 bg-gold-gradient rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
          <Package className="h-6 w-6 text-white" />
        </div>
        <div className="hidden sm:block text-left">
          <h1 className="text-xl font-bold text-foreground leading-tight">IslandHop</h1>
          <p className="text-xs text-gold-500 flex items-center gap-1">
            Choose a panel <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </p>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          data-testid="sub-apps-menu"
          className="absolute left-0 top-full mt-2 w-[320px] sm:w-[420px] bg-matte-900 border border-gold-500/30 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl z-50 overflow-hidden"
        >
          <div className="p-3 border-b border-matte-800/80">
            <p className="text-xs uppercase tracking-wider text-gold-500 font-semibold">Panels</p>
            <p className="text-sm text-muted-foreground mt-0.5">Switch between roles</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2">
            {ROLE_PANELS.map((panel) => {
              const Icon = panel.icon;
              const allowed = canAccess(panel);
              const isCurrent = user && panel.roles && panel.roles.includes(user.user_type);
              return (
                <button
                  key={panel.id}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(panel.to)}
                  data-testid={`sub-app-panel-${panel.id}`}
                  title={allowed ? '' : 'Restricted to specific roles'}
                  className={`relative flex items-center gap-3 p-3 rounded-xl text-left hover:bg-matte-800/80 transition-colors group ${allowed ? '' : 'opacity-50'}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-gold-500/20 transition-colors">
                    <Icon className="h-5 w-5 text-gold-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      {panel.label}
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider bg-gold-500/15 text-gold-500 px-1.5 py-0.5 rounded">You</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{panel.desc}</p>
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

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel,
} from './components/ui/dropdown-menu';
import { Button } from './components/ui/button';
import { Repeat, Check, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_LABELS = { customer: 'Customer', driver: 'Driver', business: 'Merchant', restaurant: 'Merchant' };
const ROLE_DASH = { customer: '/dashboard', driver: '/driver-dashboard', business: '/vendor-dashboard', restaurant: '/vendor-dashboard' };

const RoleSwitcher = () => {
  const { user, refreshUser, impersonation } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [active, setActive] = useState(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancel = false;
    const load = async () => {
      if (!user?.id) { setRoles([]); return; }
      try {
        const r = await axios.get(`${API}/users/available-roles`, { withCredentials: true });
        if (cancel) return;
        setRoles(r.data.available_roles || []);
        setActive(r.data.active_role);
      } catch (e) { /* ignore */ }
    };
    load();
    return () => { cancel = true; };
  }, [user?.id, user?.user_type]);

  // Hide while impersonating or when the account has only one role.
  if (impersonation || roles.length < 2) return null;

  const switchTo = async (role) => {
    if (role === active) return;
    setSwitching(true);
    try {
      await axios.post(`${API}/users/switch-role`, { role }, { withCredentials: true });
      setActive(role);
      if (refreshUser) await refreshUser();
      navigate(ROLE_DASH[role] || '/dashboard');
    } catch (e) { /* ignore */ } finally { setSwitching(false); }
  };

  const label = (r) => ROLE_LABELS[r] || r;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="role-switcher-trigger">
          {switching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Repeat className="h-4 w-4 mr-1" />}
          {label(active)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="role-switcher-menu">
        <DropdownMenuLabel>Switch role</DropdownMenuLabel>
        {roles.map((r) => (
          <DropdownMenuItem
            key={r}
            onClick={() => switchTo(r)}
            data-testid={`role-switch-${r}`}
            className="flex items-center justify-between"
          >
            {label(r)}
            {r === active && <Check className="h-4 w-4 text-green-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;

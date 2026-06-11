import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode, MODES } from './ModeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { User, Car, Store, Shield, ChevronDown, Plus } from 'lucide-react';

const MODE_META = {
  [MODES.CUSTOMER]: { label: 'Customer', icon: User, route: '/dashboard' },
  [MODES.DRIVER]: { label: 'Driver', icon: Car, route: '/driver-dashboard' },
  [MODES.MERCHANT]: { label: 'Merchant', icon: Store, route: '/vendor-dashboard' },
  [MODES.ADMIN]: { label: 'Admin', icon: Shield, route: '/admin' },
};

/**
 * Top-nav dropdown that lets a user toggle between the modes (Customer / Driver /
 * Merchant / Admin) they are authorized for. Unauthorized modes appear as
 * "Apply to drive" / "Become a partner" CTAs that navigate to onboarding.
 */
const ModeSwitcher = () => {
  const navigate = useNavigate();
  const { mode, setMode, authorizedModes, modesLoading } = useMode();

  if (modesLoading) return null;

  const current = MODE_META[mode] || MODE_META[MODES.CUSTOMER];
  const Icon = current.icon;

  const handleSwitch = (target) => {
    setMode(target);
    const meta = MODE_META[target];
    if (meta?.route) navigate(meta.route);
  };

  const renderModeItem = (key) => {
    const meta = MODE_META[key];
    const M = meta.icon;
    const allowed = !!authorizedModes[key];
    const isActive = mode === key;
    return (
      <DropdownMenuItem
        key={key}
        data-testid={`mode-switch-${key}`}
        disabled={isActive}
        onClick={() => (allowed ? handleSwitch(key) : navigate(key === MODES.DRIVER ? '/driver' : '/partner'))}
        className={`gap-2 ${isActive ? 'bg-gold-500/10 text-gold-500' : ''}`}
      >
        <M className="h-4 w-4" />
        <span className="flex-1">{meta.label}</span>
        {!allowed && key !== MODES.CUSTOMER && (
          <Badge variant="outline" className="text-xs ml-2">
            <Plus className="h-3 w-3 mr-1" /> Apply
          </Badge>
        )}
        {isActive && <Badge className="ml-2 bg-gold-500/15 text-gold-500 text-xs">Active</Badge>}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="mode-switcher-trigger"
          className="gap-2 border-gold-500/30"
        >
          <Icon className="h-4 w-4 text-gold-500" />
          <span className="hidden sm:inline">{current.label}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderModeItem(MODES.CUSTOMER)}
        {renderModeItem(MODES.DRIVER)}
        {renderModeItem(MODES.MERCHANT)}
        {authorizedModes.admin && (
          <>
            <DropdownMenuSeparator />
            {renderModeItem(MODES.ADMIN)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ModeSwitcher;

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { MapPin, Navigation, Truck } from 'lucide-react';

const STORAGE_KEY = 'islandhop_location_consent';
const LocationConsentContext = createContext(null);

export const useLocationConsent = () => {
  const ctx = useContext(LocationConsentContext);
  if (!ctx) throw new Error('useLocationConsent must be used within LocationConsentProvider');
  return ctx;
};

export const LocationConsentProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef(null);

  // Returns a Promise<boolean>; true once the user has accepted the disclosure.
  const requestLocationConsent = useCallback(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'granted') {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const settle = useCallback((granted) => {
    if (granted) localStorage.setItem(STORAGE_KEY, 'granted');
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(granted);
      resolverRef.current = null;
    }
  }, []);

  return (
    <LocationConsentContext.Provider value={{ requestLocationConsent }}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) settle(false); }}>
        <DialogContent className="max-w-md" data-testid="location-disclosure-modal">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15">
              <MapPin className="h-7 w-7 text-gold-500" />
            </div>
            <DialogTitle className="text-center text-xl" data-testid="location-disclosure-title">
              IslandHop Uses Your Location
            </DialogTitle>
            <DialogDescription className="text-center" data-testid="location-disclosure-text">
              IslandHop collects location data to enable live delivery tracking, driver dispatch,
              and address auto-fill — <span className="font-semibold text-foreground">even when the app is
              closed or not in use</span> — so drivers and customers can see delivery progress in real time.
              By tapping <span className="font-semibold text-foreground">Accept</span> you consent to this
              collection and use of your location.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
              <p className="text-sm text-muted-foreground">Match you with nearby drivers and dispatch orders efficiently.</p>
            </div>
            <div className="flex items-start gap-3">
              <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
              <p className="text-sm text-muted-foreground">Show live, turn-by-turn delivery tracking on the map.</p>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
              <p className="text-sm text-muted-foreground">Auto-fill your delivery address and confirm proof of delivery.</p>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can change this anytime in your device settings. See our{' '}
            <a href="/privacy-policy" target="_blank" rel="noreferrer" className="text-gold-500 underline" data-testid="location-disclosure-privacy-link">Privacy Policy</a>.
          </p>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => settle(false)}
              data-testid="location-disclosure-decline-btn"
            >
              Not Now
            </Button>
            <Button
              className="flex-1 bg-gold-gradient text-white"
              onClick={() => settle(true)}
              data-testid="location-disclosure-accept-btn"
            >
              Accept
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </LocationConsentContext.Provider>
  );
};

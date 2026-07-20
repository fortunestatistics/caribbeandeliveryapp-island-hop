import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// All catalog/order/subscription prices in the app are authored in USD.
// We DISPLAY in TT$ by default (Trinidad), with a US$ toggle.
export const RATE_TTD_PER_USD = 6.78;
const STORAGE_KEY = 'display_currency';
const SYMBOLS = { TTD: 'TT$', USD: 'US$' };

const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrencyState] = useState(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'TTD';
    return saved === 'USD' ? 'USD' : 'TTD';
  });

  const setCurrency = useCallback((c) => {
    const next = c === 'USD' ? 'USD' : 'TTD';
    setCurrencyState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
  }, []);

  const convert = useCallback((usd) => {
    const n = Number(usd) || 0;
    return currency === 'TTD' ? n * RATE_TTD_PER_USD : n;
  }, [currency]);

  const format = useCallback((usd, { decimals = 2 } = {}) => {
    const value = convert(usd);
    const str = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${SYMBOLS[currency]}${str}`;
  }, [convert, currency]);

  const value = useMemo(() => ({
    currency, setCurrency, convert, format,
    symbol: SYMBOLS[currency], rate: RATE_TTD_PER_USD,
  }), [currency, setCurrency, convert, format]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Safe fallback if used outside provider (renders raw USD).
    return {
      currency: 'USD', setCurrency: () => {}, convert: (u) => Number(u) || 0,
      format: (u, o = {}) => `US$${(Number(u) || 0).toFixed(o.decimals ?? 2)}`,
      symbol: 'US$', rate: RATE_TTD_PER_USD,
    };
  }
  return ctx;
};

// Inline formatted price. `usd` is the base USD amount.
export const Price = ({ usd, decimals = 2, className, 'data-testid': testId }) => {
  const { format } = useCurrency();
  return <span className={className} data-testid={testId}>{format(usd, { decimals })}</span>;
};

// Navbar TT$ / US$ switcher.
export const CurrencySwitcher = ({ className = '' }) => {
  const { currency, setCurrency } = useCurrency();
  return (
    <div
      className={`inline-flex rounded-full border border-border overflow-hidden text-xs font-semibold ${className}`}
      data-testid="currency-switcher"
    >
      {['TTD', 'USD'].map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          data-testid={`currency-option-${c}`}
          className={`px-2.5 py-1.5 transition-colors ${
            currency === c ? 'bg-gold-gradient text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {SYMBOLS[c]}
        </button>
      ))}
    </div>
  );
};

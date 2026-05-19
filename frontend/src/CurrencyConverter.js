import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { ArrowLeftRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Module-level cache so multiple converters on a page share one fetch
let _ratesCache = null;
let _ratesPromise = null;
const fetchRates = () => {
  if (_ratesCache) return Promise.resolve(_ratesCache);
  if (_ratesPromise) return _ratesPromise;
  _ratesPromise = axios.get(`${API}/currency/rates?base=USD`)
    .then((r) => { _ratesCache = r.data.rates; return _ratesCache; })
    .catch(() => ({ USD: 1, TTD: 6.78, JMD: 158.4 }));
  return _ratesPromise;
};

/**
 * Drop-in currency converter widget for IslandHop. Shows the amount in TTD
 * (Trinidad — launch market) and USD by default, with an arrow to flip the
 * base. Use it next to any total/price.
 *
 * Props:
 *  - amountUSD: number  (the amount expressed in USD)
 *  - className: optional extra classes
 *  - size: 'sm' | 'md' | 'lg'  (default 'md')
 */
const CurrencyConverter = ({ amountUSD = 0, className = '', size = 'md' }) => {
  const [rates, setRates] = useState(_ratesCache);
  const [primary, setPrimary] = useState('TTD'); // Trinidad first
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!rates) {
      fetchRates().then((r) => { if (mounted.current) setRates(r); });
    }
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rates) {
    return null; // silent until rates load — we don't want layout flash
  }

  const ttd = (Number(amountUSD) || 0) * (rates.TTD || 0);
  const usd = Number(amountUSD) || 0;
  const fmt = (n, code) => `${code} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

  const secondary = primary === 'TTD' ? 'USD' : 'TTD';
  const primaryAmount = primary === 'TTD' ? ttd : usd;
  const secondaryAmount = primary === 'TTD' ? usd : ttd;

  const textSizes = {
    sm: { primary: 'text-base', secondary: 'text-xs' },
    md: { primary: 'text-lg', secondary: 'text-sm' },
    lg: { primary: 'text-2xl', secondary: 'text-base' },
  }[size] || { primary: 'text-lg', secondary: 'text-sm' };

  const swap = () => setPrimary(secondary);

  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      data-testid="currency-converter"
    >
      <div className="flex flex-col items-end leading-tight">
        <span className={`${textSizes.primary} font-bold text-gold-gradient`} data-testid="currency-primary">
          {fmt(primaryAmount, primary)}
        </span>
        <span className={`${textSizes.secondary} text-muted-foreground`} data-testid="currency-secondary">
          ≈ {fmt(secondaryAmount, secondary)}
        </span>
      </div>
      <button
        type="button"
        onClick={swap}
        className="p-1.5 rounded-full border border-gold-500/30 text-gold-300 hover:bg-gold-500/10 hover:border-gold-500 transition-colors"
        aria-label={`Swap to ${secondary}`}
        title={`Swap to ${secondary}`}
        data-testid="currency-swap-btn"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default CurrencyConverter;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp } from 'lucide-react';
import { useCurrency } from './CurrencyContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Live social proof for the homepage incentives widget — shows the top promoter's
// earnings this month (first name only). Renders nothing until there is real data.
const PromoterSocialProof = () => {
  const { format } = useCurrency();
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/promoter/social-proof`)
      .then((r) => setData(r.data))
      .catch((err) => console.error('social-proof fetch failed:', err));
  }, []);

  if (!data || !data.has_data) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full bg-green-500/15 border border-green-500/30 px-3 py-1.5 text-sm text-white mt-3"
      data-testid="promoter-social-proof"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <TrendingUp className="h-4 w-4 text-green-400" />
      <span>
        <span className="font-semibold">{data.top_name}</span> earned{' '}
        <span className="font-semibold text-gold-400">{format(data.top_earnings)}</span> this month
        {data.onboards_this_month ? ` · ${data.onboards_this_month} new sign-ups` : ''}
      </span>
    </div>
  );
};

export default PromoterSocialProof;

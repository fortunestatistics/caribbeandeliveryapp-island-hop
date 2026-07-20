import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Megaphone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const SponsoredAds = () => {
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);

  useEffect(() => {
    axios.get(`${API}/ads/active?placement=homepage&limit=6`)
      .then((res) => setAds(res.data || []))
      .catch(() => setAds([]));
  }, []);

  if (!ads.length) return null;

  const openAd = (ad) => {
    axios.post(`${API}/ads/${ad.id}/click`).catch(() => {});
    const url = ad.cta_url || `/restaurant/${ad.vendor_id}`;
    if (url.startsWith('http')) window.open(url, '_blank');
    else navigate(url);
  };

  return (
    <section className="py-16 bg-matte-900" data-testid="sponsored-ads-section">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-6">
          <Megaphone className="h-5 w-5 text-gold-500" />
          <h2 className="text-lg font-semibold text-secondary">Sponsored Partners</h2>
          <span className="text-xs text-muted-foreground ml-auto">Advertisement</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ads.map((ad) => (
            <button
              key={ad.id}
              onClick={() => openAd(ad)}
              data-testid={`sponsored-ad-${ad.id}`}
              className="group relative text-left rounded-2xl overflow-hidden border border-gold-500/20 bg-matte-800 hover:border-gold-500/50 hover:-translate-y-1 transition-all duration-300"
            >
              <div className="h-40 w-full overflow-hidden bg-matte-700">
                <img src={ad.image} alt={ad.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wide bg-black/60 text-white px-2 py-0.5 rounded-full">Ad</span>
              <div className="p-4">
                <p className="font-semibold text-secondary line-clamp-1">{ad.title}</p>
                {ad.merchant_name && <p className="text-sm text-muted-foreground mt-0.5">{ad.merchant_name}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SponsoredAds;

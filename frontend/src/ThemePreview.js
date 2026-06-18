import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Star, Clock, ShoppingBag, Pill, Car, Package, Bike, Truck, ArrowRight, MapPin } from 'lucide-react';

// ===== Light marketplace palette options =====
const PALETTES = {
  '2': {
    label: 'Caribbean Energetic',
    bg: '#FFFCF9', surface: '#FDF9F3', surfaceElevated: '#FDEEDC',
    primary: '#0369A1', primaryGrad: 'linear-gradient(135deg, #0369A1 0%, #0284C7 100%)',
    accent: '#F97316', textMain: '#1E293B', textMuted: '#64748B', border: '#E5E7EB', success: '#10B981',
    headFont: "'Manrope',sans-serif", bodyFont: "'Figtree','Manrope',sans-serif",
    badge: "🌴 Trinidad & Tobago’s Super App", cardShadow: 'rgba(249,115,22,0.14)',
  },
  '3': {
    label: 'Fresh & Crisp',
    bg: '#F8FAFC', surface: '#FFFFFF', surfaceElevated: '#F0FDF4',
    primary: '#064E3B', primaryGrad: 'linear-gradient(135deg, #064E3B 0%, #047857 100%)',
    accent: '#10B981', textMain: '#022C22', textMuted: '#475569', border: '#CBD5E1', success: '#059669',
    headFont: "'Manrope',sans-serif", bodyFont: "'Figtree','Manrope',sans-serif",
    badge: "🌿 Fresh from across the island", cardShadow: 'rgba(6,78,59,0.12)',
  },
};

const HERO_IMG = 'https://images.unsplash.com/photo-1770679646453-34641c08c570?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwyfHxwZXJzb24lMjBmb29kJTIwZGVsaXZlcnklMjBzdW5ueXxlbnwwfHx8fDE3ODE4MTQ1MjV8MA&ixlib=rb-4.1.0&q=85';

const RESTAURANTS = [
  { name: 'Roti Hut', cat: 'Caribbean · Curry', rating: 4.8, time: '20-30 min', img: 'https://images.pexels.com/photos/13443799/pexels-photo-13443799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
  { name: 'Island Greens', cat: 'Healthy · Bowls', rating: 4.7, time: '15-25 min', img: 'https://images.pexels.com/photos/19138180/pexels-photo-19138180.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
  { name: 'Tropic Juice Bar', cat: 'Smoothies · Fruit', rating: 4.9, time: '10-20 min', img: 'https://images.pexels.com/photos/30741639/pexels-photo-30741639.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
];

export default function ThemePreview() {
  const { search } = useLocation();
  const opt = new URLSearchParams(search).get('opt') === '3' ? '3' : '2';
  const C = PALETTES[opt];

  const SERVICES = [
    { name: 'Food Delivery', desc: 'Order from local favourites', Icon: ShoppingBag, tint: C.accent },
    { name: 'Pharmacy', desc: 'Meds delivered fast', Icon: Pill, tint: C.primary },
    { name: 'Groceries', desc: 'Fresh tropical produce', Icon: Package, tint: C.success },
    { name: 'Courier', desc: 'Send anything, anywhere', Icon: Bike, tint: '#8B5CF6' },
    { name: 'Taxi', desc: 'Rides across the island', Icon: Car, tint: '#EAB308' },
    { name: 'Car Rental', desc: 'Drive on your terms', Icon: Truck, tint: '#EF4444' },
  ];

  return (
    <div style={{ background: C.bg, color: C.textMain, fontFamily: C.bodyFont, minHeight: '100vh' }} data-testid={`theme-preview-option${opt}`}>
      {/* Header (glassmorphism) */}
      <header
        style={{ background: `${C.bg}BF`, borderBottom: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}
        className="sticky top-0 z-50 px-6 lg:px-12 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div style={{ background: C.accent }} className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold">IH</div>
          <span style={{ fontFamily: C.headFont, color: C.primary }} className="text-xl font-extrabold tracking-tight">IslandHop</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold" style={{ color: C.textMuted }}>
          <span>Services</span><span>Restaurants</span><span>Partner</span><span>Pricing</span>
        </nav>
        <div className="flex items-center gap-3">
          <button style={{ color: C.primary }} className="text-sm font-semibold px-4 py-2">Log in</button>
          <button style={{ background: C.accent, color: '#fff' }} className="text-sm font-bold px-5 py-2.5 rounded-full" >Sign up</button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 lg:px-12 pt-12 pb-10 grid lg:grid-cols-2 gap-10 items-center max-w-7xl mx-auto">
        <div>
          <span style={{ background: C.surfaceElevated, color: C.accent }} className="inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-5">{C.badge}</span>
          <h1 style={{ fontFamily: C.headFont, color: C.textMain }} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Everything you need,<br /><span style={{ color: C.accent }}>delivered to your door.</span>
          </h1>
          <p style={{ color: C.textMuted }} className="mt-5 text-base sm:text-lg max-w-md">
            Food, groceries, pharmacy, courier, taxi &amp; car rental — one app for the whole island.
          </p>
          {/* Search bar */}
          <div style={{ background: '#fff', border: `1px solid ${C.border}` }} className="mt-7 flex items-center gap-2 rounded-full p-1.5 pl-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] max-w-lg">
            <MapPin size={18} style={{ color: C.textMuted }} />
            <input
              placeholder="Enter your delivery address"
              style={{ color: C.textMain }}
              className="flex-1 bg-transparent outline-none text-sm py-2"
            />
            <button style={{ background: C.primary, color: '#fff' }} className="rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-1.5">
              <Search size={16} /> Find
            </button>
          </div>
          <div className="flex items-center gap-6 mt-7 text-sm" style={{ color: C.textMuted }}>
            <div><span style={{ color: C.textMain }} className="font-extrabold text-lg">50k+</span> orders</div>
            <div><span style={{ color: C.textMain }} className="font-extrabold text-lg">1,200+</span> partners</div>
            <div className="flex items-center gap-1"><Star size={16} fill={C.accent} color={C.accent} /><span style={{ color: C.textMain }} className="font-extrabold text-lg">4.9</span></div>
          </div>
        </div>
        <div className="relative">
          <img src={HERO_IMG} alt="Delivery" className="rounded-3xl w-full h-[380px] object-cover shadow-[0_20px_60px_rgba(15,23,42,0.15)]" />
          <div style={{ background: '#fff', border: `1px solid ${C.border}` }} className="absolute -bottom-5 -left-3 rounded-2xl px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.12)] flex items-center gap-3">
            <div style={{ background: C.success }} className="w-10 h-10 rounded-full flex items-center justify-center text-white"><Truck size={18} /></div>
            <div>
              <p style={{ color: C.textMain }} className="text-sm font-bold">Arriving in 12 min</p>
              <p style={{ color: C.textMuted }} className="text-xs">Your driver is on the way</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <h2 style={{ fontFamily: C.headFont }} className="text-2xl font-extrabold mb-1">What can we get you?</h2>
        <p style={{ color: C.textMuted }} className="text-sm mb-8">Pick a service to get started</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {SERVICES.map(({ name, desc, Icon, tint }) => (
            <div key={name} style={{ background: '#fff', border: `1px solid ${C.border}` }} className="rounded-2xl p-5 transition-all hover:-translate-y-1 cursor-pointer" >
              <div style={{ background: `${tint}1A`, color: tint }} className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"><Icon size={22} /></div>
              <p style={{ color: C.textMain }} className="font-bold text-sm">{name}</p>
              <p style={{ color: C.textMuted }} className="text-xs mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular restaurants */}
      <section style={{ background: C.surface }} className="px-6 lg:px-12 py-14">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 style={{ fontFamily: C.headFont }} className="text-2xl font-extrabold">Popular near you</h2>
            <button style={{ color: C.primary }} className="text-sm font-bold flex items-center gap-1">See all <ArrowRight size={16} /></button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {RESTAURANTS.map(({ name, cat, rating, time, img }) => (
              <div key={name} style={{ background: '#fff', border: `1px solid ${C.border}` }} className="rounded-2xl overflow-hidden transition-all hover:-translate-y-1 cursor-pointer">
                <img src={img} alt={name} className="w-full h-44 object-cover" />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <p style={{ color: C.textMain }} className="font-bold">{name}</p>
                    <span style={{ background: C.surfaceElevated, color: C.accent }} className="text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><Star size={12} fill={C.accent} color={C.accent} />{rating}</span>
                  </div>
                  <p style={{ color: C.textMuted }} className="text-xs mt-1">{cat}</p>
                  <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: C.textMuted }}>
                    <Clock size={13} /> {time} · Free delivery
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="px-6 lg:px-12 py-16">
        <div style={{ background: C.primaryGrad }} className="max-w-7xl mx-auto rounded-3xl px-8 py-12 text-center text-white relative overflow-hidden">
          <h2 style={{ fontFamily: C.headFont }} className="text-3xl font-extrabold">Earn with IslandHop</h2>
          <p className="mt-3 text-white/85 max-w-md mx-auto">Become a driver or partner your business — start earning across Trinidad &amp; Tobago today.</p>
          <div className="flex items-center justify-center gap-3 mt-7">
            <button style={{ background: C.accent }} className="px-6 py-3 rounded-full font-bold shadow-lg">Become a driver</button>
            <button style={{ background: '#fff', color: C.primary }} className="px-6 py-3 rounded-full font-bold">Partner with us</button>
          </div>
        </div>
      </section>
    </div>
  );
}

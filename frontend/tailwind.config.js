/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        /* NOTE: "Caribbean Sunshine" light theme — legacy palette names are intentionally
           reused so we don't have to touch ~130 files. Remapped to LIGHT surfaces:
           matte-900 = warm off-white page bg, matte-800 = white card, matte-700 = subtle surface.
           gold = vivid sunset orange (CTAs), neon.cyan = bright teal, navy = deep rich brand navy. */
        matte: {
          '700': '#EEF2F7',
          '800': '#FFFFFF',
          '900': '#FFFCF9'
        },
        navy: {
          '500': '#0B2C54',
          '700': '#072442',
          '900': '#04162B'
        },
        gold: {
          '300': '#FFB37A',
          '400': '#FF8A3D',
          '500': '#FF6A00',
          '700': '#E85D00'
        },
        neon: {
          cyan: '#06D6BE'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FF8A3D 0%, #FF6A00 55%, #E85D00 100%)',
        'gold-gradient-hover': 'linear-gradient(135deg, #FFA45C 0%, #FF7A1A 55%, #F2630A 100%)',
        'navy-gradient': 'linear-gradient(135deg, #0B2C54 0%, #072442 100%)'
      },
      boxShadow: {
        'gold-glow': '0 0 18px rgba(255, 106, 0, 0.45)',
        'gold-glow-lg': '0 0 34px rgba(255, 106, 0, 0.6)',
        'cyan-pulse': '0 0 22px rgba(6, 214, 190, 0.65)',
        'card-hover': '0 16px 44px -12px rgba(11, 44, 84, 0.22)'
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        sans: ['Manrope', 'sans-serif']
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'pulse-cyan': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(45, 212, 191, 0.6)' },
          '50%': { opacity: '.5', boxShadow: '0 0 10px rgba(45, 212, 191, 0.2)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-cyan': 'pulse-cyan 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};

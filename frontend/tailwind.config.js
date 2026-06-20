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
        /* NOTE: "Midnight Tropical" theme — legacy palette names are intentionally
           reused so we didn't have to touch ~130 files. Actual colors:
           matte = deep navy/charcoal, gold = sunset orange, neon.cyan = teal. */
        matte: {
          '700': '#1C3A52',
          '800': '#102433',
          '900': '#0A1824'
        },
        gold: {
          '300': '#FDBA74',
          '500': '#F97316',
          '700': '#EA580C'
        },
        neon: {
          cyan: '#2DD4BF'
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
        'gold-gradient': 'linear-gradient(135deg, #FDBA74 0%, #F97316 55%, #EA580C 100%)',
        'gold-gradient-hover': 'linear-gradient(135deg, #FED7AA 0%, #FB8C3C 55%, #F2630A 100%)'
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(249, 115, 22, 0.4)',
        'gold-glow-lg': '0 0 30px rgba(249, 115, 22, 0.55)',
        'cyan-pulse': '0 0 20px rgba(45, 212, 191, 0.6)',
        'card-hover': '0 10px 40px -10px rgba(0,0,0,0.55)'
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

import confetti from 'canvas-confetti';

// Midnight Tropical palette — sunset orange + teal + tropical accents.
const ISLANDHOP_COLORS = ['#F97316', '#FDBA74', '#2DD4BF', '#FB8C3C', '#34D399', '#FFFFFF'];

/**
 * Fire a brand-on celebration burst — used when a customer's order
 * transitions to "delivered". Safe no-op on SSR or canvas-less browsers.
 */
export const celebrate = () => {
  try {
    // Center burst
    confetti({
      particleCount: 120,
      spread: 75,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.55 },
      colors: ISLANDHOP_COLORS,
      zIndex: 9999,
    });
    // Side bursts for symmetry
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60,  spread: 55, origin: { x: 0,   y: 0.7 }, colors: ISLANDHOP_COLORS, zIndex: 9999 });
      confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1,   y: 0.7 }, colors: ISLANDHOP_COLORS, zIndex: 9999 });
    }, 250);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Confetti unavailable:', err?.message || err);
    }
  }
};

export default celebrate;

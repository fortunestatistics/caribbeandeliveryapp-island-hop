import React, { useEffect, useRef, useState } from 'react';

/**
 * Counts smoothly from 0 → target whenever the element enters the viewport.
 * `suffix` lets you tack on "+", "K+", etc. without re-rendering the number.
 */
const AnimatedCounter = ({ value, suffix = '', durationMs = 1500, className = '', testid }) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            setShown(Math.round(value * eased));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, durationMs]);

  const formatted = shown >= 1000 ? `${Math.floor(shown / 1000)}K` : shown.toString();
  return (
    <span ref={ref} className={className} data-testid={testid}>
      {formatted}{suffix}
    </span>
  );
};

export default AnimatedCounter;

"use client";

import { useState, useEffect, useRef } from "react";

export function useCountUp(target: number, duration: number = 1200) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + diff * eased);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
        prevTarget.current = target;
      }
    }

    rafId.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId.current);
    };
  }, [target, duration]);

  return value;
}

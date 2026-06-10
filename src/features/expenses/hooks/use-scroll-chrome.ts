"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollChrome() {
  const [showBottomBar, setShowBottomBar] = useState(true);
  const [compactHeader, setCompactHeader] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const nearBottom =
        window.innerHeight + currentY >= document.documentElement.scrollHeight - 96;

      setCompactHeader(currentY > 36);

      if (currentY < 80 || nearBottom || delta < -8) {
        setShowBottomBar(true);
      } else if (delta > 8) {
        setShowBottomBar(false);
      }

      lastScrollY.current = currentY;
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { compactHeader, showBottomBar };
}

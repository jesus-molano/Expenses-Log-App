"use client";

import { useEffect, useState } from "react";

export function useCompactChart() {
  const [isCompactChart, setIsCompactChart] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 520px)");
    const update = () => setIsCompactChart(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isCompactChart;
}

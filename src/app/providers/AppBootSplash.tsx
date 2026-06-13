"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const BOOT_SPLASH_KEY = "expense-boot-splash-seen";

export function AppBootSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(BOOT_SPLASH_KEY) === "true") return;

    sessionStorage.setItem(BOOT_SPLASH_KEY, "true");
    let timer: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
      timer = window.setTimeout(() => setVisible(false), 720);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="app-boot-splash" aria-hidden="true">
      <div className="app-boot-logo">
        <Image
          src="/icon-512.png"
          alt=""
          width={512}
          height={512}
          priority
        />
      </div>
      <div className="app-boot-bar" />
    </div>
  );
}

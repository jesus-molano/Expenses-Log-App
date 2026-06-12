"use client";

import { useEffect } from "react";

type BodyScrollLockStrategy = "overflow" | "fixed";

type UseBodyScrollLockOptions = {
  strategy?: BodyScrollLockStrategy;
};

export function useBodyScrollLock(
  active: boolean,
  { strategy = "overflow" }: UseBodyScrollLockOptions = {},
) {
  useEffect(() => {
    if (!active) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (strategy === "fixed") {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      return () => {
        document.documentElement.style.overflow = previousHtmlOverflow;
        document.body.style.overflow = previousBodyStyle.overflow;
        document.body.style.position = previousBodyStyle.position;
        document.body.style.top = previousBodyStyle.top;
        document.body.style.width = previousBodyStyle.width;
        window.scrollTo(0, scrollY);
      };
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyStyle.overflow;
    };
  }, [active, strategy]);
}

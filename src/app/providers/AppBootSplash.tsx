"use client";

import Image from "next/image";

export function AppBootSplash({ exiting = false }: { exiting?: boolean }) {
  return (
    <div
      className="app-boot-splash"
      data-state={exiting ? "exiting" : "visible"}
      aria-hidden="true"
    >
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

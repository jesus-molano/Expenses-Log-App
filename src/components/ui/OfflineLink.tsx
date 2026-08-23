"use client";

import Link from "next/link";

type OfflineLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function OfflineLink({ href, onClick, ...props }: OfflineLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          navigator.onLine ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        window.location.assign(href);
      }}
    />
  );
}

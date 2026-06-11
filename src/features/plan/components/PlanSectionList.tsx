"use client";

import type { ReactNode } from "react";

export function PlanSectionList({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-3">
      <h4 className="text-sm font-semibold text-[var(--app-text)]">{title}</h4>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

export function PlanEmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-[var(--app-panel-soft-alpha)] px-3 py-2 text-sm font-medium text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)]">
      {children}
    </p>
  );
}

"use client";

import type { ComponentType, ReactNode } from "react";
import { Surface } from "@/components/ui/Surface";

export function PlanSectionList({
  title,
  icon: Icon,
  tone = "default",
  children,
}: {
  title: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "success" | "danger";
  children: ReactNode;
}) {
  const iconTone = {
    default: "text-[var(--app-text-muted)]",
    success: "text-[var(--app-success)]",
    danger: "text-[var(--app-danger)]",
  }[tone];

  return (
    <section className="mt-9">
      <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-[var(--app-text)]">
        <span>{title}</span>
        {Icon ? (
          <span
            className={`app-section-list-icon grid size-5 place-items-center rounded-full ${iconTone}`}
          >
            <Icon size={13} />
          </span>
        ) : null}
      </h3>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

export function PlanEmptyLine({ children }: { children: ReactNode }) {
  return (
    <Surface variant="empty" className="px-3 py-2 text-sm font-medium">
      {children}
    </Surface>
  );
}

export function PlanEmptyTableRow({ children }: { children: ReactNode }) {
  return (
    <div className="app-monthly-table-empty px-3 py-2 text-sm font-medium">
      {children}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Landmark, Settings, WalletCards } from "lucide-react";
import { useEffect } from "react";
import type { AppLanguage } from "@/domain/types";
import type { PanelChromeState } from "@/features/expenses/lib/scroll-chrome-state";
import { t } from "@/shared/i18n";

type DashboardShellProps = {
  headlineLabel: string;
  headlineTitle: string;
  activeTab: "expenses" | "money";
  language: AppLanguage;
  panelChrome: PanelChromeState;
  children: React.ReactNode;
};

export function DashboardShell({
  headlineLabel,
  headlineTitle,
  activeTab,
  language,
  panelChrome,
  children,
}: DashboardShellProps) {
  useEffect(() => {
    sessionStorage.setItem("expense-last-tab", activeTab);
  }, [activeTab]);

  return (
    <main className="app-page-bg min-h-dvh text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <header
          data-app-chrome="true"
          style={{ viewTransitionName: "app-chrome" }}
          data-state={panelChrome}
          className="app-top-chrome sticky top-0 z-40 px-3 pt-[max(0.65rem,env(safe-area-inset-top))] text-white"
        >
          <div
            aria-hidden="true"
            className="app-chrome-fade pointer-events-none absolute inset-x-0 top-0 z-0 h-[calc(100%+2rem)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_72%,transparent_100%)]"
          />
          <section
            data-state={panelChrome}
            className="app-shell-card relative z-10 mx-auto rounded-[1.35rem] border px-4 py-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-subtle)]">
                  {headlineTitle}
                </p>
                <p className="mt-1 text-[32px] font-semibold leading-none text-[var(--app-text)]">
                  {headlineLabel}
                </p>
              </div>
              <Link
                href={`/settings?from=${activeTab}`}
                aria-label={t("common.settings", language)}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--app-panel-soft-alpha)] text-[var(--app-text)] ring-1 ring-[var(--app-border)] transition hover:bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] hover:text-[var(--app-accent)]"
              >
                <Settings size={18} />
              </Link>
            </div>
          </section>
        </header>

        <section className="flex min-w-0 flex-1 flex-col px-3 pt-5 sm:px-6">
          {children}
        </section>
      </div>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      >
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 rounded-[1.35rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-strong)_92%,transparent)] p-1.5 text-sm font-semibold shadow-[0_-10px_34px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <ChromeTab
            href="/"
            active={activeTab === "expenses"}
            icon={<WalletCards size={18} />}
            label={t("common.expenses", language)}
          />
          <ChromeTab
            href="/money"
            active={activeTab === "money"}
            icon={<Landmark size={18} />}
            label={t("common.plan", language)}
          />
        </div>
      </nav>
    </main>
  );
}

function ChromeTab({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-[1rem] transition-[background-color,color,box-shadow] duration-300 ${
        active
          ? "bg-[var(--app-accent)] text-[var(--app-accent-contrast)] shadow-[0_0_24px_color-mix(in_srgb,var(--app-accent)_20%,transparent)]"
          : "text-[var(--app-text-muted)] hover:bg-[var(--app-panel-soft-alpha)] hover:text-[var(--app-text)]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

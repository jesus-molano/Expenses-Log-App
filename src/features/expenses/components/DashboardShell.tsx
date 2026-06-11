"use client";

import Link from "next/link";
import { Landmark, Settings, WalletCards } from "lucide-react";
import { useEffect } from "react";
import type { AppLanguage } from "@/domain/types";
import type { TopChromeState } from "@/features/expenses/lib/scroll-chrome-state";
import { t } from "@/shared/i18n";

type DashboardShellProps = {
  headlineLabel: string;
  headlineTitle: string;
  activeTab: "expenses" | "money";
  language: AppLanguage;
  topChrome?: TopChromeState;
  children: React.ReactNode;
};

export function DashboardShell({
  headlineLabel,
  headlineTitle,
  activeTab,
  language,
  topChrome = "expanded",
  children,
}: DashboardShellProps) {
  useEffect(() => {
    sessionStorage.setItem("expense-last-tab", activeTab);
  }, [activeTab]);

  const mobileCompact = topChrome === "compact";

  return (
    <main className="app-page-bg min-h-dvh text-white">
      <div className="mx-auto min-h-dvh w-full max-w-4xl pb-28 lg:grid lg:max-w-7xl lg:grid-cols-[344px_1fr] lg:pb-0">
        <aside
          data-app-chrome="true"
          style={{ viewTransitionName: "app-chrome" }}
          className="sticky top-0 z-40 h-[9.15rem] overflow-visible px-3 pt-[max(0.6rem,env(safe-area-inset-top))] text-white lg:h-dvh lg:p-5"
        >
          {activeTab === "expenses" ? (
            <div
              aria-hidden="true"
              className="app-chrome-fade pointer-events-none absolute inset-x-0 top-0 z-0 h-[calc(100%+4.25rem)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_72%,transparent_100%)] lg:hidden"
            />
          ) : null}
          <section
            className={`app-shell-card relative z-10 mx-auto overflow-visible border transition-[max-width,border-radius,padding,box-shadow,transform] duration-300 ease-out lg:max-w-none lg:rounded-[1.45rem] lg:p-3.5 ${
              mobileCompact
                ? "max-w-[15.5rem] rounded-[1.4rem] p-2"
                : "max-w-2xl rounded-[1.45rem] p-3.5"
            }`}
          >
            <div
              className={`flex items-start justify-between gap-3 transition-[max-height,opacity,transform,margin] duration-300 ease-out lg:max-h-16 lg:translate-y-0 lg:overflow-visible lg:opacity-100 ${
                mobileCompact
                  ? "max-h-0 -translate-y-1 overflow-hidden opacity-0"
                  : "max-h-16 translate-y-0 overflow-visible opacity-100"
              }`}
            >
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold uppercase tracking-wide text-slate-300"
                >
                  {headlineTitle}
                </p>
                <p
                  className="mt-1 text-[30px] font-semibold leading-none"
                >
                  {headlineLabel}
                </p>
              </div>
              <Link
                href={`/settings?from=${activeTab}`}
                aria-label={t("common.settings", language)}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-[background-color,color] duration-300 hover:bg-lime-300/15 hover:text-lime-100"
              >
                <Settings size={18} />
              </Link>
            </div>

            <nav
              aria-label="Secciones"
              className={`grid grid-cols-2 gap-2 overflow-hidden rounded-2xl bg-[var(--app-surface-muted)] p-1 text-sm font-semibold ring-1 ring-white/10 transition-[margin,border-radius] duration-300 ${
                mobileCompact ? "mt-0 rounded-[1.1rem] lg:mt-3" : "mt-3"
              }`}
            >
              <ChromeTab
                href="/"
                active={activeTab === "expenses"}
                compact={mobileCompact}
                icon={<WalletCards size={17} />}
                label={t("common.expenses", language)}
              />
              <ChromeTab
                href="/money"
                active={activeTab === "money"}
                compact={mobileCompact}
                icon={<Landmark size={17} />}
                label={t("common.plan", language)}
              />
            </nav>
          </section>
        </aside>

        <section
          className={`flex min-w-0 flex-1 flex-col px-3 pb-16 sm:px-6 lg:px-8 lg:py-6 ${
            activeTab === "expenses" ? "pt-10" : "pt-5"
          }`}
        >
          {children}
        </section>
      </div>
    </main>
  );
}

function ChromeTab({
  href,
  active,
  compact,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  compact: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-[height,background-color,color,box-shadow] duration-300 ${
        compact ? "h-10 lg:h-10" : "h-10"
      } ${
        active
          ? "bg-lime-300 text-slate-950 shadow-[0_0_24px_rgba(132,204,22,0.18)]"
          : "text-slate-200 hover:bg-white/8"
      }`}
    >
      {icon}
      <span className={compact ? "sr-only lg:not-sr-only" : ""}>{label}</span>
    </Link>
  );
}


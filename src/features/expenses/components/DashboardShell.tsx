"use client";

import { Landmark, Settings, WalletCards } from "lucide-react";
import { useEffect } from "react";
import { OfflineLink } from "@/components/ui/OfflineLink";
import type { AppLanguage } from "@/domain/types";
import type { PanelChromeState } from "@/features/expenses/lib/scroll-chrome-state";
import { t } from "@/shared/i18n";

type DashboardShellProps = {
  headlineLabel: string;
  headlineTitle: string;
  activeTab: "expenses" | "money";
  language: AppLanguage;
  panelChrome: PanelChromeState;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({
  headlineLabel,
  headlineTitle,
  activeTab,
  language,
  panelChrome,
  headerAction,
  children,
}: DashboardShellProps) {
  useEffect(() => {
    sessionStorage.setItem("expense-last-tab", activeTab);
  }, [activeTab]);

  return (
    <main className="app-page">
      <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col pb-[calc(var(--app-bottom-nav-height)+1.25rem+env(safe-area-inset-bottom))]">
        <header
          data-app-chrome="true"
          style={{ viewTransitionName: "app-chrome" }}
          data-state={panelChrome}
          className="app-top-chrome sticky top-0 z-40 px-3 pt-[max(0.65rem,env(safe-area-inset-top))]"
        >
          <div
            aria-hidden="true"
            className="app-chrome-fade pointer-events-none absolute inset-x-0 top-0 z-0 h-[calc(100%+2rem)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_72%,transparent_100%)]"
          />
          <section
            data-state={panelChrome}
            className="app-shell-card relative z-10 mx-auto rounded-[var(--app-radius-xl)] border px-4 py-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-subtle)]">
                  {headlineTitle}
                </p>
                <p className="app-money mt-1 text-[32px] font-semibold leading-none text-[var(--app-text)]">
                  {headlineLabel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerAction}
                <OfflineLink
                  href={`/settings?from=${activeTab}`}
                  aria-label={t("common.settings", language)}
                  className="app-icon-button size-10 min-h-10 min-w-10 shrink-0"
                >
                  <Settings size={18} />
                </OfflineLink>
              </div>
            </div>
          </section>
        </header>

        <section className="flex min-w-0 flex-1 flex-col px-3 pt-5 sm:px-6">
          {children}
        </section>
      </div>

      <nav
        aria-label={language === "es" ? "Secciones" : "Sections"}
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      >
        <div className="app-bottom-nav mx-auto grid max-w-md grid-cols-2 gap-2 p-1.5 text-sm font-semibold">
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
    <OfflineLink
      href={href}
      data-active={active ? "true" : "false"}
      className="app-bottom-nav-tab inline-flex items-center justify-center gap-2"
    >
      {icon}
      <span>{label}</span>
    </OfflineLink>
  );
}

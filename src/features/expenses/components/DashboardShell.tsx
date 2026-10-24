"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  Landmark,
  Settings,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { OfflineLink } from "@/components/ui/OfflineLink";
import { OfflineStatusChip } from "@/components/ui/OfflineStatusChip";
import type { AppLanguage } from "@/domain/types";
import type { PanelChromeState } from "@/features/expenses/lib/scroll-chrome-state";
import {
  APP_TABS,
  appTabHref,
  appTabLabelKey,
  settingsHrefFrom,
  type AppTab,
} from "@/shared/app-tabs";
import { t } from "@/shared/i18n";

const TAB_ICONS: Record<AppTab, LucideIcon> = {
  expenses: WalletCards,
  money: CalendarDays,
  accounts: Landmark,
  forecast: ChartNoAxesColumn,
};

type DashboardShellProps = {
  headlineLabel: string;
  headlineTitle: string;
  activeTab: AppTab;
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
                <p className="break-words text-xs font-semibold uppercase tracking-wide text-[var(--app-text-subtle)]">
                  {headlineTitle}
                </p>
                <p className="app-money mt-1 text-[32px] font-semibold leading-none text-[var(--app-text)]">
                  {headlineLabel}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerAction}
                <OfflineLink
                  href={settingsHrefFrom(activeTab)}
                  aria-label={t("common.settings", language)}
                  className="app-icon-button size-10 min-h-10 min-w-10 shrink-0"
                >
                  <Settings size={18} />
                </OfflineLink>
              </div>
            </div>
          </section>
          {/* El chip sin conexión va sobre el borde superior de la tarjeta: no
              recorta el título ni cambia la altura de la cabecera. */}
          <OfflineStatusChip
            language={language}
            className="app-chip-solid"
            regionClassName="absolute left-7 top-[calc(max(0.65rem,env(safe-area-inset-top))-0.5rem)] z-20"
          />
        </header>

        <section className="flex min-w-0 flex-1 flex-col px-3 pt-5 sm:px-6">
          {children}
        </section>
      </div>

      <nav
        aria-label={t("common.sections", language)}
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      >
        {/* Cuatro pestañas a 360 px: icono encima y etiqueta corta, sin cortar. */}
        <div className="app-bottom-nav mx-auto grid max-w-md grid-cols-4 gap-1 p-1.5 text-xs font-semibold">
          {APP_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            return (
              <ChromeTab
                key={tab}
                href={appTabHref(tab)}
                active={activeTab === tab}
                icon={<Icon size={18} aria-hidden="true" />}
                label={t(appTabLabelKey(tab), language)}
              />
            );
          })}
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
      aria-current={active ? "page" : undefined}
      className="app-bottom-nav-tab flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1"
    >
      {icon}
      <span className="max-w-full whitespace-nowrap leading-tight">{label}</span>
    </OfflineLink>
  );
}

"use client";

import Link from "next/link";
import { Landmark, Settings, WalletCards } from "lucide-react";
import { useEffect } from "react";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/lib/i18n";

type DashboardShellProps = {
  headlineLabel: string;
  headlineTitle: string;
  activeTab: "expenses" | "money";
  userEmail: string | null;
  isCloudReady: boolean;
  language: AppLanguage;
  children: React.ReactNode;
};

export function DashboardShell({
  headlineLabel,
  headlineTitle,
  activeTab,
  userEmail,
  isCloudReady,
  language,
  children,
}: DashboardShellProps) {
  useEffect(() => {
    sessionStorage.setItem("expense-last-tab", activeTab);
  }, [activeTab]);

  return (
    <main className="app-page-bg min-h-dvh text-white">
      <div className="mx-auto min-h-dvh w-full max-w-4xl pb-28 lg:grid lg:max-w-7xl lg:grid-cols-[344px_1fr] lg:pb-0">
        <aside
          data-app-chrome="true"
          className="sticky top-0 z-40 h-[9.15rem] overflow-visible px-3 pt-[max(0.6rem,env(safe-area-inset-top))] text-white lg:relative lg:min-h-dvh lg:p-5"
        >
          {activeTab === "expenses" ? (
            <div
              aria-hidden="true"
              className="app-chrome-fade pointer-events-none absolute inset-x-0 top-0 z-0 h-[calc(100%+4.25rem)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_72%,transparent_100%)] lg:hidden"
            />
          ) : null}
          <section
            className="app-shell-card relative z-10 mx-auto max-w-2xl overflow-hidden rounded-[1.45rem] border p-3.5 backdrop-blur-2xl lg:max-w-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {headlineTitle}
                </p>
                <p className="mt-1 text-[30px] font-semibold leading-none">
                  {headlineLabel}
                </p>
              </div>
              <Link
                href={`/settings?from=${activeTab}`}
                aria-label={t("common.settings", language)}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-lime-300/15 hover:text-lime-100"
              >
                <Settings size={18} />
              </Link>
            </div>

            <nav
              aria-label="Secciones"
              className="mt-3 grid grid-cols-2 gap-2 overflow-hidden rounded-2xl bg-white/[0.045] p-1 text-sm font-semibold ring-1 ring-white/10"
            >
              <ChromeTab
                href="/"
                active={activeTab === "expenses"}
                icon={<WalletCards size={17} />}
                label={t("common.expenses", language)}
              />
              <ChromeTab
                href="/money"
                active={activeTab === "money"}
                icon={<Landmark size={17} />}
                label={t("common.plan", language)}
              />
            </nav>
          </section>

          <section className="mt-3 hidden rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Cuenta
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">
              {userEmail ?? t("common.localMode", language)}
            </p>
            <Link
              href={`/settings?from=${activeTab}`}
              className="mt-3 inline-flex h-9 items-center rounded-full bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/10"
            >
              {userEmail
                ? t("common.manage", language)
                : isCloudReady
                  ? t("common.configureAccount", language)
                  : t("common.settings", language)}
            </Link>
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
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl transition ${
        active
          ? "bg-lime-300 text-slate-950 shadow-[0_0_24px_rgba(132,204,22,0.18)]"
          : "text-slate-200 hover:bg-white/8"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

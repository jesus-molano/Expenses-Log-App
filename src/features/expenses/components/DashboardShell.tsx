"use client";

import Link from "next/link";
import { CalendarClock, Settings } from "lucide-react";

type DashboardShellProps = {
  pendingTotalLabel: string;
  nextLabel: string;
  compact: boolean;
  userEmail: string | null;
  isCloudReady: boolean;
  children: React.ReactNode;
};

export function DashboardShell({
  pendingTotalLabel,
  nextLabel,
  compact,
  userEmail,
  isCloudReady,
  children,
}: DashboardShellProps) {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_50%_-12%,rgba(132,204,22,0.13),transparent_28%),linear-gradient(180deg,#020617_0%,#06101d_48%,#020617_100%)] text-white">
      <div className="mx-auto min-h-dvh w-full max-w-4xl pb-28 lg:grid lg:max-w-7xl lg:grid-cols-[344px_1fr] lg:pb-0">
        <aside className="sticky top-0 z-40 h-[8.9rem] overflow-visible px-3 pt-[max(0.6rem,env(safe-area-inset-top))] text-white lg:relative lg:min-h-dvh lg:p-5">
          <section
            className={`relative mx-auto max-w-2xl overflow-hidden border border-lime-300/20 bg-slate-950/82 shadow-[0_0_42px_rgba(132,204,22,0.14),0_18px_40px_rgba(0,0,0,0.44)] backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:max-w-none ${
              compact
                ? "translate-y-1 rounded-[1.25rem] px-3 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.56),0_0_28px_rgba(132,204,22,0.12)]"
                : "translate-y-0 rounded-[1.55rem] p-3.5"
            }`}
          >
            <div
              className={`flex gap-3 transition-all duration-300 ${
                compact ? "items-center" : "items-start justify-between"
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`font-semibold uppercase tracking-wide text-slate-300 transition-all duration-300 ${
                    compact ? "sr-only" : "text-xs"
                  }`}
                >
                  Por pagar
                </p>
                <p
                  className={`font-semibold leading-none transition-all duration-300 ${
                    compact ? "text-[18px]" : "mt-1 text-[30px]"
                  }`}
                >
                  {pendingTotalLabel}
                </p>
              </div>
              <div
                className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full bg-white/[0.06] text-sm text-white ring-1 ring-white/10 transition-all duration-500 ease-out ${
                  compact
                    ? "max-w-full px-3 py-2 opacity-100"
                    : "max-w-0 px-0 py-2 opacity-0"
                }`}
              >
                <CalendarClock size={16} className="shrink-0 text-lime-200" />
                <span className="min-w-0 truncate">{nextLabel}</span>
              </div>
              <Link
                href="/settings"
                aria-label="Ajustes"
                className={`grid shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-lime-300/15 hover:text-lime-100 ${
                  compact ? "size-9" : "size-10"
                }`}
              >
                <Settings size={18} />
              </Link>
            </div>

            <div
              className={`flex items-center gap-2 overflow-hidden rounded-2xl bg-lime-300/10 text-sm text-white ring-1 ring-lime-300/20 transition-all duration-500 ease-out ${
                compact
                  ? "mt-0 max-h-0 px-3 py-0 opacity-0"
                  : "mt-3 max-h-12 px-3 py-2 opacity-100"
              }`}
            >
              <CalendarClock size={17} className="shrink-0 text-lime-200" />
              <span className="min-w-0 truncate">{nextLabel}</span>
            </div>
          </section>

          <section className="mt-3 hidden rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Cuenta
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">
              {userEmail ?? "Modo local"}
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-flex h-9 items-center rounded-full bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/10"
            >
              {userEmail ? "Gestionar" : isCloudReady ? "Configurar cuenta" : "Ajustes"}
            </Link>
          </section>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col px-3 pb-16 pt-3 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}

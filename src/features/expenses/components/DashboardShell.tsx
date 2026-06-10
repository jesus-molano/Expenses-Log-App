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
    <main className="min-h-dvh bg-[linear-gradient(180deg,#020617_0%,#07111f_46%,#020617_100%)] text-white">
      <div className="mx-auto min-h-dvh w-full max-w-4xl pb-28 lg:grid lg:max-w-7xl lg:grid-cols-[344px_1fr] lg:pb-0">
        <aside
          className="sticky top-0 z-20 h-[8.7rem] overflow-visible px-3 pb-3 pt-[max(0.6rem,env(safe-area-inset-top))] text-white lg:relative lg:min-h-dvh lg:p-5"
        >
          <section
            className={`relative mx-auto h-[7.35rem] max-w-2xl overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/86 p-3.5 shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-[box-shadow,background-color,transform] duration-500 ease-out lg:max-w-none ${
              compact
                ? "-translate-y-1 scale-[0.965] bg-slate-950/92 shadow-[0_14px_42px_rgba(0,0,0,0.5),0_0_30px_rgba(132,204,22,0.08)]"
                : "translate-y-0 scale-100"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide text-slate-300 transition duration-300 ${
                    compact ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                  }`}
                >
                  Por pagar
                </p>
                <p
                  className={`mt-1 origin-left text-[30px] font-semibold leading-none transition duration-500 ease-out ${
                    compact
                      ? "-translate-y-4 scale-[0.72]"
                      : "translate-y-0 scale-100"
                  }`}
                >
                  {pendingTotalLabel}
                </p>
              </div>
              <div
                className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full bg-white/[0.06] text-sm text-white ring-1 ring-white/10 transition-all duration-500 ease-out ${
                  compact
                    ? "translate-y-0 px-3 py-2 opacity-100"
                    : "translate-y-2 px-3 py-2 opacity-0"
                }`}
              >
                <CalendarClock size={16} className="shrink-0 text-lime-200" />
                <span className="min-w-0 truncate">{nextLabel}</span>
              </div>
              <Link
                href="/settings"
                aria-label="Ajustes"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                <Settings size={18} />
              </Link>
            </div>

            <div
              className={`absolute inset-x-3.5 bottom-3.5 flex items-center gap-2 overflow-hidden rounded-2xl bg-white/[0.06] px-3 py-2 text-sm text-white ring-1 ring-white/10 transition-all duration-500 ease-out ${
                compact
                  ? "translate-y-3 opacity-0"
                  : "translate-y-0 opacity-100"
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

        <section className="flex min-w-0 flex-1 flex-col px-3 pb-6 pt-3 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}

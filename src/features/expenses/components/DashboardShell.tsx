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
          className={`sticky top-0 z-20 overflow-visible px-3 pt-[max(0.6rem,env(safe-area-inset-top))] text-white transition-[padding] duration-300 lg:relative lg:min-h-dvh lg:p-5 ${
            compact ? "pb-2" : "pb-3"
          }`}
        >
          <section
            className={`relative mx-auto max-w-2xl border border-white/10 bg-slate-950/86 shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all duration-500 ease-out lg:max-w-none ${
              compact
                ? "rounded-[1.35rem] px-3 py-2"
                : "rounded-[1.35rem] p-3.5"
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
              className={`flex items-center gap-2 overflow-hidden rounded-2xl bg-white/[0.06] text-sm text-white ring-1 ring-white/10 transition-all duration-500 ease-out ${
                compact
                  ? "mt-0 max-h-0 px-3 py-0 opacity-0"
                  : "mt-3 max-h-12 px-3 py-2 opacity-100"
              }`}
            >
              <CalendarClock size={17} className="shrink-0 text-lime-200" />
              <span className="min-w-0 truncate">{nextLabel}</span>
            </div>
          </section>

          <section className="mt-3 hidden rounded-[1.25rem] border border-white/10 bg-lime-300/10 p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
              Sync
            </p>
            <p className="mt-1 truncate text-sm font-medium">
              {userEmail ?? (isCloudReady ? "Supabase listo" : "Modo local")}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {userEmail ? "Sesion activa" : "Local-first hasta iniciar sesion"}
            </p>
          </section>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col px-3 pb-6 pt-3 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </section>
      </div>
    </main>
  );
}

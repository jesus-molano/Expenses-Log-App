"use client";

import Link from "next/link";
import { CalendarClock, Settings } from "lucide-react";

type DashboardShellProps = {
  pendingTotalLabel: string;
  nextLabel: string;
  userEmail: string | null;
  isCloudReady: boolean;
  children: React.ReactNode;
};

export function DashboardShell({
  pendingTotalLabel,
  nextLabel,
  userEmail,
  isCloudReady,
  children,
}: DashboardShellProps) {
  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#edf7ff_0%,#f7f3ff_45%,#fff8ef_100%)] text-slate-950">
      <div className="mx-auto min-h-dvh w-full max-w-4xl pb-28 lg:grid lg:max-w-7xl lg:grid-cols-[344px_1fr] lg:pb-0">
        <aside className="relative overflow-hidden bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e1b4b_100%)] px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-white lg:min-h-dvh lg:p-5">
          <section className="relative rounded-[1.35rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_22px_65px_rgba(14,165,233,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Este mes
                </p>
                <p className="mt-1 text-[32px] font-semibold leading-none">
                  {pendingTotalLabel}
                </p>
              </div>
              <Link
                href="/settings"
                aria-label="Ajustes"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
              >
                <Settings size={18} />
              </Link>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm text-slate-200 ring-1 ring-white/10">
              <CalendarClock size={17} className="shrink-0 text-cyan-200" />
              <span className="min-w-0 truncate">{nextLabel}</span>
            </div>
          </section>

          <section className="mt-3 hidden rounded-[1.25rem] border border-white/10 bg-cyan-300/10 p-4 lg:block">
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

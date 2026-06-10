"use client";

import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import type { SmartList } from "../lib/dashboard-config";
import { smartLists } from "../lib/dashboard-config";

type DashboardShellProps = {
  selectedList: SmartList;
  pendingTotalLabel: string;
  userEmail: string | null;
  isCloudReady: boolean;
  onSelectList: (list: SmartList) => void;
  onNewExpense: () => void;
  children: React.ReactNode;
};

export function DashboardShell({
  selectedList,
  pendingTotalLabel,
  userEmail,
  isCloudReady,
  onSelectList,
  onNewExpense,
  children,
}: DashboardShellProps) {
  return (
    <main className="min-h-dvh bg-slate-100 text-slate-950">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 lg:grid-cols-[336px_1fr]">
        <aside className="bg-slate-950 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white lg:min-h-dvh lg:p-5">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-200">Expense Reminders</p>
              <h1 className="text-3xl font-semibold tracking-normal">Gastos</h1>
            </div>
            <div className="flex gap-2">
              <Link
                href="/settings"
                aria-label="Ajustes"
                className="grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
              >
                <Settings size={20} />
              </Link>
              <button
                type="button"
                aria-label="Nuevo gasto"
                onClick={onNewExpense}
                className="grid size-11 place-items-center rounded-full bg-white text-slate-950 shadow-sm transition hover:bg-cyan-50"
              >
                <Plus size={21} />
              </button>
            </div>
          </header>

          <section className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.08] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Pendiente visible
            </p>
            <p className="mt-1 text-4xl font-semibold">{pendingTotalLabel}</p>
            <p className="mt-2 text-sm text-slate-300">
              Total segun lista y filtros activos.
            </p>
          </section>

          <section className="mt-3 rounded-[1.25rem] border border-white/10 bg-cyan-300/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
              Sync
            </p>
            <p className="mt-1 truncate text-sm font-medium">
              {userEmail ?? (isCloudReady ? "Supabase listo" : "Modo local")}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {userEmail
                ? "Sesion activa"
                : "Local-first hasta iniciar sesion"}
            </p>
          </section>

          <nav className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {(Object.keys(smartLists) as SmartList[]).map((key) => {
              const item = smartLists[key];
              const Icon = item.icon;
              const active = selectedList === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectList(key)}
                  className={`flex min-h-16 items-center gap-3 rounded-[1.1rem] px-3 py-2 text-left transition ${
                    active
                      ? "bg-white text-slate-950 shadow-sm"
                      : "bg-white/[0.08] text-white hover:bg-white/[0.13]"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${
                      active ? "bg-slate-100" : "bg-white/10"
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span
                      className={`block truncate text-xs ${
                        active ? "text-slate-500" : "text-slate-300"
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
          {children}
        </section>
      </div>
    </main>
  );
}

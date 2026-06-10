"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Database, Download, LogIn, Upload } from "lucide-react";
import { useState } from "react";
import type { ExpenseStore } from "@/domain/types";
import { loadExpenseStore, saveExpenseStore } from "@/lib/local-store";

export function SettingsView() {
  const [store, setStore] = useState<ExpenseStore>(() => loadExpenseStore());
  const [message, setMessage] = useState("");

  async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setMessage("Este navegador no soporta notificaciones PWA.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Permiso de notificaciones denegado.");
      return;
    }

    await navigator.serviceWorker.register("/sw.js");
    setMessage("Notificaciones habilitadas en este dispositivo.");
  }

  function exportData() {
    if (!store) return;
    const blob = new Blob([JSON.stringify(store, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "expense-reminders-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const imported = JSON.parse(text) as ExpenseStore;
    saveExpenseStore(imported);
    setStore(imported);
    setMessage("Datos importados en este dispositivo.");
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#020617_0%,#07111f_52%,#020617_100%)] px-4 py-5 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/10"
        >
          <ArrowLeft size={18} />
          Gastos
        </Link>

        <section className="mt-4 rounded-[1.35rem] border border-white/10 bg-slate-950/82 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <h1 className="text-2xl font-semibold text-white">Ajustes</h1>
          <p className="mt-2 text-sm text-slate-300">
            EUR · Atlantic/Canary · Supabase preparado para sincronizacion.
          </p>

          <div className="mt-5 grid gap-3">
            <Link
              href="/login"
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-lime-300 px-4 text-left text-slate-950 shadow-[0_0_30px_rgba(132,204,22,0.18)]"
            >
              <LogIn size={20} />
              <span>
                <span className="block font-semibold">Iniciar sesion</span>
                <span className="block text-sm text-slate-800">
                  Magic link por email
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={enableNotifications}
              className="flex min-h-14 items-center justify-between rounded-2xl bg-white/[0.06] px-4 text-left text-white ring-1 ring-white/10"
            >
              <span className="flex items-center gap-3">
                <Bell size={20} />
                <span>
                  <span className="block font-semibold">Activar avisos PWA</span>
                  <span className="block text-sm text-slate-300">
                    Best-effort en movil
                  </span>
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={exportData}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/[0.06] px-4 text-left text-white ring-1 ring-white/10"
            >
              <Download size={20} />
              <span>
                <span className="block font-semibold">Exportar datos</span>
                <span className="block text-sm text-slate-300">JSON local</span>
              </span>
            </button>

            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.06] px-4 text-left text-white ring-1 ring-white/10">
              <Upload size={20} />
              <span>
                <span className="block font-semibold">Importar datos</span>
                <span className="block text-sm text-slate-300">
                  Restaura un JSON exportado
                </span>
              </span>
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={(event) => void importData(event.target.files?.[0])}
              />
            </label>

            <div className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/[0.06] px-4 text-white ring-1 ring-white/10">
              <Database size={20} />
              <span>
                <span className="block font-semibold">Cloud sync</span>
                <span className="block text-sm text-slate-300">
                  Configurado con publishable key; falta aplicar schema RLS.
                </span>
              </span>
            </div>
          </div>

          {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}

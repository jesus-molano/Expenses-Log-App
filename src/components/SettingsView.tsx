"use client";

import Link from "next/link";
import { ArrowLeft, Bell, Database, Download, Upload } from "lucide-react";
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
    <main className="min-h-dvh bg-slate-100 px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-slate-700"
        >
          <ArrowLeft size={18} />
          Gastos
        </Link>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold">Ajustes</h1>
          <p className="mt-2 text-sm text-slate-500">
            EUR · Atlantic/Canary · Supabase preparado para sincronizacion.
          </p>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={enableNotifications}
              className="flex min-h-14 items-center justify-between rounded-xl bg-slate-100 px-4 text-left"
            >
              <span className="flex items-center gap-3">
                <Bell size={20} />
                <span>
                  <span className="block font-semibold">Activar avisos PWA</span>
                  <span className="block text-sm text-slate-500">Best-effort en movil</span>
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={exportData}
              className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-100 px-4 text-left"
            >
              <Download size={20} />
              <span>
                <span className="block font-semibold">Exportar datos</span>
                <span className="block text-sm text-slate-500">JSON local</span>
              </span>
            </button>

            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl bg-slate-100 px-4 text-left">
              <Upload size={20} />
              <span>
                <span className="block font-semibold">Importar datos</span>
                <span className="block text-sm text-slate-500">Restaura un JSON exportado</span>
              </span>
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={(event) => void importData(event.target.files?.[0])}
              />
            </label>

            <div className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-100 px-4">
              <Database size={20} />
              <span>
                <span className="block font-semibold">Cloud sync</span>
                <span className="block text-sm text-slate-500">
                  Configurado con publishable key; falta aplicar schema RLS.
                </span>
              </span>
            </div>
          </div>

          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Cloud,
  Download,
  LogIn,
  LogOut,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { ExpenseStore } from "@/domain/types";
import {
  loadExpenseStore,
  mergeExpenseStores,
  saveExpenseStore,
} from "@/lib/local-store";
import { createClient } from "@/utils/supabase/client";

export function SettingsView() {
  const [store, setStore] = useState<ExpenseStore>(() => loadExpenseStore());
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

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

  async function syncNow() {
    if (!supabase || !user) {
      setMessage("Inicia sesión para sincronizar.");
      return;
    }

    setSyncing(true);
    setMessage("");
    const localStore = loadExpenseStore();
    const { data, error } = await supabase
      .from("app_stores")
      .select("store")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setMessage(syncErrorMessage(error.message));
      setSyncing(false);
      return;
    }

    const merged = mergeExpenseStores(
      localStore,
      (data?.store as ExpenseStore | null) ?? null,
    );
    const { error: upsertError } = await supabase.from("app_stores").upsert({
      user_id: user.id,
      store: merged,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      setMessage(syncErrorMessage(upsertError.message));
    } else {
      saveExpenseStore(merged);
      setStore(merged);
      setLastSync(new Date().toLocaleString("es-ES"));
      setMessage("Datos fusionados y sincronizados.");
    }
    setSyncing(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMessage("Sesión cerrada. La app sigue en modo local.");
  }

  function exportData() {
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
            EUR · Atlantic/Canary · sincronización opcional.
          </p>

          <div className="mt-5 grid gap-3">
            <SettingCard
              icon={<Cloud size={20} />}
              title={user ? user.email ?? "Cuenta conectada" : "Modo local"}
              description={
                user
                  ? `Último sync: ${lastSync ?? "pendiente"}`
                  : "Entra con Google para guardar tus datos."
              }
              action={
                user ? (
                  <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={syncNow}
                      disabled={syncing}
                      className="h-10 rounded-xl bg-lime-300 px-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                    >
                      {syncing ? "Sync" : "Sincronizar"}
                    </button>
                    <button
                      type="button"
                      onClick={signOut}
                      className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10"
                      aria-label="Cerrar sesión"
                    >
                      <LogOut size={17} />
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime-300 px-3 text-sm font-semibold text-slate-950"
                  >
                    <LogIn size={17} />
                    Google
                  </Link>
                )
              }
            />

            <SettingCard
              icon={<Bell size={20} />}
              title="Avisos PWA"
              description="Best-effort en móvil; iOS requiere instalar en pantalla de inicio."
              action={
                <button
                  type="button"
                  onClick={enableNotifications}
                  className="h-10 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/10"
                >
                  Activar
                </button>
              }
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={exportData}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 text-sm font-semibold text-white ring-1 ring-white/10"
              >
                <Download size={18} />
                Exportar
              </button>
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 text-sm font-semibold text-white ring-1 ring-white/10">
                <Upload size={18} />
                Importar
                <input
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={(event) => void importData(event.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {message ? (
            <p className="mt-4 rounded-2xl bg-white/[0.05] p-3 text-sm leading-relaxed text-slate-200 ring-1 ring-white/10">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function syncErrorMessage(message: string) {
  if (
    message.includes("app_stores") ||
    message.includes("schema cache") ||
    message.includes("PGRST205")
  ) {
    return "Falta crear la tabla de sincronización en Supabase. Ejecuta supabase/migrations/20260611000000_app_store_sync.sql en el SQL Editor y vuelve a pulsar Sincronizar.";
  }

  return message;
}

function SettingCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-16 gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-white ring-1 ring-white/10 sm:grid-cols-[1fr_auto] sm:items-center">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 text-lime-100">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          <span className="block truncate text-sm text-slate-300">
            {description}
          </span>
        </span>
      </span>
      {action ? <span className="min-w-0 sm:shrink-0">{action}</span> : null}
    </div>
  );
}

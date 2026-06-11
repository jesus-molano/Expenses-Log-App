"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Cloud,
  Download,
  LogIn,
  LogOut,
  Palette,
  Trash2,
  Upload,
  UserX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CompactMenu } from "@/components/ui/CompactMenu";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import type { AppLanguage, AppTheme } from "@/domain/types";
import { useExpenseStore } from "@/features/expenses/hooks/use-expense-store";
import { t } from "@/lib/i18n";
import { clearExpenseLocalData } from "@/lib/local-store";
import { createClient } from "@/utils/supabase/client";

const THEMES: Array<{
  id: AppTheme;
  label: string;
  swatches: [string, string, string];
}> = [
  { id: "legacy", label: "Legacy", swatches: ["#020617", "#bef264", "#67e8f9"] },
  { id: "rose-pine", label: "Rosé Pine", swatches: ["#191724", "#ebbcba", "#9ccfd8"] },
  { id: "catppuccin", label: "Catppuccin", swatches: ["#11111b", "#cba6f7", "#74c7ec"] },
  { id: "light", label: "Light", swatches: ["#f7f9fc", "#2563eb", "#0891b2"] },
];

const LANGUAGES: Array<{ id: AppLanguage; label: string }> = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];

export function SettingsView() {
  const {
    store,
    persist,
    syncStatus,
    syncMessage,
    updateTheme,
    updateLanguage,
    clearExpenses,
  } = useExpenseStore();
  const [message, setMessage] = useState("");
  const [themeOpen, setThemeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [clearExpensesOpen, setClearExpensesOpen] = useState(false);
  const [isClearingExpenses, setIsClearingExpenses] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(() =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default",
    );
  const [user, setUser] = useState<User | null>(null);
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const currentTheme = store.preferences?.theme ?? "legacy";
  const selectedTheme = THEMES.find((theme) => theme.id === currentTheme) ?? THEMES[0];

  function handleThemeChange(value: string) {
    updateTheme(value as AppTheme);
  }

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
      setMessage(t("settings.browserNoNotifications"));
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") {
      setMessage(t("settings.notificationsDenied"));
      return;
    }

    await navigator.serviceWorker.register("/sw.js");
    setMessage(t("settings.notificationsEnabled"));
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMessage(t("settings.signedOut"));
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
    persist(JSON.parse(text));
    setMessage(t("settings.imported"));
  }

  async function handleClearExpenses() {
    setIsClearingExpenses(true);
    try {
      await clearExpenses();
      setClearExpensesOpen(false);
      setMessage(t("settings.expensesCleared"));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("settings.clearExpensesError"),
      );
    } finally {
      setIsClearingExpenses(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeletingAccount(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? t("settings.deleteAccountError"));
      }

      await supabase?.auth.signOut();
      clearExpenseLocalData();
      setUser(null);
      window.location.assign("/");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("settings.deleteAccountError"),
      );
      setIsDeletingAccount(false);
    }
  }

  function closeDeleteAccountDialog() {
    if (isDeletingAccount) return;
    setDeleteAccountOpen(false);
  }

  const avisosActivos = notificationPermission === "granted";
  const currentLanguage = store.preferences?.language ?? "es";
  const languageLabel =
    LANGUAGES.find((language) => language.id === currentLanguage)?.label ??
    LANGUAGES[0].label;
  const backTab = searchParams.get("from") === "money" ? "money" : "expenses";
  const backHref = backTab === "money" ? "/money" : "/";
  const backLabel =
    backTab === "money" ? t("common.plan") : t("common.expenses");
  const deleteAccountPhrase = currentLanguage === "en" ? "DELETE" : "BORRAR";

  return (
    <main className="app-page-bg min-h-dvh px-4 py-5 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href={backHref}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/10"
        >
          <ArrowLeft size={18} />
          {backLabel}
        </Link>

        <section className="mt-4 rounded-[1.35rem] border border-white/10 bg-slate-950/82 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-xs font-medium text-slate-300">
              {t("settings.subtitle")}
            </p>
          </div>

          <div className="mt-4 grid gap-2">
            <SettingRow
              icon={<Cloud size={18} />}
              title={user ? user.email ?? t("settings.accountConnected") : t("common.localMode")}
              description={
                user
                  ? syncDescription(syncStatus, syncMessage)
                  : t("settings.googleHelp")
              }
              action={
                user ? (
                  <button
                    type="button"
                    onClick={signOut}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/10"
                  >
                    <LogOut size={16} />
                    {t("settings.signOut")}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 text-sm font-semibold text-slate-950"
                  >
                    <LogIn size={16} />
                    {t("settings.google")}
                  </Link>
                )
              }
            />

            <SettingRow
              icon={avisosActivos ? <CheckCircle2 size={18} /> : <Bell size={18} />}
              title={avisosActivos ? t("settings.notificationsActive") : t("settings.notificationsPwa")}
              description={
                avisosActivos
                  ? t("settings.notificationsReady")
                  : t("settings.notificationsHelp")
              }
              action={
                <button
                  type="button"
                  onClick={enableNotifications}
                  disabled={avisosActivos}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/10 disabled:opacity-60"
                >
                  {avisosActivos ? t("settings.active") : t("settings.activate")}
                </button>
              }
            />

            <SettingRow
              icon={<Palette size={18} />}
              title={t("settings.theme")}
              description={selectedTheme.label}
              action={
                <CompactMenu
                  open={themeOpen}
                  onOpenChange={setThemeOpen}
                  label={selectedTheme.label}
                  leading={
                    <span className="flex -space-x-1">
                      {selectedTheme.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="size-3.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </span>
                  }
                >
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        handleThemeChange(theme.id);
                        setThemeOpen(false);
                      }}
                      className={`flex h-9 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold ${
                        currentTheme === theme.id
                          ? "bg-lime-300 text-slate-950"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      <span>{theme.label}</span>
                      <span className="flex -space-x-1">
                        {theme.swatches.map((swatch) => (
                          <span
                            key={swatch}
                            className="size-3 rounded-full ring-1 ring-white/20"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </span>
                    </button>
                  ))}
                </CompactMenu>
              }
            />

            <SettingRow
              icon={<span className="text-sm font-bold">Aa</span>}
              title={t("common.language")}
              description={languageLabel}
              action={
                <CompactMenu
                  open={languageOpen}
                  onOpenChange={setLanguageOpen}
                  label={currentLanguage.toUpperCase()}
                >
                  {LANGUAGES.map((language) => (
                    <button
                      key={language.id}
                      type="button"
                      onClick={() => {
                        updateLanguage(language.id);
                        setLanguageOpen(false);
                      }}
                      className={`flex h-9 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold ${
                        currentLanguage === language.id
                          ? "bg-lime-300 text-slate-950"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      <span>{language.label}</span>
                      <span>{language.id.toUpperCase()}</span>
                    </button>
                  ))}
                </CompactMenu>
              }
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportData}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 text-sm font-semibold text-white ring-1 ring-white/10"
              >
                <Download size={17} />
                {t("settings.export")}
              </button>
              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 text-sm font-semibold text-white ring-1 ring-white/10">
                <Upload size={17} />
                {t("settings.import")}
                <input
                  type="file"
                  accept="application/json"
                  className="sr-only"
                  onChange={(event) => void importData(event.target.files?.[0])}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => setClearExpensesOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-400/12 px-3 text-sm font-semibold text-rose-100 ring-1 ring-rose-300/20"
            >
              <Trash2 size={17} />
              {t("settings.clearExpenses")}
            </button>

            <SettingRow
              icon={<UserX size={18} />}
              title={t("settings.deleteAccount")}
              description={t("settings.deleteAccountHelp")}
              action={
                <button
                  type="button"
                  onClick={() => setDeleteAccountOpen(true)}
                  disabled={!user || isDeletingAccount}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-rose-400/14 px-3 text-sm font-semibold text-rose-100 ring-1 ring-rose-300/20 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  {isDeletingAccount
                    ? t("settings.deletingAccount")
                    : t("settings.delete")}
                </button>
              }
            />
          </div>

          {message ? (
            <p className="mt-3 rounded-2xl bg-white/[0.05] p-3 text-sm leading-relaxed text-slate-200 ring-1 ring-white/10">
              {message}
            </p>
          ) : null}
        </section>
      </div>

      {clearExpensesOpen ? (
        <ConfirmActionDialog
          icon={<Trash2 size={18} />}
          title={t("settings.clearExpenses", currentLanguage)}
          body={t("settings.clearExpensesConfirm", currentLanguage)}
          cancelLabel={t("common.back", currentLanguage)}
          confirmLabel={t("settings.clearExpensesAction", currentLanguage)}
          loading={isClearingExpenses}
          onCancel={() => {
            if (!isClearingExpenses) setClearExpensesOpen(false);
          }}
          onConfirm={handleClearExpenses}
        />
      ) : null}

      {deleteAccountOpen ? (
        <ConfirmActionDialog
          icon={<UserX size={18} />}
          title={t("settings.deleteAccount", currentLanguage)}
          body={t("settings.deleteAccountConfirm", currentLanguage)}
          cancelLabel={t("common.back", currentLanguage)}
          confirmLabel={t("settings.delete", currentLanguage)}
          confirmPhrase={deleteAccountPhrase}
          confirmPhraseLabel={t("settings.deleteAccountPrompt", currentLanguage)}
          loading={isDeletingAccount}
          onCancel={closeDeleteAccountDialog}
          onConfirm={handleDeleteAccount}
        />
      ) : null}
    </main>
  );
}

function syncDescription(status: string, message: string) {
  if (status === "syncing") return t("settings.syncing");
  if (status === "synced") return message;
  if (status === "error") return `${t("settings.cloudError")}: ${message}`;
  return t("settings.localChanges");
}

function SettingRow({
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
    <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2 text-white ring-1 ring-white/10">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-lime-100">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs font-medium text-slate-300">
            {description}
          </span>
        </span>
      </span>
      {action ? <span className="min-w-0 shrink-0">{action}</span> : null}
    </div>
  );
}

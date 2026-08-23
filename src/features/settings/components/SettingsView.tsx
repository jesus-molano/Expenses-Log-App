"use client";

import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { OfflineLink } from "@/components/ui/OfflineLink";
import { t } from "@/shared/i18n";
import { useSettingsController } from "../hooks/use-settings-controller";
import { SettingsDialogs } from "./SettingsDialogs";
import {
  AccountRow,
  DangerRows,
  LanguageRow,
  NotificationsRow,
  ThemeRow,
} from "./SettingsRows";

export function SettingsView({ from }: { from?: "money" | "expenses" }) {
  const settings = useSettingsController({ from });

  return (
    <main className="app-page app-page-safe px-4">
      <div className="mx-auto max-w-2xl">
        <OfflineLink
          href={settings.backHref}
          className="app-back-link inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium"
        >
          <ArrowLeft size={18} />
          {settings.backLabel}
        </OfflineLink>

        <Card variant="section" className="app-settings-card mt-4 p-4">
          <header>
            <h1 className="text-2xl font-semibold text-[var(--app-text)]">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-xs font-medium text-[var(--app-text-muted)]">
              {t("settings.subtitle")}
            </p>
          </header>

          <div className="mt-4 grid gap-2">
            <AccountRow settings={settings} />
            <NotificationsRow settings={settings} />
            <ThemeRow settings={settings} />
            <LanguageRow settings={settings} />
            <DangerRows settings={settings} />
          </div>

          {settings.message ? (
            <p className="mt-3 rounded-2xl bg-[var(--app-panel-soft-alpha)] p-3 text-sm leading-relaxed text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
              {settings.message}
            </p>
          ) : null}
        </Card>
      </div>

      <SettingsDialogs settings={settings} />
    </main>
  );
}

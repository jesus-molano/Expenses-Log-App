"use client";

import Link from "next/link";
import { Cloud, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
import { syncDescription } from "../../hooks/use-settings-controller";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

export function AccountRow({ settings }: { settings: SettingsController }) {
  return (
    <SettingRow
      icon={<Cloud size={18} />}
      title={
        settings.user
          ? settings.user.email ?? t("settings.accountConnected")
          : t("common.localMode")
      }
      description={
        settings.user
          ? syncDescription(settings.syncStatus, settings.syncMessage)
          : t("settings.googleHelp")
      }
      action={
        settings.user ? (
          <Button
            variant="secondary"
            onClick={settings.signOut}
            className="h-9 rounded-xl px-3"
          >
            <LogOut size={16} />
            {t("settings.signOut")}
          </Button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] px-3 text-sm font-semibold text-[var(--app-accent-contrast)]"
          >
            <LogIn size={16} />
            {t("settings.google")}
          </Link>
        )
      }
    />
  );
}

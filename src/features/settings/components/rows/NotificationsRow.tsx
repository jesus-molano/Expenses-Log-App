"use client";

import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

export function NotificationsRow({
  settings,
}: {
  settings: SettingsController;
}) {
  return (
    <SettingRow
      icon={
        settings.notificationsActive ? (
          <CheckCircle2 size={18} />
        ) : (
          <Bell size={18} />
        )
      }
      title={
        settings.notificationsActive
          ? t("settings.notificationsActive")
          : t("settings.notificationsPwa")
      }
      description={
        settings.notificationsActive
          ? t("settings.notificationsReady")
          : t("settings.notificationsHelp")
      }
      action={
        <Button
          variant={settings.notificationsActive ? "danger" : "secondary"}
          onClick={
            settings.notificationsActive
              ? settings.disableNotifications
              : settings.enableNotifications
          }
          size="sm"
        >
          {settings.notificationsActive
            ? t("settings.deactivate")
            : t("settings.activate")}
        </Button>
      }
    />
  );
}

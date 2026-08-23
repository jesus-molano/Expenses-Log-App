import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

function formatNotificationDate(value: string, language: "es" | "en") {
  return new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationDescription(settings: SettingsController) {
  const language = settings.currentLanguage;
  const { notificationState, notificationHealth, lastTestSentAt } = settings;

  if (notificationState === "unsupported") {
    return t("settings.browserNoNotifications", language);
  }
  if (notificationState === "permission-denied") {
    return t("settings.notificationsBlocked", language);
  }
  if (notificationState === "syncing") {
    return t("settings.notificationsChecking", language);
  }
  if (notificationState === "local-only") {
    return t("settings.notificationsLoginRequired", language);
  }
  if (notificationState === "error") {
    return t("settings.notificationsVerificationError", language);
  }
  if (notificationState === "ready") {
    if (notificationHealth?.lastScheduledDeliveryAt) {
      return t("settings.notificationsLastDelivery", language).replace(
        "{date}",
        formatNotificationDate(
          notificationHealth.lastScheduledDeliveryAt,
          language,
        ),
      );
    }
    if (lastTestSentAt) {
      return t("settings.notificationsLastTest", language).replace(
        "{date}",
        formatNotificationDate(lastTestSentAt, language),
      );
    }
    return t("settings.notificationsReady", language);
  }

  return t("settings.notificationsHelp", language);
}

export function NotificationsRow({
  settings,
}: {
  settings: SettingsController;
}) {
  const ready = settings.notificationState === "ready";
  const active =
    ready || settings.notificationState === "local-only";
  const unavailable =
    settings.notificationState === "unsupported" ||
    settings.notificationState === "permission-denied";
  const busy =
    settings.notificationState === "syncing" ||
    settings.isTestingNotification;

  return (
    <SettingRow
      icon={ready ? <CheckCircle2 size={18} /> : <Bell size={18} />}
      title={t("settings.notificationsPwa", settings.currentLanguage)}
      description={notificationDescription(settings)}
      action={
        <span className="flex items-center gap-1">
          {ready ? (
            <Button
              variant="ghost"
              onClick={settings.sendTestNotification}
              disabled={busy}
              size="sm"
            >
              {settings.isTestingNotification
                ? t("settings.notificationsTesting", settings.currentLanguage)
                : t("settings.notificationsTest", settings.currentLanguage)}
            </Button>
          ) : null}
          <Button
            variant={active ? "danger" : "secondary"}
            onClick={
              active
                ? settings.disableNotifications
                : settings.enableNotifications
            }
            disabled={busy || unavailable}
            size="sm"
          >
            {settings.notificationState === "syncing"
              ? t("settings.notificationsCheckingShort", settings.currentLanguage)
              : active
                ? t("settings.deactivate", settings.currentLanguage)
                : unavailable
                  ? t("settings.notificationsUnavailable", settings.currentLanguage)
                  : t("settings.activate", settings.currentLanguage)}
          </Button>
        </span>
      }
    />
  );
}

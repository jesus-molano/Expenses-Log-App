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
            size="sm"
            leadingIcon={<LogOut size={16} />}
          >
            {t("settings.signOut")}
          </Button>
        ) : (
          <Link
            href="/login"
            className="app-button app-button-primary app-button-sm"
          >
            <LogIn size={16} />
            {t("settings.google")}
          </Link>
        )
      }
    />
  );
}

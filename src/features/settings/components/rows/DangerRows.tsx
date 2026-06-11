"use client";

import { Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

export function DangerRows({ settings }: { settings: SettingsController }) {
  return (
    <>
      <Button
        variant="danger"
        onClick={() => settings.setClearExpensesOpen(true)}
      >
        <Trash2 size={17} />
        {t("settings.clearExpenses")}
      </Button>

      <SettingRow
        icon={<UserX size={18} />}
        title={t("settings.deleteAccount")}
        description={t("settings.deleteAccountHelp")}
        action={
          <Button
            variant="danger"
            onClick={() => settings.setDeleteAccountOpen(true)}
            disabled={!settings.user || settings.isDeletingAccount}
            className="h-9 rounded-xl px-3"
          >
            <Trash2 size={15} />
            {settings.isDeletingAccount
              ? t("settings.deletingAccount")
              : t("settings.delete")}
          </Button>
        }
      />
    </>
  );
}

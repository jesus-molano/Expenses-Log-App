import { Trash2, UserX } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/ConfirmActionDialog";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../types";

export function SettingsDialogs({
  settings,
}: {
  settings: SettingsController;
}) {
  return (
    <>
      {settings.clearExpensesOpen ? (
        <ConfirmActionDialog
          icon={<Trash2 size={18} />}
          title={t("settings.clearExpenses", settings.currentLanguage)}
          body={t("settings.clearExpensesConfirm", settings.currentLanguage)}
          cancelLabel={t("common.back", settings.currentLanguage)}
          confirmLabel={t("settings.clearExpensesAction", settings.currentLanguage)}
          loading={settings.isClearingExpenses}
          onCancel={() => {
            if (!settings.isClearingExpenses) settings.setClearExpensesOpen(false);
          }}
          onConfirm={settings.handleClearExpenses}
        />
      ) : null}

      {settings.deleteAccountOpen ? (
        <ConfirmActionDialog
          icon={<UserX size={18} />}
          title={t("settings.deleteAccount", settings.currentLanguage)}
          body={t("settings.deleteAccountConfirm", settings.currentLanguage)}
          cancelLabel={t("common.back", settings.currentLanguage)}
          confirmLabel={t("settings.delete", settings.currentLanguage)}
          confirmPhrase={settings.deleteAccountPhrase}
          confirmPhraseLabel={t(
            "settings.deleteAccountPrompt",
            settings.currentLanguage,
          )}
          loading={settings.isDeletingAccount}
          onCancel={settings.closeDeleteAccountDialog}
          onConfirm={settings.handleDeleteAccount}
        />
      ) : null}
    </>
  );
}

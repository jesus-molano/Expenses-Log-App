import { BadgeEuro, ReceiptText, Trash2, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
import type { SettingsController } from "../../types";
import { SettingRow } from "../SettingRow";

export function DangerRows({ settings }: { settings: SettingsController }) {
  return (
    <section className="mt-3 border-t border-[var(--app-border)] pt-3">
      <p className="mb-2 px-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">
        {t("settings.dangerZone")}
      </p>

      <div className="grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="danger"
            className="min-w-0 px-3"
            onClick={() => settings.setClearExpensesOpen(true)}
            leadingIcon={<ReceiptText size={17} />}
          >
            <span className="truncate">{t("settings.clearExpenses")}</span>
          </Button>

          <Button
            variant="danger"
            className="min-w-0 px-3"
            onClick={() => settings.setClearIncomeOpen(true)}
            leadingIcon={<BadgeEuro size={17} />}
          >
            <span className="truncate">{t("settings.clearIncome")}</span>
          </Button>
        </div>

        <SettingRow
          icon={<UserX size={18} />}
          title={t("settings.deleteAccount")}
          description={t("settings.deleteAccountHelp")}
          action={
            <Button
              variant="danger"
              onClick={() => settings.setDeleteAccountOpen(true)}
              disabled={!settings.user || settings.isDeletingAccount}
              size="sm"
              leadingIcon={<Trash2 size={15} />}
            >
              {settings.isDeletingAccount
                ? t("settings.deletingAccount")
                : t("settings.delete")}
            </Button>
          }
        />
      </div>
    </section>
  );
}

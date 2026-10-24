import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { ACCOUNT_NAME_MAX_LENGTH } from "@/domain/balance-accounts";
import type { AppLanguage, BalanceAccountRole } from "@/domain/types";
import { formatMessage, t } from "@/shared/i18n";
import { accountRoleOptions, defaultAccountName } from "../lib/account-labels";
import { PlanSheetHeader } from "./PlanSheetHeader";

// Crear o editar una cuenta: nombre y para qué se usa. Al editar, también se
// puede borrar (con confirmación aparte).
export function AccountEditorSheet({
  language,
  isNew,
  accountName,
  name,
  role,
  onNameChange,
  onRoleChange,
  onClose,
  onSubmit,
  onDelete,
}: {
  language: AppLanguage;
  isNew: boolean;
  // Nombre visible de la cuenta que se edita.
  accountName?: string;
  name: string;
  role: BalanceAccountRole;
  onNameChange: (name: string) => void;
  onRoleChange: (role: BalanceAccountRole) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  const title = t(isNew ? "insights.accounts.newTitle" : "insights.accounts.editTitle", language);
  const fallbackName = defaultAccountName(role, language);

  return (
    <Sheet
      ariaLabelledBy="account-editor-title"
      onBackdropClick={onClose}
      contentClassName="sm:max-w-sm"
    >
      <form onSubmit={onSubmit} className="p-5">
        <PlanSheetHeader
          title={title}
          titleId="account-editor-title"
          subtitle={accountName}
          capitalizeSubtitle={false}
          onClose={onClose}
          language={language}
        />
        <div className="mt-5 grid gap-4">
          <Field
            label={t("insights.accounts.name", language)}
            hint={formatMessage("insights.accounts.nameHint", { name: fallbackName }, language)}
          >
            <input
              value={name}
              maxLength={ACCOUNT_NAME_MAX_LENGTH}
              autoComplete="off"
              placeholder={t("insights.accounts.namePlaceholder", language)}
              onChange={(event) => onNameChange(event.target.value)}
              className="input-control"
            />
          </Field>
          <ChoiceGroup
            label={t("insights.accounts.role", language)}
            value={role}
            options={accountRoleOptions(language)}
            onChange={onRoleChange}
            columns={1}
          />
        </div>
        <Button type="submit" variant="primary" className="mt-5 w-full">
          {t(isNew ? "insights.accounts.add" : "insights.accounts.save", language)}
        </Button>
        {isNew ? null : (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full text-[var(--app-danger)]"
            leadingIcon={<Trash2 size={16} aria-hidden="true" />}
            onClick={onDelete}
          >
            {t("insights.accounts.delete", language)}
          </Button>
        )}
      </form>
    </Sheet>
  );
}

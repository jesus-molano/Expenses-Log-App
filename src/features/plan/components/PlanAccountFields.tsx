"use client";

import { Field } from "@/components/ui/Field";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";
import type { PlanAccountNames } from "../types";

type PlanAccountFieldsProps = {
  language: AppLanguage;
  accountNames: PlanAccountNames;
  onAccountNamesChange: (value: PlanAccountNames) => void;
};

export function PlanAccountFields({
  language,
  accountNames,
  onAccountNamesChange,
}: PlanAccountFieldsProps) {
  return (
    <>
      <Field label={t("money.expensesAccount", language)}>
        <input
          value={accountNames.expensesAccountName}
          onChange={(event) =>
            onAccountNamesChange({
              ...accountNames,
              expensesAccountName: event.target.value,
            })
          }
          className="input-control"
        />
      </Field>

      <Field label={t("money.savingsAccount", language)}>
        <input
          value={accountNames.savingsAccountName}
          onChange={(event) =>
            onAccountNamesChange({
              ...accountNames,
              savingsAccountName: event.target.value,
            })
          }
          className="input-control"
        />
      </Field>

      <Field label={t("money.mainAccount", language)}>
        <input
          value={accountNames.primaryAccountName}
          onChange={(event) =>
            onAccountNamesChange({
              ...accountNames,
              primaryAccountName: event.target.value,
            })
          }
          className="input-control"
        />
      </Field>
    </>
  );
}

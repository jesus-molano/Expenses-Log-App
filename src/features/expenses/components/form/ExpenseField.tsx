"use client";

import { Field } from "@/components/ui/Field";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

type ExpenseFieldProps = {
  label: string;
  optional?: boolean;
  language?: AppLanguage;
  children: React.ReactNode;
};

export function ExpenseField({
  label,
  optional = false,
  language = "es",
  children,
}: ExpenseFieldProps) {
  return (
    <Field
      label={
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {optional ? (
            <span className="shrink-0 rounded-[var(--app-radius-pill)] border border-[var(--app-border)] px-2 py-0.5 text-[0.65rem] font-bold uppercase leading-none text-[var(--app-text-subtle)]">
              {t("common.optional", language)}
            </span>
          ) : null}
        </span>
      }
    >
      {children}
    </Field>
  );
}

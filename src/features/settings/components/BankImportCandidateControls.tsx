"use client";

import { Check, FilePlus2, Link2, Plus, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { formatCurrency } from "@/domain/calendar";
import type {
  AppLanguage,
  ExpenseCategory,
  DraftExpense,
  ExpenseTemplate,
  RecurrenceRule,
} from "@/domain/types";
import {
  CategoryPicker,
  ExpenseField,
  ExpenseSchedulePicker,
} from "@/features/expenses/components/ExpenseFormControls";
import { categoryLabel } from "@/shared/category-labels";
import { t } from "@/shared/i18n";

export type BankImportAction = "match" | "create" | "import" | "ignore";
export type BankImportIncomeAction = "salary" | "income" | "import" | "ignore";

export function BankImportActionPicker({
  action,
  includeImport = false,
  language,
  onChange,
}: {
  action: BankImportAction;
  includeImport?: boolean;
  language: AppLanguage;
  onChange: (action: BankImportAction) => void;
}) {
  const options = includeImport
    ? (["ignore", "import", "match", "create"] as const)
    : (["match", "create", "ignore"] as const);

  return (
    <div className="app-import-actions" data-count={options.length}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="app-import-action"
          data-action={option}
          data-selected={action === option ? "true" : "false"}
          aria-pressed={action === option}
          onClick={() => onChange(option)}
        >
          <span className="app-import-action-content">
            <span className="app-import-action-icon" aria-hidden="true">
              {option === "match" ? (
                <Link2 size={14} />
              ) : option === "create" ? (
                <Plus size={14} />
              ) : option === "import" ? (
                <FilePlus2 size={14} />
              ) : (
                <X size={14} />
              )}
            </span>
            <span className="app-import-action-label">
              {actionLabel(option, language, includeImport)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function BankImportIncomeActionPicker({
  action,
  includeImport = false,
  language,
  onChange,
}: {
  action: BankImportIncomeAction;
  includeImport?: boolean;
  language: AppLanguage;
  onChange: (action: BankImportIncomeAction) => void;
}) {
  const options = includeImport
    ? (["ignore", "import", "salary", "income"] as const)
    : (["salary", "income", "ignore"] as const);

  return (
    <div className="app-import-actions" data-count={options.length}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="app-import-action"
          data-action={option === "ignore" ? "ignore" : "create"}
          data-selected={action === option ? "true" : "false"}
          aria-pressed={action === option}
          onClick={() => onChange(option)}
        >
          <span className="app-import-action-content">
            <span className="app-import-action-icon" aria-hidden="true">
              {option === "salary" ? (
                <Wallet size={14} />
              ) : option === "income" ? (
                <Plus size={14} />
              ) : option === "import" ? (
                <FilePlus2 size={14} />
              ) : (
                <X size={14} />
              )}
            </span>
            <span className="app-import-action-label">
              {incomeActionLabel(option, language, includeImport)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function BankImportMatchControls({
  templates,
  categories,
  templateId,
  saveAlias,
  language,
  onTemplateChange,
  onAliasChange,
}: {
  templates: ExpenseTemplate[];
  categories: ExpenseCategory[];
  templateId?: string;
  saveAlias: boolean;
  language: AppLanguage;
  onTemplateChange: (templateId: string | undefined) => void;
  onAliasChange: (saveAlias: boolean) => void;
}) {
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.name,
    detail: formatCurrency(template.amount),
    description: `${expenseCategoryLabel(template, categories, language)} Â· ${recurrenceSummary(template.recurrence, language)}`,
  }));

  return (
    <div className="app-import-inline-editor grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
      <Field label={t("settings.bankImportLink", language)} className="text-xs">
        <SelectMenu
          open={templateMenuOpen}
          onOpenChange={setTemplateMenuOpen}
          value={templateId ?? ""}
          options={templateOptions}
          label={
            templateId ? undefined : t("settings.bankImportSelectExpense", language)
          }
          onChange={onTemplateChange}
          align="left"
        />
      </Field>

      <button
        type="button"
        role="switch"
        aria-checked={saveAlias}
        className="app-import-alias-toggle h-10"
        data-state={saveAlias ? "on" : "off"}
        onClick={() => onAliasChange(!saveAlias)}
      >
        <span className="app-import-toggle-dot" aria-hidden="true">
          {saveAlias ? <Check size={12} /> : null}
        </span>
        {t("settings.bankImportAlias", language)}
      </button>
    </div>
  );
}

export function BankImportCreateExpenseControls({
  draft,
  language,
  onChange,
}: {
  draft: DraftExpense;
  language: AppLanguage;
  onChange: (patch: Partial<DraftExpense>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <ExpenseField label={t("expenses.name", language)}>
          <input
            className="input-control"
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </ExpenseField>
        <ExpenseField label={t("expenses.amount", language)}>
          <input
            className="input-control"
            inputMode="decimal"
            value={draft.amount}
            onChange={(event) => onChange({ amount: Number(event.target.value) })}
          />
        </ExpenseField>
      </div>

      <CategoryPicker
        value={draft.categoryName}
        language={language}
        onChange={(categoryName) => onChange({ categoryName })}
      />

      <ExpenseSchedulePicker
        value={draft}
        language={language}
        onChange={(value) => onChange(value)}
      />
    </div>
  );
}

function actionLabel(
  action: BankImportAction,
  language: AppLanguage,
  duplicateReview: boolean,
) {
  if (action === "match") return t("settings.bankImportMatchAction", language);
  if (action === "create") return t("settings.bankImportCreate", language);
  if (action === "import") return t("settings.bankImportForceImport", language);
  if (action === "ignore" && duplicateReview) {
    return t("settings.bankImportKeepIgnored", language);
  }
  return t("settings.bankImportIgnore", language);
}

function incomeActionLabel(
  action: BankImportIncomeAction,
  language: AppLanguage,
  duplicateReview: boolean,
) {
  if (action === "salary") return t("settings.bankImportConfirmSalary", language);
  if (action === "income") return t("settings.bankImportCreateIncome", language);
  if (action === "import") return t("settings.bankImportForceImport", language);
  if (action === "ignore" && duplicateReview) {
    return t("settings.bankImportKeepIgnored", language);
  }
  return t("settings.bankImportIgnore", language);
}

function expenseCategoryLabel(
  template: ExpenseTemplate,
  categories: ExpenseCategory[],
  language: AppLanguage,
) {
  const category = categories.find((item) => item.id === template.categoryId);
  return categoryLabel(category?.name ?? template.categoryId, language);
}

function recurrenceSummary(rule: RecurrenceRule, language: AppLanguage) {
  if (rule.frequency === "once") return t("expenses.once", language);
  if (rule.frequency === "monthly") return t("expenses.monthly", language);
  if (rule.frequency === "quarterly") return t("expenses.quarterly", language);
  if (rule.frequency === "yearly") return t("expenses.yearly", language);
  if (rule.frequency === "custom") return t("expenses.custom", language);
  return t("expenses.custom", language);
}

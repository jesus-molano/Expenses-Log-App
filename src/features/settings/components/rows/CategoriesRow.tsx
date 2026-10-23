"use client";

import { Tags } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AppLanguage } from "@/domain/types";
import { CategoryManagerSheet } from "@/features/expenses/components/categories/CategoryManagerSheet";
import { t } from "@/shared/i18n";
import { useExpenseStore } from "@/stores/app/use-expense-store";
import { SettingRow } from "../SettingRow";

export function CategoriesRow({ language }: { language: AppLanguage }) {
  const { store, createCategory, updateCategory, deleteCategory } = useExpenseStore();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingRow
        icon={<Tags size={18} />}
        title={t("categoryManager.title", language)}
        description={t("categoryManager.settingsHelp", language)}
        wrapDescription
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {t("common.manage", language)}
          </Button>
        }
      />
      {open ? (
        <CategoryManagerSheet
          store={store}
          language={language}
          onClose={() => setOpen(false)}
          onCreate={createCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
        />
      ) : null}
    </>
  );
}

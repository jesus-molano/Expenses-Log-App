"use client";

import { useState } from "react";
import { validateCategoryName, type CategoryInput } from "@/domain/categories";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryNameErrorLabel } from "../lib/expense-detail-labels";

type ManagerMode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; categoryId: string }
  | { kind: "delete"; categoryId: string };

// Estado del gestor de categorías: qué se está creando, editando o
// borrando, y la validación del nombre. Los cambios van por los comandos.
export function useCategoryManager({
  categories,
  language,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: ExpenseCategory[];
  language: AppLanguage;
  onCreate: (input: CategoryInput) => string | null;
  onUpdate: (categoryId: string, input: CategoryInput) => void;
  onDelete: (categoryId: string, replacementName: string) => void;
}) {
  const [mode, setMode] = useState<ManagerMode>({ kind: "list" });
  const [draft, setDraft] = useState<CategoryInput>({ name: "", tone: "violet" });
  const [error, setError] = useState<string | null>(null);
  const [replacementName, setReplacementName] = useState("General");

  function reset() {
    setMode({ kind: "list" });
    setError(null);
  }

  function startCreate() {
    setDraft({ name: "", tone: "violet" });
    setError(null);
    setMode({ kind: "create" });
  }

  function startEdit(category: ExpenseCategory) {
    setDraft({ name: category.name, tone: category.tone });
    setError(null);
    setMode({ kind: "edit", categoryId: category.id });
  }

  function startDelete(category: ExpenseCategory) {
    // General salvo que se borre la propia General.
    const fallback = categories.find(
      (candidate) => candidate.id !== category.id && candidate.name === "General",
    );
    setReplacementName(category.name === "General" ? "Casa" : fallback?.name ?? "General");
    setError(null);
    setMode({ kind: "delete", categoryId: category.id });
  }

  function submit() {
    const exceptId = mode.kind === "edit" ? mode.categoryId : undefined;
    const nameError = validateCategoryName(categories, draft.name, exceptId);
    if (nameError) {
      setError(categoryNameErrorLabel(nameError, language));
      return;
    }
    if (mode.kind === "create") onCreate({ ...draft, name: draft.name.trim() });
    if (mode.kind === "edit") onUpdate(mode.categoryId, { ...draft, name: draft.name.trim() });
    reset();
  }

  function confirmDelete() {
    if (mode.kind !== "delete") return;
    onDelete(mode.categoryId, replacementName);
    reset();
  }

  return {
    mode,
    draft,
    error,
    replacementName,
    setDraft: (next: CategoryInput) => {
      setDraft(next);
      setError(null);
    },
    setReplacementName,
    startCreate,
    startEdit,
    startDelete,
    submit,
    confirmDelete,
    cancel: reset,
  };
}

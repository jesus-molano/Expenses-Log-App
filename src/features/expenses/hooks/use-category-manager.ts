"use client";

import { useState } from "react";
import { validateCategoryName, type CategoryInput } from "@/domain/categories";
import type { AppLanguage, ExpenseCategory } from "@/domain/types";
import { categoryNameErrorLabel } from "../lib/expense-detail-labels";

type ManagerMode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; categoryId: string }
  // Borrar: si algo la usa, antes se elige en la fila a cuál pasa; la
  // confirmación final es el diálogo común (`confirming`).
  | { kind: "delete"; categoryId: string; inUse: boolean; confirming: boolean };

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

  // Sin nada que mover se pide confirmación directamente.
  function startDelete(category: ExpenseCategory, inUse = true) {
    // General salvo que se borre la propia General.
    const fallback = categories.find(
      (candidate) => candidate.id !== category.id && candidate.name === "General",
    );
    setReplacementName(category.name === "General" ? "Casa" : fallback?.name ?? "General");
    setError(null);
    setMode({ kind: "delete", categoryId: category.id, inUse, confirming: !inUse });
  }

  function requestDelete() {
    if (mode.kind === "delete") setMode({ ...mode, confirming: true });
  }

  // Cancelar el diálogo vuelve a elegir destino, o a la lista si no había.
  function cancelDelete() {
    if (mode.kind === "delete" && mode.inUse) setMode({ ...mode, confirming: false });
    else reset();
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
    requestDelete,
    cancelDelete,
    submit,
    confirmDelete,
    cancel: reset,
  };
}

"use client";

import { useState } from "react";
import type { CapturedDraft } from "@/domain/expense-capture";
import type { CreateExpenseOptions, DraftExpense } from "@/domain/types";
import { createEmptyDraft } from "../lib/dashboard-config";
import type { useQuickExpenseParser } from "./use-quick-expense-parser";

type Review = Pick<CapturedDraft, "missingFields" | "inferredFields">;

// Flujo de añadir gastos: captura por texto (IA o local), formulario de uno
// y revisión de varios. El dashboard solo compone.
export function useExpenseCaptureFlow({
  parser,
  initialFormOpen,
  addExpense,
  addExpenses,
}: {
  parser: ReturnType<typeof useQuickExpenseParser>;
  initialFormOpen: boolean;
  addExpense: (draft: DraftExpense, options?: CreateExpenseOptions) => void;
  addExpenses: (drafts: DraftExpense[]) => void;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(initialFormOpen);
  const [draft, setDraft] = useState<DraftExpense>(() => createEmptyDraft());
  const [draftReview, setDraftReview] = useState<Review | null>(null);
  const [reviewItems, setReviewItems] = useState<CapturedDraft[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Cada apertura del formulario empieza de cero aunque el borrador coincida.
  const [formKey, setFormKey] = useState(0);

  function openForm(nextDraft: DraftExpense, review: Review | null = null) {
    setDraft(nextDraft);
    setDraftReview(review);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function analyze() {
    const result = await parser.parse();
    if (!result || result.drafts.length === 0) return;

    setCaptureOpen(false);
    if (result.drafts.length === 1) {
      openForm(result.drafts[0].draft, result.drafts[0]);
    } else {
      setReviewItems(result.drafts);
    }
  }

  function saveForm(nextDraft: DraftExpense, options?: CreateExpenseOptions) {
    addExpense(nextDraft, options);
    setFormOpen(false);
    if (editingIndex !== null && reviewItems) {
      const remaining = reviewItems.filter((_, index) => index !== editingIndex);
      setReviewItems(remaining.length ? remaining : null);
      setEditingIndex(null);
      if (remaining.length) return;
    }
    parser.reset();
  }

  function saveReviewed(drafts: DraftExpense[]) {
    addExpenses(drafts);
    setReviewItems(null);
    parser.reset();
  }

  return {
    captureOpen,
    formOpen,
    formKey,
    draft,
    draftReview,
    reviewItems: formOpen ? null : reviewItems,
    isIdle: !captureOpen && !formOpen && !reviewItems,
    openCapture: () => setCaptureOpen(true),
    closeCapture: () => {
      parser.cancel();
      setCaptureOpen(false);
    },
    openManualForm: () => {
      setCaptureOpen(false);
      openForm(createEmptyDraft());
    },
    analyze,
    closeForm: () => {
      setFormOpen(false);
      setEditingIndex(null);
    },
    saveForm,
    editReviewItem: (index: number) => {
      if (!reviewItems?.[index]) return;
      setEditingIndex(index);
      openForm(reviewItems[index].draft, reviewItems[index]);
    },
    saveReviewed,
    closeReview: () => setReviewItems(null),
  };
}

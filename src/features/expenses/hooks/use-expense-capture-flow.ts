"use client";

import { useRef, useState } from "react";
import type { CaptureCommand } from "@/domain/capture-commands";
import type { CapturedDraft } from "@/domain/expense-capture";
import type {
  AppLanguage,
  CreateExpenseOptions,
  DraftExpense,
} from "@/domain/types";
import { createEmptyDraft } from "../lib/dashboard-config";
import { previousChargesOption, type PreviousChargesChoiceValue } from "../types";
import type { CaptureReason } from "../lib/capture-labels";
import { appendDictated } from "../lib/voice-support";
import type { useQuickExpenseParser } from "./use-quick-expense-parser";
import { useSpeechDictation } from "./use-speech-dictation";

type Review = Pick<CapturedDraft, "missingFields" | "inferredFields">;
// Un id estable por borrador: la selección no depende de la posición, que
// cambia al guardar uno desde el formulario.
export type ReviewItem = CapturedDraft & { id: string };
type InitialStatus = NonNullable<CreateExpenseOptions["initialStatus"]>;
// Órdenes de una captura pendientes de confirmar, y las altas que venían
// con ellas (se revisan después).
export type CommandReview = {
  id: number;
  commands: CaptureCommand[];
  drafts: CapturedDraft[];
};

// Flujo de añadir gastos: captura por texto (IA o local), formulario de uno
// y revisión de varios. El dashboard solo compone.
export function useExpenseCaptureFlow({
  parser,
  language,
  initialFormOpen,
  initialCaptureOpen = false,
  addExpense,
  addExpenses,
}: {
  parser: ReturnType<typeof useQuickExpenseParser>;
  language: AppLanguage;
  initialFormOpen: boolean;
  // Atajo "Añadir por voz": abre la captura; dictar exige un toque.
  initialCaptureOpen?: boolean;
  addExpense: (draft: DraftExpense, options?: CreateExpenseOptions) => void;
  addExpenses: (drafts: DraftExpense[], options?: CreateExpenseOptions) => void;
}) {
  const [captureOpen, setCaptureOpen] = useState(initialCaptureOpen);
  const [formOpen, setFormOpen] = useState(initialFormOpen);
  const [draft, setDraft] = useState<DraftExpense>(() => createEmptyDraft());
  const [draftReview, setDraftReview] = useState<Review | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null);
  // La selección y "ya pagado" viven aquí: la revisión se desmonta mientras
  // se edita uno de sus gastos.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = useState<InitialStatus>("due");
  const [reviewPreviousCharges, setReviewPreviousCharges] =
    useState<PreviousChargesChoiceValue>("paid");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Por qué se usó el análisis local, para avisarlo donde se abra el borrador.
  const [notice, setNotice] = useState<CaptureReason | null>(null);
  const [commandReview, setCommandReview] = useState<CommandReview | null>(null);
  // Cada apertura del formulario empieza de cero aunque el borrador coincida.
  const [formKey, setFormKey] = useState(0);
  // Una respuesta que llega después de cancelar o de pasar a manual se ignora.
  const requestRef = useRef(0);
  const nextIdRef = useRef(0);

  function openForm(nextDraft: DraftExpense, review: Review | null = null) {
    setDraft(nextDraft);
    setDraftReview(review);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  function supersede() {
    requestRef.current += 1;
    parser.cancel();
  }

  function clearReview() {
    setReviewItems(null);
    setExcludedIds(new Set());
    setReviewStatus("due");
    setReviewPreviousCharges("paid");
    setEditingId(null);
  }

  // Lo dictado se suma a lo ya escrito, se analiza una sola vez al terminar
  // y siempre pasa por revisión (formulario o lista).
  const dictationPrefixRef = useRef("");
  // Analizar durante el dictado lo termina y analiza el texto completo,
  // aunque no se haya oído nada.
  const analyzeAfterDictationRef = useRef(false);
  const dictation = useSpeechDictation({
    language,
    onTranscript: (text) => parser.setQuickText(appendDictated(dictationPrefixRef.current, text)),
    onFinish: (text) => {
      const requested = analyzeAfterDictationRef.current;
      analyzeAfterDictationRef.current = false;
      if (!text && !requested) return;
      const full = appendDictated(dictationPrefixRef.current, text);
      parser.setQuickText(full);
      if (full) void analyze(full);
    },
  });

  function toggleDictation() {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    // Mientras termina de entregar el dictado anterior no se empieza otro.
    if (dictation.busy) return;
    dictationPrefixRef.current = parser.quickText;
    analyzeAfterDictationRef.current = false;
    dictation.start();
  }

  function showDrafts(drafts: CapturedDraft[]) {
    if (drafts.length === 1) {
      openForm(drafts[0].draft, drafts[0]);
    } else if (drafts.length > 1) {
      clearReview();
      setReviewItems(
        drafts.map((item) => ({ ...item, id: `capture-${(nextIdRef.current += 1)}` })),
      );
    }
  }

  async function analyze(textOverride?: string) {
    const request = ++requestRef.current;
    const result = await parser.parse(textOverride);
    if (request !== requestRef.current) return;
    if (!result || result.drafts.length + result.commands.length === 0) return;

    setCaptureOpen(false);
    setNotice(result.provider === "local" ? result.reason : null);
    // Las órdenes se confirman primero; las altas, después.
    if (result.commands.length) {
      setCommandReview({
        id: (nextIdRef.current += 1),
        commands: result.commands,
        drafts: result.drafts,
      });
      return;
    }
    showDrafts(result.drafts);
  }

  // Tras aplicar o descartar las órdenes, siguen las altas de la misma
  // captura, si las había.
  function finishCommands() {
    const drafts = commandReview?.drafts ?? [];
    setCommandReview(null);
    if (drafts.length) {
      showDrafts(drafts);
      return;
    }
    setNotice(null);
    parser.reset();
  }

  function saveForm(nextDraft: DraftExpense, options?: CreateExpenseOptions) {
    addExpense(nextDraft, options);
    setFormOpen(false);
    if (editingId !== null && reviewItems) {
      const remaining = reviewItems.filter((item) => item.id !== editingId);
      setEditingId(null);
      if (remaining.length) {
        setReviewItems(remaining);
        return;
      }
      clearReview();
    }
    setNotice(null);
    parser.reset();
  }

  function saveReviewed() {
    if (!reviewItems) return;
    addExpenses(
      reviewItems
        .filter((item) => item.draft.amount > 0 && !excludedIds.has(item.id))
        .map((item) => item.draft),
      {
        initialStatus: reviewStatus,
        previousCharges: previousChargesOption(reviewPreviousCharges),
      },
    );
    clearReview();
    setNotice(null);
    parser.reset();
  }

  return {
    captureOpen,
    formOpen,
    formKey,
    draft,
    draftReview,
    notice,
    reviewItems: formOpen ? null : reviewItems,
    excludedIds,
    reviewStatus,
    reviewPreviousCharges,
    commandReview,
    finishCommands,
    isIdle: !captureOpen && !formOpen && !reviewItems && !commandReview,
    dictation: { ...dictation, toggle: toggleDictation },
    openCapture: () => {
      dictation.reset();
      setCaptureOpen(true);
    },
    closeCapture: () => {
      dictation.cancel();
      dictation.reset();
      supersede();
      setCaptureOpen(false);
    },
    cancelAnalysis: supersede,
    openManualForm: () => {
      dictation.cancel();
      dictation.reset();
      supersede();
      setCaptureOpen(false);
      setNotice(null);
      openForm(createEmptyDraft());
    },
    // Formulario con un borrador ya preparado (alta rápida de la guía).
    openDraftForm: (nextDraft: DraftExpense) => {
      supersede();
      setNotice(null);
      openForm(nextDraft);
    },
    // Analizar mientras se dicta (o mientras termina) lo deja terminar y
    // analiza una sola vez el texto completo.
    analyze: () => {
      if (dictation.busy) {
        analyzeAfterDictationRef.current = true;
        if (dictation.listening) dictation.stop();
        return;
      }
      void analyze();
    },
    closeForm: () => {
      setFormOpen(false);
      setEditingId(null);
    },
    saveForm,
    editReviewItem: (id: string) => {
      const item = reviewItems?.find((candidate) => candidate.id === id);
      if (!item) return;
      setEditingId(id);
      openForm(item.draft, item);
    },
    toggleReviewItem: (id: string) =>
      setExcludedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }),
    setReviewStatus,
    setReviewPreviousCharges,
    saveReviewed,
    closeReview: () => {
      clearReview();
      setNotice(null);
    },
  };
}

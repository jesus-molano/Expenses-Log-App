"use client";

import { useRef, useState } from "react";
import { toDateOnly } from "@/domain/calendar";
import { sanitizeCaptureCommands, type CaptureCommand } from "@/domain/capture-commands";
import {
  CAPTURE_TEXT_MAX_LENGTH,
  type CaptureField,
  type CapturedDraft,
} from "@/domain/expense-capture";
import { parseCaptureTextLocally } from "@/domain/parser";
import type { AppLanguage, DraftExpense } from "@/domain/types";
import { t } from "@/shared/i18n";
import { captureReasonLabel, type CaptureReason } from "../lib/capture-labels";

type ParserStatus = "idle" | "loading" | "done";
type ParserStatusTone = "neutral" | "success" | "warning";

export type { CaptureReason };

export type CaptureResult = {
  drafts: CapturedDraft[];
  // Órdenes sobre gastos existentes ("marca la luz pagada").
  commands: CaptureCommand[];
  provider: "gemini" | "local";
  reason: CaptureReason | null;
};

type ParseResponse = {
  provider?: "gemini" | "local";
  reason?: CaptureReason;
  expenses?: DraftExpense[];
  review?: Array<{ missingFields?: CaptureField[]; inferredFields?: CaptureField[] }>;
  commands?: unknown;
};

// El navegador espera algo más que el plazo del servidor (10 s) antes de
// rendirse y usar el parser local.
const CLIENT_TIMEOUT_MS = 12_000;

export function useQuickExpenseParser({
  language,
  categories,
  expenseNames = [],
}: {
  language: AppLanguage;
  categories: string[];
  // Gastos del usuario, para que la IA entienda órdenes sobre ellos.
  expenseNames?: string[];
}) {
  const [quickText, setQuickText] = useState("");
  const [status, setStatus] = useState<ParserStatus>("idle");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  function finish(next: CaptureResult) {
    setResult(next);
    setStatus("done");
    return next;
  }

  // `textOverride` para analizar justo lo que acaba de dictarse, sin esperar a
  // que el estado del texto se actualice.
  async function parse(textOverride?: string): Promise<CaptureResult | null> {
    // Un texto más largo que lo que acepta el servidor se recorta aquí en vez
    // de fallar con un 400 que parecería "IA no disponible".
    const text = (textOverride ?? quickText).trim().slice(0, CAPTURE_TEXT_MAX_LENGTH);
    if (!text) return null;

    const today = toDateOnly(new Date());
    const local = (reason: CaptureReason): CaptureResult => ({
      ...parseCaptureTextLocally(text, { today, categories }),
      provider: "local",
      reason,
    });
    if (!navigator.onLine) return finish(local("offline"));

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    cancelledRef.current = false;
    const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    setStatus("loading");
    setResult(null);

    try {
      const response = await fetch("/api/ai/parse-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, today, language, categories, expenseNames }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("AI parse failed");

      const payload = (await response.json()) as ParseResponse;
      return finish({
        drafts: (payload.expenses ?? []).map((draft, index) => ({
          draft,
          missingFields: payload.review?.[index]?.missingFields ?? [],
          inferredFields: payload.review?.[index]?.inferredFields ?? [],
        })),
        commands: sanitizeCaptureCommands(payload.commands),
        provider: payload.provider ?? "local",
        reason: payload.reason ?? null,
      });
    } catch (error) {
      if (cancelledRef.current) {
        setStatus("idle");
        return null;
      }
      return finish(
        local((error as { name?: string })?.name === "AbortError" ? "timeout" : "ai_unavailable"),
      );
    } finally {
      window.clearTimeout(timer);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function cancel() {
    cancelledRef.current = true;
    controllerRef.current?.abort();
    setStatus("idle");
  }

  function reset() {
    cancel();
    setQuickText("");
    setResult(null);
  }

  const found = result ? result.drafts.length + result.commands.length : 0;
  const statusLabel =
    status === "loading"
      ? t("expenses.analyzing", language)
      : status === "done" && result
        ? result.provider === "local"
          ? captureReasonLabel(result.reason, language)
          : found === 0
            ? t("expenses.aiNothingFound", language)
            : result.drafts.length === 0
              ? result.commands.length === 1
                ? t("captureCommands.foundOne", language)
                : t("captureCommands.foundMany", language).replace(
                    "{count}",
                    String(result.commands.length),
                  )
              : result.drafts.length > 1
                ? t("expenses.aiFoundMany", language).replace("{count}", String(result.drafts.length))
                : t("expenses.aiReady", language)
        : "";
  const statusTone: ParserStatusTone =
    status === "done" && result?.provider === "gemini" && found > 0
      ? "success"
      : status === "done"
        ? "warning"
        : "neutral";

  return {
    quickText,
    status,
    result,
    statusLabel,
    statusTone,
    needsLogin: result?.reason === "unauthenticated",
    setQuickText,
    parse,
    cancel,
    reset,
  };
}

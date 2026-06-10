"use client";

import { useState } from "react";
import { parseExpenseTextLocally } from "@/domain/parser";
import type { DraftExpense } from "@/domain/types";
import { createEmptyDraft } from "../lib/dashboard-config";

type ParserStatus = "idle" | "loading" | "gemini" | "local" | "error";

export function useQuickExpenseParser() {
  const [quickText, setQuickText] = useState("");
  const [status, setStatus] = useState<ParserStatus>("idle");

  async function parse(): Promise<DraftExpense | null> {
    const text = quickText.trim();
    if (!text) return null;

    setStatus("loading");

    try {
      const response = await fetch("/api/ai/parse-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("AI parse failed");

      const payload = await response.json();
      const first = payload.expenses?.[0] as DraftExpense | undefined;
      setStatus(payload.provider === "gemini" ? "gemini" : "local");
      return first ?? parseExpenseTextLocally(text)[0] ?? createEmptyDraft();
    } catch {
      setStatus("error");
      return parseExpenseTextLocally(text)[0] ?? createEmptyDraft();
    }
  }

  const statusLabel = {
    idle: "",
    loading: "Analizando...",
    gemini: "IA lista",
    local: "Parser local",
    error: "Parser local",
  }[status];

  return {
    quickText,
    status,
    statusLabel,
    setQuickText,
    parse,
  };
}

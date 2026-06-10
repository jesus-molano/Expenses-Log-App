"use client";

import { Search, Sparkles } from "lucide-react";

type QuickCaptureProps = {
  query: string;
  quickText: string;
  statusLabel: string;
  isParsing: boolean;
  onQueryChange: (value: string) => void;
  onQuickTextChange: (value: string) => void;
  onAnalyze: () => void;
};

export function QuickCapture({
  query,
  quickText,
  statusLabel,
  isParsing,
  onQueryChange,
  onQuickTextChange,
  onAnalyze,
}: QuickCaptureProps) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3">
        <Search size={18} className="text-slate-400" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar gasto"
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={quickText}
          onChange={(event) => onQuickTextChange(event.target.value)}
          placeholder="Ej. Netflix 15,99 mensual el dia 12 entretenimiento"
          className="h-12 rounded-2xl border border-slate-200 px-3 text-base outline-none transition focus:border-slate-900"
        />
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isParsing || !quickText.trim()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Sparkles size={18} />
          {isParsing ? "Analizando" : "Analizar"}
        </button>
      </div>
      {statusLabel ? <p className="mt-2 px-1 text-xs text-slate-500">{statusLabel}</p> : null}
    </section>
  );
}

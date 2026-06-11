"use client";

import { useState } from "react";

type ConfirmActionDialogProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  icon,
  title,
  body,
  cancelLabel,
  confirmLabel,
  confirmPhrase,
  confirmPhraseLabel,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [phrase, setPhrase] = useState("");
  const canConfirm = !loading && (!confirmPhrase || phrase === confirmPhrase);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[color-mix(in_srgb,var(--app-bg)_70%,transparent)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 backdrop-blur-md sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
    >
      <div className="w-full max-w-sm rounded-[1.35rem] border border-[color-mix(in_srgb,var(--app-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] p-4 text-[var(--app-text)] shadow-[var(--app-shadow)] ring-1 ring-[var(--app-border)]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--app-danger)_16%,transparent)] text-[var(--app-danger)] ring-1 ring-[color-mix(in_srgb,var(--app-danger)_26%,transparent)]">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-action-title" className="text-base font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">
              {body}
            </p>
          </div>
        </div>

        {confirmPhrase ? (
          <label className="mt-4 grid gap-1.5 text-xs font-semibold text-[var(--app-text-muted)]">
            {confirmPhraseLabel}
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              className="input-control h-11"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-2xl bg-[var(--app-panel-soft-alpha)] text-sm font-semibold text-[var(--app-text)] ring-1 ring-[var(--app-border)] transition hover:bg-[color-mix(in_srgb,var(--app-text)_10%,transparent)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="h-11 rounded-2xl bg-[color-mix(in_srgb,var(--app-danger)_22%,transparent)] text-sm font-semibold text-[var(--app-danger)] ring-1 ring-[color-mix(in_srgb,var(--app-danger)_34%,transparent)] transition hover:bg-[color-mix(in_srgb,var(--app-danger)_28%,transparent)] disabled:opacity-45"
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

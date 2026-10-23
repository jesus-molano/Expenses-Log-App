"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useDialogA11y } from "./use-dialog-a11y";
import { useHistoryLayer } from "./use-history-layer";

type ConfirmActionDialogProps = {
  icon?: React.ReactNode;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  // "danger" para lo que borra o no se puede deshacer.
  tone?: "danger" | "default";
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// Confirmación modal. Se monta solo mientras está abierta. Va en un portal
// sobre `body`: así un contenedor con transformación (una hoja animada) no
// descoloca el fondo fijo, y queda por encima de las hojas.
export function ConfirmActionDialog(props: ConfirmActionDialogProps) {
  if (typeof document === "undefined") return null;
  return createPortal(<ConfirmActionDialogPanel {...props} />, document.body);
}

function ConfirmActionDialogPanel({
  icon,
  title,
  body,
  cancelLabel,
  confirmLabel,
  tone = "danger",
  confirmPhrase,
  confirmPhraseLabel,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmActionDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const phraseId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [phrase, setPhrase] = useState("");
  const canConfirm = !loading && (!confirmPhrase || phrase === confirmPhrase);

  // Cancelar (botón, Escape, Atrás o tocar fuera) no hace nada mientras la
  // acción está en curso.
  function cancel() {
    if (!loading) onCancel();
  }

  // El foco empieza en Cancelar: Intro o un toque rápido no confirman algo
  // irreversible.
  useDialogA11y({ panelRef, onEscape: cancel, initialFocusRef: cancelRef });
  useHistoryLayer(true, cancel);

  return (
    <div
      className="app-sheet-backdrop app-dialog-backdrop z-[60]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={loading || undefined}
        tabIndex={-1}
        data-tone={tone}
        className="app-dialog app-confirm-dialog p-4"
      >
        <div className="flex items-start gap-3">
          {icon ? (
            <span
              className="app-confirm-icon grid size-10 shrink-0 place-items-center rounded-2xl"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-base font-semibold">
              {title}
            </h2>
            <p
              id={bodyId}
              className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]"
            >
              {body}
            </p>
          </div>
        </div>

        {confirmPhrase ? (
          <div className="mt-4 grid gap-1.5">
            <label
              htmlFor={phraseId}
              className="text-xs font-semibold text-[var(--app-text-muted)]"
            >
              {confirmPhraseLabel}
            </label>
            <input
              id={phraseId}
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              className="input-control h-11"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}

        {/* Las etiquetas largas ("Seguir editando") pasan a dos líneas a 360 px. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            disabled={loading}
            variant="secondary"
            className="min-w-0 py-2 text-center leading-tight"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            variant={tone === "danger" ? "danger" : "primary"}
            className="min-w-0 py-2 text-center leading-tight"
          >
            {loading ? "..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { X } from "lucide-react";
import { IconButton } from "./IconButton";

type SheetHeadingProps = {
  id?: string;
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
};

// Cabecera de hoja: asa en móvil, título, subtítulo y cerrar.
export function SheetHeading({ id, title, subtitle, closeLabel, onClose }: SheetHeadingProps) {
  return (
    <>
      <div className="app-sheet-handle mx-auto mb-3 sm:hidden" />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold text-[var(--app-text)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        <IconButton
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="shrink-0"
        >
          <X size={18} />
        </IconButton>
      </header>
    </>
  );
}

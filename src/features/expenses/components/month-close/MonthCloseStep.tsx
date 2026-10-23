import { useId, type ReactNode } from "react";

type MonthCloseStepProps = {
  number: number;
  title: string;
  // Acción opcional a la derecha del título (por ejemplo, "Pagar todo").
  action?: ReactNode;
  children: ReactNode;
};

// Paso numerado de la hoja de cierre. Todos se ven a la vez: se puede ir
// directo al último sin recorrer los demás.
export function MonthCloseStep({ number, title, action, children }: MonthCloseStepProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="grid min-w-0 gap-3">
      <header className="flex min-h-9 items-center justify-between gap-3">
        <h3
          id={titleId}
          className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--app-text)]"
        >
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--app-control)] text-xs text-[var(--app-accent)]"
          >
            {number}
          </span>
          <span className="min-w-0 break-words first-letter:uppercase">{title}</span>
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

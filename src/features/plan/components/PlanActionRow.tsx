import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { OfflineLink } from "@/components/ui/OfflineLink";

type PlanActionRowProps = {
  icon: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  // Etiqueta junto al título ("Para revisar").
  badge?: ReactNode;
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never });

const ROW_CLASS =
  "app-plan-action-row app-focus-ring flex min-h-14 w-full items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2 text-left";

// Fila de acción de Mes: icono, título, detalle y flecha. Abre una hoja
// (`onClick`) o lleva a otra pestaña (`href`).
export function PlanActionRow({ icon, label, detail, badge, ...target }: PlanActionRowProps) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--app-control)] text-[var(--app-accent)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-words text-sm font-semibold text-[var(--app-text)] first-letter:uppercase">
            {label}
          </span>
          {badge}
        </span>
        {detail ? (
          <span className="app-money mt-0.5 block break-words text-xs text-[var(--app-text-muted)]">
            {detail}
          </span>
        ) : null}
      </span>
      <ChevronRight
        size={17}
        aria-hidden="true"
        className="shrink-0 text-[var(--app-text-muted)]"
      />
    </>
  );

  return target.href !== undefined ? (
    <OfflineLink href={target.href} className={ROW_CLASS}>
      {content}
    </OfflineLink>
  ) : (
    <button type="button" onClick={target.onClick} className={ROW_CLASS}>
      {content}
    </button>
  );
}

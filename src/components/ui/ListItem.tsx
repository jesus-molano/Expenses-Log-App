import { cn } from "@/shared/ui";

type ListItemProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  // Se mantiene por compatibilidad: titulo y descripcion siempre saltan de
  // linea completos, nunca se cortan con elipsis.
  wrapDescription?: boolean;
};

export function ListItem({
  icon,
  title,
  description,
  action,
  className,
}: ListItemProps) {
  // La accion va al lado del texto, como en una tabla de dos columnas. El
  // bloque de texto (icono incluido) reserva al menos 7rem: solo si una accion
  // ancha (p. ej. el menu de tema) lo dejaria mas estrecho, la accion baja a
  // su propia linea y el texto usa todo el ancho en vez de partirse letra a
  // letra. Las acciones cortas (Activar, Google, ES...) siguen al lado.
  return (
    <div
      className={cn(
        "app-list-item flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2",
        className,
      )}
    >
      <span className="flex min-w-0 flex-[1_1_7rem] items-center gap-3">
        {icon ? (
          <span className="app-icon-badge size-9 min-h-9 min-w-9 shrink-0 text-[var(--app-accent)]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-[var(--app-text)] [overflow-wrap:anywhere]">
            {title}
          </span>
          {description ? (
            <span className="block break-words text-xs font-medium text-[var(--app-text-muted)] [overflow-wrap:anywhere]">
              {description}
            </span>
          ) : null}
        </span>
      </span>
      {action ? (
        <span className="ml-auto min-w-0 max-w-full shrink-0">{action}</span>
      ) : null}
    </div>
  );
}

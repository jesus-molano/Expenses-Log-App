import { Button } from "@/components/ui/Button";

type ActionToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// Aviso flotante breve con una acción opcional (por ejemplo, deshacer). Se
// anuncia a lectores de pantalla sin mover el foco.
export function ActionToast({ message, actionLabel, onAction }: ActionToastProps) {
  return (
    <aside className="app-action-toast" role="status">
      <p className="min-w-0 text-sm font-semibold text-[var(--app-text)]">
        {message}
      </p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </aside>
  );
}

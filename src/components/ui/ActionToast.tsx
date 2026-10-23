import { Button } from "@/components/ui/Button";

type ActionToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  // Para no cerrarlo mientras alguien lo está usando.
  onPause?: () => void;
  onResume?: () => void;
};

// Aviso flotante breve con una acción opcional (por ejemplo, deshacer). Se
// anuncia a lectores de pantalla sin mover el foco.
export function ActionToast({
  message,
  actionLabel,
  onAction,
  onPause,
  onResume,
}: ActionToastProps) {
  return (
    <aside
      className="app-action-toast"
      role="status"
      onFocus={onPause}
      onBlur={onResume}
      onPointerEnter={onPause}
      onPointerLeave={onResume}
    >
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

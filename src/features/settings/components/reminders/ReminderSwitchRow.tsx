import { useId } from "react";
import { Switch } from "@/components/ui/Switch";

type ReminderSwitchRowProps = {
  title: string;
  help: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  // Aviso extra bajo la ayuda (por ejemplo, falta configurar el cobro).
  note?: string;
};

export function ReminderSwitchRow({
  title,
  help,
  checked,
  onCheckedChange,
  note,
}: ReminderSwitchRowProps) {
  const titleId = useId();
  const helpId = useId();

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p id={titleId} className="text-sm font-semibold text-[var(--app-text)]">
          {title}
        </p>
        <p id={helpId} className="mt-0.5 text-xs leading-relaxed text-[var(--app-text-muted)]">
          {help}
          {note ? (
            <span className="mt-1 block font-semibold text-[var(--app-warning)]">{note}</span>
          ) : null}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={titleId}
        aria-describedby={helpId}
        className="mt-0.5"
      />
    </div>
  );
}

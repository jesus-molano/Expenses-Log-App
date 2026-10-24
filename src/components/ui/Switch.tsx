import { cn } from "@/shared/ui";

type SwitchProps = Omit<
  React.ComponentProps<"button">,
  "onChange" | "role" | "type" | "aria-checked"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  // Nombre accesible cuando no hay un texto visible con `aria-labelledby`.
  label?: string;
};

// Interruptor de sí/no con el estilo `app-switch`.
export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "on" : "off"}
      className={cn("app-switch", className)}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}

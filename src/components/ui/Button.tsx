import { cn } from "@/shared/ui";

// Incluye `ref` (React 19 lo pasa como prop): el diálogo de confirmación enfoca
// Cancelar al abrir.
type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "soft";
  size?: "sm" | "md" | "lg" | "icon" | "fab";
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
};

const variants = {
  primary: "app-button-primary",
  secondary: "app-button-secondary",
  danger: "app-button-danger",
  ghost: "app-button-ghost",
  soft: "app-button-soft",
};

const sizes = {
  sm: "app-button-sm",
  md: "",
  lg: "app-button-lg",
  icon: "size-11 px-0",
  fab: "size-13 rounded-full px-0",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  leadingIcon,
  trailingIcon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "app-button",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}


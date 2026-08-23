import { cn } from "@/shared/ui";

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "touch";
};

const variants = {
  default: "app-icon-button",
  danger: "app-icon-button app-icon-button-danger",
  ghost: "app-icon-button border-transparent bg-transparent",
};

const sizes = {
  sm: "app-icon-button-sm",
  md: "app-icon-button-md",
  lg: "app-icon-button-lg",
  touch: "app-icon-button-touch",
};

export function IconButton({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

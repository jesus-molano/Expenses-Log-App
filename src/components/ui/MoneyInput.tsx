"use client";

import { isValidMoneyInput } from "@/shared/money";
import { cn } from "@/shared/ui";

type MoneyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
  invalidMessage: string;
  allowZero?: boolean;
  // En editores sin <form> propio no debe bloquear el formulario que lo
  // contenga: solo se marca como inválido.
  blockSubmit?: boolean;
};

// Campo de importe que solo deja enviar un importe legible: un texto que no se
// entiende nunca se guarda como 0. Vacío no se marca en rojo, pero tampoco se
// puede enviar.
export function MoneyInput({
  value,
  onValueChange,
  invalidMessage,
  allowZero = false,
  blockSubmit = true,
  className,
  ...props
}: MoneyInputProps) {
  const empty = value.trim() === "";
  const valid = isValidMoneyInput(value, { allowZero });

  return (
    <input
      {...props}
      value={value}
      inputMode="decimal"
      required={blockSubmit}
      onChange={(event) => onValueChange(event.target.value)}
      ref={(input) =>
        input?.setCustomValidity(
          !blockSubmit || valid || empty ? "" : invalidMessage,
        )
      }
      aria-invalid={(!valid && !empty) || undefined}
      className={cn("input-control", className)}
    />
  );
}

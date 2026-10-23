"use client";

import { useId, useRef } from "react";
import { cn } from "@/shared/ui";

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ChoiceGroupProps<T extends string> = {
  label: string;
  hint?: string;
  value: T;
  options: Array<ChoiceOption<T>>;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  className?: string;
};

const columnClasses = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

// Elección única entre pocas opciones, como botones grandes (44 px). Se
// comporta como un grupo de radio: Tab entra en la opción elegida y las
// flechas cambian de opción.
export function ChoiceGroup<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  columns = 2,
  className,
}: ChoiceGroupProps<T>) {
  const labelId = useId();
  const hintId = useId();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );

  function select(index: number) {
    const option = options[(index + options.length) % options.length];
    if (!option) return;
    onChange(option.value);
    buttonsRef.current[options.indexOf(option)]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(index - 1);
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="grid gap-0.5">
        <p id={labelId} className="text-sm font-semibold text-[var(--app-text-muted)]">
          {label}
        </p>
        {hint ? (
          <p id={hintId} className="text-xs text-[var(--app-text-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        className={cn("grid gap-2", columnClasses[columns])}
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={option.value}
              ref={(button) => {
                buttonsRef.current[index] = button;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              data-selected={selected ? "true" : "false"}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className="app-control app-focus-ring grid min-h-11 content-center gap-0.5 px-3 py-2 text-left text-sm font-semibold"
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {option.description ? (
                <span className="text-xs font-medium opacity-80">{option.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

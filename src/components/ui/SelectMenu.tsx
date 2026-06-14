import { CompactMenu } from "./CompactMenu";

export type SelectMenuOption<T extends string | number> = {
  value: T;
  label: string;
  detail?: string;
  description?: string;
  leading?: React.ReactNode;
};

type SelectMenuProps<T extends string | number> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: T;
  options: Array<SelectMenuOption<T>>;
  onChange: (value: T) => void;
  label?: string;
  align?: "left" | "right";
};

export function SelectMenu<T extends string | number>({
  open,
  onOpenChange,
  value,
  options,
  onChange,
  label,
  align,
}: SelectMenuProps<T>) {
  const selected = options.find((option) => option.value === value);
  const sortedOptions = [...options].sort((left, right) =>
    left.label.localeCompare(right.label, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  function selectOption(nextValue: T, restoreFocus: boolean) {
    onChange(nextValue);
    onOpenChange(false);
    window.requestAnimationFrame(() => {
      if (restoreFocus) {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
    });
  }

  return (
    <CompactMenu
      open={open}
      onOpenChange={onOpenChange}
      label={label ?? selected?.label ?? String(value)}
      leading={selected?.leading}
      align={align}
      menuRole="listbox"
    >
      {sortedOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={value === option.value}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            selectOption(option.value, event.detail === 0);
          }}
          className="app-select-menu-option flex min-h-9 w-full items-center justify-between gap-3 rounded-[var(--app-radius-sm)] px-3 py-2 text-left text-sm font-semibold"
          data-selected={value === option.value ? "true" : "false"}
        >
          <span className="flex min-w-0 items-center gap-2">
            {option.leading}
            <span className="min-w-0">
              <span className="block truncate">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block truncate text-xs font-medium text-[var(--app-text-muted)]">
                  {option.description}
                </span>
              ) : null}
            </span>
          </span>
          {option.detail ? (
            <span className="shrink-0 text-xs opacity-75">{option.detail}</span>
          ) : null}
        </button>
      ))}
    </CompactMenu>
  );
}

import { CompactMenu } from "./CompactMenu";

export type SelectMenuOption<T extends string | number> = {
  value: T;
  label: string;
  detail?: string;
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

  return (
    <CompactMenu
      open={open}
      onOpenChange={onOpenChange}
      label={label ?? selected?.label ?? String(value)}
      leading={selected?.leading}
      align={align}
      menuRole="listbox"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={value === option.value}
          onClick={() => {
            onChange(option.value);
            onOpenChange(false);
          }}
          className="app-select-menu-option flex h-9 w-full items-center justify-between gap-3 rounded-[var(--app-radius-sm)] px-3 text-left text-sm font-semibold"
          data-selected={value === option.value ? "true" : "false"}
        >
          <span className="flex min-w-0 items-center gap-2">
            {option.leading}
            <span className="truncate">{option.label}</span>
          </span>
          {option.detail ? (
            <span className="shrink-0 text-xs opacity-75">{option.detail}</span>
          ) : null}
        </button>
      ))}
    </CompactMenu>
  );
}

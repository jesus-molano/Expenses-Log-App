"use client";

type ExpenseFieldProps = {
  label: string;
  children: React.ReactNode;
};

export function ExpenseField({ label, children }: ExpenseFieldProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-200">
      {label}
      {children}
    </label>
  );
}

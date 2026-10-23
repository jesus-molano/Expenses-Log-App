export type SyncStatus = "local" | "syncing" | "synced" | "pending" | "error";

export type MoneySettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsMonthId: string;
  savingsTarget: number;
};

export type MonthlySavingsTargetInput = {
  monthId: string;
  savingsTarget: number;
};

export type MonthlySavingsContributionInput = {
  monthId: string;
  amount: number;
  transferredAt?: string;
};

// "Solo este mes" o "Desde este mes" al editar el sueldo de un mes.
export type SalaryScope = "month" | "fromMonth";

export type MonthlySalaryInput = {
  monthId: string;
  salaryAmount: number;
  salaryDay: number;
  // Sin ámbito se mantiene el comportamiento anterior: desde ese mes, salvo
  // en un mes pasado, que no cambia los siguientes.
  scope?: SalaryScope;
};

export type SalaryExtraPayInput = {
  monthId: string;
  months: number[];
  // Sin importe, cada paga extra es un sueldo más.
  amount?: number;
};

export type SalaryReceiptInput = {
  monthId: string;
  amount: number;
  receivedOn: string;
};

export type IncomeEventInput = {
  name: string;
  amount: number;
  receivedAt: string;
  note?: string;
};

export type MonthlyExpenseOverrideInput = {
  templateId: string;
  occurrenceDate: string;
  dueDate: string;
  name: string;
  amount: number;
  categoryId?: string;
  categoryName?: string;
  status: import("@/domain/types").OccurrenceStatus;
  // Lo pagado de verdad, si difiere de lo previsto (recibos variables).
  amountPaid?: number;
};

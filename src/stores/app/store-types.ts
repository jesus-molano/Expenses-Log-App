export type SyncStatus = "local" | "syncing" | "synced" | "error";

export type MoneySettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsMonthId: string;
  savingsTarget: number;
  accounts: import("@/domain/types").PlanAccount[];
};

export type MonthlySavingsTargetInput = {
  monthId: string;
  savingsTarget: number;
};

export type MonthlySalaryInput = {
  monthId: string;
  salaryAmount: number;
  salaryDay: number;
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
  categoryId: string;
  status: import("@/domain/types").OccurrenceStatus;
};

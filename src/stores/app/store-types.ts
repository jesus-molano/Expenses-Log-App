export type SyncStatus = "local" | "syncing" | "synced" | "error";

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
  categoryId?: string;
  categoryName?: string;
  status: import("@/domain/types").OccurrenceStatus;
};

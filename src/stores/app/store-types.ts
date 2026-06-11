export type SyncStatus = "local" | "syncing" | "synced" | "error";

export type MoneySettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsMonthId: string;
  savingsTarget: number;
  expensesAccountName: string;
  savingsAccountName: string;
  primaryAccountName: string;
};

export type MonthlySavingsTargetInput = {
  monthId: string;
  savingsTarget: number;
};

export type IncomeEventInput = {
  name: string;
  amount: number;
  receivedAt: string;
  note?: string;
};

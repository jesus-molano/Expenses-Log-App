export type SyncStatus = "local" | "syncing" | "synced" | "error";

export type MoneySettingsInput = {
  salaryAmount: number;
  salaryDay: number;
  savingsTarget: number;
  expensesAccountName: string;
  savingsAccountName: string;
  primaryAccountName: string;
};

export type IncomeEventInput = {
  name: string;
  amount: number;
  receivedAt: string;
  note?: string;
};

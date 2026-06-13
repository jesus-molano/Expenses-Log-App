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
  categoryId?: string;
  categoryName?: string;
  status: import("@/domain/types").OccurrenceStatus;
};

export type BankImportDecision = {
  candidateId: string;
  action: "match" | "create" | "ignore";
  movements: import("@/domain/types").BankMovement[];
  templateId?: string;
  occurrenceDate?: string;
  movementMatches?: Array<{
    movementId: string;
    occurrenceDate: string;
  }>;
  expense?: import("@/domain/types").DraftExpense;
  alias?: {
    merchantKey: string;
    label: string;
    templateId: string;
  };
};

export type BankImportInput = {
  decisions: BankImportDecision[];
};

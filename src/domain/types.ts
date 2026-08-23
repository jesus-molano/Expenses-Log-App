export type RecurrenceFrequency =
  | "once"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom"
  | "rrule";

export type CustomRecurrenceUnit = "day" | "week" | "month" | "year";

export type OccurrenceStatus = "due" | "paid" | "skipped";

export type CategoryTone =
  | "blue"
  | "green"
  | "orange"
  | "rose"
  | "violet"
  | "slate";

export type ExpenseCategory = {
  id: string;
  userId: string;
  name: string;
  icon: string;
  tone: CategoryTone;
};

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval?: number;
  unit?: CustomRecurrenceUnit;
  rrule?: string;
  annualMonth?: number;
};

export type ExpenseTemplate = {
  id: string;
  userId: string;
  name: string;
  description: string;
  amount: number;
  currency: "EUR";
  categoryId: string;
  startDate: string;
  endDate?: string;
  dueDay: number;
  recurrence: RecurrenceRule;
  reminder?: ExpenseReminderSettings;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseReminderSettings = {
  enabled: boolean;
  daysBeforeCharge: number;
};

export type ExpenseOccurrenceOverride = {
  id: string;
  userId: string;
  templateId: string;
  occurrenceDate: string;
  dueDate?: string;
  sortOrder?: number;
  status: OccurrenceStatus;
  name?: string;
  amount?: number;
  categoryId?: string;
  paidAt?: string;
  amountPaid?: number;
  note?: string;
  reminderDismissedAt?: string;
  reminderDismissedChargeDate?: string;
  updatedAt?: string;
};

export type ExpenseOccurrence = {
  id: string;
  template: ExpenseTemplate;
  occurrenceDate: string;
  dueDate: string;
  estimatedChargeDate: string;
  estimatedChargeLabel: string;
  status: OccurrenceStatus;
  sortOrder: number;
  override?: ExpenseOccurrenceOverride;
  record?: ExpenseOccurrenceRecord;
};

export type DraftExpense = {
  name: string;
  description: string;
  amount: number;
  categoryName: string;
  startDate?: string;
  dueDay: number;
  endDate?: string;
  recurrence: RecurrenceRule;
  reminder?: ExpenseReminderSettings;
};

export type CreateExpenseOptions = {
  initialStatus?: Extract<OccurrenceStatus, "due" | "paid">;
};

export type IncomeEvent = {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: "EUR";
  receivedAt: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlySalarySettings = {
  amount: number;
  dayOfMonth: number;
  updatedAt?: string;
};

export type MonthlySavingsTarget = {
  amount: number;
  updatedAt: string;
};

export type MonthlySavingsContribution = {
  id: string;
  userId: string;
  monthId: string;
  amount: number;
  transferredAt?: string;
  source: "manual" | "legacy";
  createdAt: string;
  updatedAt: string;
};

export type PlanAccountPurpose =
  | "salary"
  | "expenses"
  | "daily"
  | "savings"
  | "investment"
  | "other";

export type PlanAccount = {
  id: string;
  name: string;
  purposes: PlanAccountPurpose[];
};

export type FinanceStore = {
  incomeEvents: IncomeEvent[];
  monthlySalary: Record<string, MonthlySalarySettings>;
  monthlySavingsTargets: Record<string, number | MonthlySavingsTarget>;
  monthlySavingsContributions?: Record<string, MonthlySavingsContribution>;
  accounts: PlanAccount[];
};

export type ExpenseOccurrenceRecordSource =
  | "native"
  | "legacy-derived"
  | "bank-import";

export type ExpenseOccurrenceRecord = {
  id: string;
  userId: string;
  templateId: string;
  occurrenceDate: string;
  monthId: string;
  dueDate: string;
  name: string;
  description: string;
  plannedAmount: number;
  currency: "EUR";
  categoryId: string;
  categoryName: string;
  status: OccurrenceStatus;
  sortOrder: number;
  paidAt?: string;
  amountPaid?: number;
  source: ExpenseOccurrenceRecordSource;
  createdAt: string;
  updatedAt: string;
};

export type BankMovement = {
  id: string;
  userId: string;
  fingerprint: string;
  bookedAt: string;
  description: string;
  amount: number;
  currency: "EUR";
  account?: string;
  balance?: number;
  merchantKey: string;
  importBatchId: string;
  matchedTemplateId?: string;
  matchedOccurrenceDate?: string;
  matchedIncomeEventId?: string;
  matchedSalaryMonth?: string;
  createdAt: string;
};

export type BankMerchantAlias = {
  id: string;
  userId: string;
  merchantKey: string;
  templateId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type AppTheme =
  | "atlas"
  | "obsidian-amber"
  | "vice-afterglow"
  | "catppuccin"
  | "rose-pine"
  | "nord"
  | "dracula"
  | "tokyo-night";
export type AppLanguage = "es" | "en";

export type MonthlyMoneyPlan = {
  month: string;
  phase: "registered" | "current" | "projected";
  plannedIncomeTotal: number;
  incomeTotal: number;
  fixedIncomeTotal: number;
  salaryIncomeTotal: number;
  extraIncomeTotal: number;
  plannedExpensesTotal: number;
  paidExpensesTotal: number;
  pendingExpensesTotal: number;
  expectedExpensesTotal: number;
  plannedExpenseCount: number;
  paidExpenseCount: number;
  pendingExpenseCount: number;
  savingsTarget: number;
  savingsActual: number;
  savingsReserved: number;
  savingsGoalRemaining: number;
  maxSavingsCapacity: number;
  freeAccordingToPlan: number;
  billsShortfall: number;
  savingsGoalShortfall: number;
  nextPending?: {
    id: string;
    name: string;
    dueDate: string;
    amount: number;
    overdue: boolean;
  };
  // Compatibilidad temporal con los consumidores del reparto existente.
  expensesContribution: number;
  savingsContribution: number;
  remainingContribution: number;
  investmentContribution: number;
  shortfall: number;
};

export type ExpenseStore = {
  schemaVersion?: 2;
  categories: ExpenseCategory[];
  templates: ExpenseTemplate[];
  overrides: ExpenseOccurrenceOverride[];
  occurrenceRecords?: ExpenseOccurrenceRecord[];
  finance: FinanceStore;
  bankMovements: BankMovement[];
  bankMerchantAliases: BankMerchantAlias[];
  deleted?: {
    categories?: string[];
    templates?: string[];
    overrides?: string[];
    incomeEvents?: string[];
    bankMovements?: string[];
    bankMerchantAliases?: string[];
    occurrenceRecords?: string[];
    savingsContributions?: string[];
  };
  preferences?: {
    theme: AppTheme;
    language?: AppLanguage;
  };
};

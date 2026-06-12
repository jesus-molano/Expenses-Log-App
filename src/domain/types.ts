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
  active: boolean;
  createdAt: string;
  updatedAt: string;
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
  monthlySavingsTargets: Record<string, number>;
  accounts: PlanAccount[];
};

export type AppTheme = "dark" | "rose-pine" | "catppuccin" | "light";
export type AppLanguage = "es" | "en";

export type MonthlyMoneyPlan = {
  month: string;
  incomeTotal: number;
  salaryIncomeTotal: number;
  extraIncomeTotal: number;
  plannedExpensesTotal: number;
  expensesContribution: number;
  savingsContribution: number;
  remainingContribution: number;
  investmentContribution: number;
  shortfall: number;
};

export type ExpenseStore = {
  categories: ExpenseCategory[];
  templates: ExpenseTemplate[];
  overrides: ExpenseOccurrenceOverride[];
  finance: FinanceStore;
  deleted?: {
    categories?: string[];
    templates?: string[];
    overrides?: string[];
    incomeEvents?: string[];
  };
  preferences?: {
    theme: AppTheme;
    language?: AppLanguage;
  };
};

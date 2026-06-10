export type RecurrenceFrequency =
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
};

export type ExpenseTemplate = {
  id: string;
  userId: string;
  name: string;
  description: string;
  amount: number;
  currency: "EUR";
  categoryId: string;
  tags: string[];
  startDate: string;
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
  status: OccurrenceStatus;
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
  override?: ExpenseOccurrenceOverride;
};

export type DraftExpense = {
  name: string;
  description: string;
  amount: number;
  categoryName: string;
  tags: string[];
  dueDay: number;
  recurrence: RecurrenceRule;
};

export type ExpenseStore = {
  categories: ExpenseCategory[];
  templates: ExpenseTemplate[];
  overrides: ExpenseOccurrenceOverride[];
};

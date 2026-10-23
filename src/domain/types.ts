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
  // Para fusionar por entidad como el resto. Las categorías antiguas no lo
  // tienen: entonces gana la copia local.
  updatedAt?: string;
};

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval?: number;
  unit?: CustomRecurrenceUnit;
  rrule?: string;
  annualMonth?: number;
};

// Cambio de precio con fecha: desde `from` (incluido) cada cobro cuesta
// `amount`. Antes del primero rige el `amount` de la plantilla.
export type ExpenseAmountChange = {
  from: string;
  amount: number;
};

// Pausa de una serie: no se generan los cobros con fecha entre `from` y `to`
// (ambos incluidos). Sin `to`, dura hasta que se reanude.
export type ExpensePause = {
  from: string;
  to?: string;
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
  amountChanges?: ExpenseAmountChange[];
  pauses?: ExpensePause[];
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
  // Último cambio de estado (status, paidAt, amountPaid). Al fusionar, el
  // estado sale de aquí y el resto de campos de `updatedAt`.
  statusUpdatedAt?: string;
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
  // Estado del cobro de este mes que ya pasó.
  initialStatus?: Extract<OccurrenceStatus, "due" | "paid">;
  // Qué hacer con los cobros de meses anteriores cuando el gasto empezó antes
  // de este mes. Sin valor quedan pendientes.
  previousCharges?: PreviousChargesResolution;
};

export type PreviousChargesResolution = Extract<OccurrenceStatus, "paid" | "skipped">;

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
  // "Solo este mes": vale para su mes y los siguientes vuelven al anterior.
  onlyThisMonth?: boolean;
};

// Pagas extra: meses (1-12) en los que llega una paga además del sueldo. Vale
// desde su mes, como el sueldo. Sin importe, cada paga es un sueldo más.
export type SalaryExtraPaySettings = {
  months: number[];
  amount?: number;
  updatedAt: string;
};

// Respuesta a "¿Has cobrado?" de un mes. Deshacer marca `undone` en lugar de
// borrar la entrada, para que el merge con otro dispositivo lo respete.
export type SalaryReceipt = {
  amount: number;
  receivedOn: string;
  updatedAt: string;
  undone?: boolean;
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

// Mes dado por terminado para pasar al siguiente. Reabrirlo guarda
// `reopenedAt` en lugar de borrar la entrada, para que el merge lo respete.
export type MonthClosure = {
  closedAt: string;
  updatedAt: string;
  reopenedAt?: string;
};

export type FinanceStore = {
  incomeEvents: IncomeEvent[];
  monthlySalary: Record<string, MonthlySalarySettings>;
  monthlySavingsTargets: Record<string, number | MonthlySavingsTarget>;
  monthlySavingsContributions?: Record<string, MonthlySavingsContribution>;
  monthClosures?: Record<string, MonthClosure>;
  salaryExtraPays?: Record<string, SalaryExtraPaySettings>;
  salaryReceipts?: Record<string, SalaryReceipt>;
};

export type ExpenseOccurrenceRecordSource = "native" | "legacy-derived";

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
  // Parte del sueldo previsto que es paga extra (ya incluida en el sueldo).
  salaryExtraPayTotal: number;
  // Lo que se respondió en "¿Has cobrado?"; si existe, es el sueldo del mes.
  salaryReceipt?: SalaryReceipt;
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
};

export type ExpenseStore = {
  schemaVersion?: 3;
  categories: ExpenseCategory[];
  templates: ExpenseTemplate[];
  overrides: ExpenseOccurrenceOverride[];
  occurrenceRecords?: ExpenseOccurrenceRecord[];
  finance: FinanceStore;
  deleted?: {
    categories?: string[];
    templates?: string[];
    overrides?: string[];
    incomeEvents?: string[];
    occurrenceRecords?: string[];
    savingsContributions?: string[];
    // Borrados de sueldo por hora (`salaryClearedTombstone`).
    monthlySalary?: string[];
  };
  preferences?: {
    theme: AppTheme;
    language?: AppLanguage;
  };
};

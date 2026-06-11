export type MoneySeriesItem = {
  id: string;
  month: string;
  monthLong: string;
  income: number;
  expenses: number;
  free: number;
  savings: number;
  shortfall: number;
  hasRecords: boolean;
};

export type PlanAccountNames = {
  expensesAccountName: string;
  savingsAccountName: string;
  primaryAccountName: string;
};

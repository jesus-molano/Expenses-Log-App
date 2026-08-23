export type MoneySeriesItem = {
  id: string;
  month: string;
  monthLong: string;
  income: number;
  expenses: number;
  remaining: number;
  savings: number;
  shortfall: number;
  hasRecords: boolean;
  phase?: "registered" | "current" | "projected";
  plannedExpenses?: number;
  paid?: number;
  pending?: number;
  savingsGoal?: number;
  capacity?: number;
};

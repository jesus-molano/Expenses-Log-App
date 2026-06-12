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
};

export type { PlanAccount, PlanAccountPurpose } from "@/domain/types";

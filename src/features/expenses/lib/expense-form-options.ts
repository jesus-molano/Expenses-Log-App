import {
  BriefcaseBusiness,
  Car,
  CreditCard,
  Dumbbell,
  Gamepad2,
  HeartPulse,
  Home,
  PawPrint,
  Sparkles,
  TrainFront,
  Utensils,
  User,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type {
  CustomRecurrenceUnit,
  RecurrenceFrequency,
} from "@/domain/types";

export const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const RECURRENCE_OPTIONS: Array<{
  value: RecurrenceFrequency;
  labelKey: "once" | "monthly" | "quarterly" | "yearly" | "custom";
}> = [
  { value: "once", labelKey: "once" },
  { value: "monthly", labelKey: "monthly" },
  { value: "quarterly", labelKey: "quarterly" },
  { value: "yearly", labelKey: "yearly" },
  { value: "custom", labelKey: "custom" },
];

export const CUSTOM_UNITS: Array<{
  value: CustomRecurrenceUnit;
  labelKey: "daysUnit" | "weeksUnit" | "monthsUnit" | "yearsUnit";
}> = [
  { value: "day", labelKey: "daysUnit" },
  { value: "week", labelKey: "weeksUnit" },
  { value: "month", labelKey: "monthsUnit" },
  { value: "year", labelKey: "yearsUnit" },
];

export const categoryIconMap: Record<string, LucideIcon> = {
  Home,
  Sparkles,
  WalletCards,
  Car,
  CreditCard,
  HeartPulse,
  Gamepad2,
  User,
  Utensils,
  TrainFront,
  Dumbbell,
  BriefcaseBusiness,
  PawPrint,
};

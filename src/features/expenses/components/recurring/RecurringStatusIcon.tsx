import { AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";
import type { RecurringOverviewStatus } from "@/features/expenses/lib/recurring-overview";

type RecurringStatusIconProps = {
  status: RecurringOverviewStatus;
};

export function RecurringStatusIcon({ status }: RecurringStatusIconProps) {
  if (status === "overdue") {
    return <AlertTriangle className="shrink-0 text-[var(--app-danger)]" size={16} />;
  }

  if (status === "settled") {
    return <CheckCircle2 className="shrink-0 text-[var(--app-success)]" size={16} />;
  }

  return <Calendar className="shrink-0 text-[var(--app-accent)]" size={16} />;
}

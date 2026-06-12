import type {
  AppLanguage,
  ExpenseCategory,
  ExpenseOccurrence,
} from "@/domain/types";
import { ExpenseRowContent } from "./row/ExpenseRowContent";

type ExpenseDragPreviewProps = {
  occurrence: ExpenseOccurrence | null;
  category?: ExpenseCategory;
  today: string;
  language: AppLanguage;
};

export function ExpenseDragPreview({
  occurrence,
  category,
  today,
  language,
}: ExpenseDragPreviewProps) {
  if (!occurrence) return null;

  return (
    <div className="app-drag-preview grid min-h-14 w-[min(32rem,calc(100vw-2rem))] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2.5">
      <ExpenseRowContent
        occurrence={occurrence}
        category={category}
        today={today}
        language={language}
      />
    </div>
  );
}

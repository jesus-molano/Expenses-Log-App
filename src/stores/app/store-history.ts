import { mergeLatestById } from "@/data/persistence/merge-by-id";
import { materializeClosedOccurrenceRecords } from "@/domain/finance";
import type { ExpenseStore } from "@/domain/types";

export function preserveClosedOccurrenceRecords(
  currentStore: ExpenseStore,
  nextStore: ExpenseStore,
  today = new Date(),
): ExpenseStore {
  const recordedCurrent = materializeClosedOccurrenceRecords(currentStore, {
    today,
  });

  return {
    ...nextStore,
    schemaVersion: 2,
    occurrenceRecords: mergeLatestById(
      recordedCurrent.occurrenceRecords ?? [],
      nextStore.occurrenceRecords ?? [],
      nextStore.deleted?.occurrenceRecords,
    ),
  };
}

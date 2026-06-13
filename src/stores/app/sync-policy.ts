import type { ExpenseStore } from "@/domain/types";
import { mergeExpenseStores } from "@/data/persistence/local-store";

export type HydrationResolution = {
  mergedStore: ExpenseStore;
  shouldHydrateReactState: boolean;
  shouldSaveCloud: boolean;
};

export function resolveHydratedStore({
  initialLocalStore,
  latestLocalStore,
  cloudStore,
  revisionAtCloudLoad,
  currentRevision,
}: {
  initialLocalStore: ExpenseStore;
  latestLocalStore: ExpenseStore;
  cloudStore: ExpenseStore | null;
  revisionAtCloudLoad: number;
  currentRevision: number;
}): HydrationResolution {
  const hasLocalEditsDuringHydration = currentRevision > revisionAtCloudLoad;
  const localStore =
    hasLocalEditsDuringHydration ? latestLocalStore : initialLocalStore;

  if (cloudStore) {
    return {
      mergedStore: hasLocalEditsDuringHydration
        ? mergeExpenseStores(localStore, cloudStore)
        : cloudStore,
      shouldHydrateReactState: !hasLocalEditsDuringHydration,
      shouldSaveCloud: hasLocalEditsDuringHydration,
    };
  }

  return {
    mergedStore: localStore,
    shouldHydrateReactState: !hasLocalEditsDuringHydration,
    shouldSaveCloud: true,
  };
}

export function shouldQueueCloudSave({
  hydrated,
  hasSupabase,
  hasUser,
}: {
  hydrated: boolean;
  hasSupabase: boolean;
  hasUser: boolean;
}) {
  return hydrated && hasSupabase && hasUser;
}

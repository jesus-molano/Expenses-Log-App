import type { ExpenseStore } from "@/domain/types";
import { mergeExpenseStores } from "@/data/persistence/local-store";

export type HydrationResolution = {
  mergedStore: ExpenseStore;
  shouldHydrateReactState: boolean;
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
  const localStore =
    currentRevision > revisionAtCloudLoad ? latestLocalStore : initialLocalStore;

  return {
    mergedStore: mergeExpenseStores(localStore, cloudStore),
    shouldHydrateReactState: currentRevision === revisionAtCloudLoad,
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

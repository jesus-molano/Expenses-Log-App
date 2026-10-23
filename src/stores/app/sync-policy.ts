import type { ExpenseStore } from "@/domain/types";
import { mergeExpenseStores } from "@/data/persistence/local-store";

export type HydrationResolution = {
  mergedStore: ExpenseStore;
  shouldSaveCloud: boolean;
};

// La nube gana salvo que el dispositivo tenga cambios sin subir de esta misma
// cuenta (`localDirty`, persistido entre sesiones) o se haya editado mientras
// cargaba la nube: entonces se fusionan y se sube el resultado.
export function resolveHydratedStore({
  initialLocalStore,
  latestLocalStore,
  cloudStore,
  revisionAtCloudLoad,
  currentRevision,
  localDirty = false,
}: {
  initialLocalStore: ExpenseStore;
  latestLocalStore: ExpenseStore;
  cloudStore: ExpenseStore | null;
  revisionAtCloudLoad: number;
  currentRevision: number;
  localDirty?: boolean;
}): HydrationResolution {
  const hasLocalEditsDuringHydration = currentRevision > revisionAtCloudLoad;
  const localStore =
    hasLocalEditsDuringHydration ? latestLocalStore : initialLocalStore;
  const keepLocalChanges = hasLocalEditsDuringHydration || localDirty;

  if (cloudStore) {
    return {
      mergedStore: keepLocalChanges
        ? mergeExpenseStores(localStore, cloudStore)
        : cloudStore,
      shouldSaveCloud: keepLocalChanges,
    };
  }

  return {
    mergedStore: localStore,
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

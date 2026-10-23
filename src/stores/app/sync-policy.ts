import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { mergeExpenseStores } from "@/data/persistence/local-store";

export type HydrationResolution = {
  mergedStore: ExpenseStore;
  shouldSaveCloud: boolean;
};

// La nube gana salvo que el dispositivo tenga cambios sin subir de esta misma
// cuenta (`localDirty`, persistido entre sesiones) o se haya editado mientras
// cargaba la nube: entonces se fusionan y se sube el resultado. Los datos de
// otra cuenta (`localIsForeign`) nunca se fusionan ni se suben a esta.
export function resolveHydratedStore({
  initialLocalStore,
  latestLocalStore,
  cloudStore,
  revisionAtCloudLoad,
  currentRevision,
  localDirty = false,
  localIsForeign = false,
}: {
  initialLocalStore: ExpenseStore;
  latestLocalStore: ExpenseStore;
  cloudStore: ExpenseStore | null;
  revisionAtCloudLoad: number;
  currentRevision: number;
  localDirty?: boolean;
  localIsForeign?: boolean;
}): HydrationResolution {
  const hasLocalEditsDuringHydration = currentRevision > revisionAtCloudLoad;
  const localStore =
    hasLocalEditsDuringHydration ? latestLocalStore : initialLocalStore;

  if (localIsForeign) {
    return {
      mergedStore: cloudStore ?? {
        ...emptyStore,
        preferences: localStore.preferences,
      },
      shouldSaveCloud: false,
    };
  }

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

const TRANSIENT_ERROR_PATTERN =
  /fetch|network|abort|timeout|timed out|load failed|PGRST00[0-2]|50[234]/i;

// Fallos que se arreglan solos (sin red, servidor reiniciando, petición
// cortada): se reintenta y los cambios se muestran como pendientes. El resto
// se enseña como error.
export function isTransientSyncError(error: unknown) {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const { name, code, message } = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
  };
  return TRANSIENT_ERROR_PATTERN.test(
    [name, code, message].filter((part) => typeof part === "string").join(" "),
  );
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

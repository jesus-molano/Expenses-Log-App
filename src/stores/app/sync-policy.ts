import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { emptyStore } from "@/domain/seed";
import type { ExpenseStore } from "@/domain/types";
import { mergeExpenseStores } from "@/data/persistence/local-store";
import { normalizeExpenseStore } from "@/data/persistence/store-normalization";
import { CloudSaveConflictError } from "./cloud-save-queue";
import { reconcileOrphanOverrides } from "./occurrence-overrides";

export type HydrationResolution = {
  mergedStore: ExpenseStore;
  shouldSaveCloud: boolean;
};

// Fusión de dos copias del store (otro dispositivo, otra pestaña o la nube):
// merge por entidad y, después, los overrides que la fusión dejó en fechas
// que la plantilla ya no genera vuelven a su cobro.
export function mergeStoresForSync(
  localStore: ExpenseStore,
  otherStore: ExpenseStore | null,
  today: Date = new Date(),
): ExpenseStore {
  return reconcileOrphanOverrides(mergeExpenseStores(localStore, otherStore), today);
}

// La nube gana salvo que el dispositivo tenga cambios sin subir de esta misma
// cuenta (`localDirty`, persistido entre sesiones) o se haya editado mientras
// cargaba la nube: entonces se fusionan y se sube el resultado. Los datos de
// otra cuenta (`localIsForeign`) nunca se fusionan ni se suben a esta. Si la
// nube trae overrides huérfanos (de un build sin reconciliar), se recolocan y
// también se sube.
export function resolveHydratedStore({
  initialLocalStore,
  latestLocalStore,
  cloudStore,
  revisionAtCloudLoad,
  currentRevision,
  localDirty = false,
  localIsForeign = false,
  today = new Date(),
}: {
  initialLocalStore: ExpenseStore;
  latestLocalStore: ExpenseStore;
  cloudStore: ExpenseStore | null;
  revisionAtCloudLoad: number;
  currentRevision: number;
  localDirty?: boolean;
  localIsForeign?: boolean;
  today?: Date;
}): HydrationResolution {
  const hasLocalEditsDuringHydration = currentRevision > revisionAtCloudLoad;
  const localStore =
    hasLocalEditsDuringHydration ? latestLocalStore : initialLocalStore;

  if (localIsForeign) {
    if (!cloudStore) {
      return {
        mergedStore: { ...emptyStore, preferences: localStore.preferences },
        shouldSaveCloud: false,
      };
    }
    const reconciled = reconcileOrphanOverrides(cloudStore, today);
    return { mergedStore: reconciled, shouldSaveCloud: reconciled !== cloudStore };
  }

  const keepLocalChanges = hasLocalEditsDuringHydration || localDirty;

  if (cloudStore) {
    if (keepLocalChanges) {
      return {
        mergedStore: mergeStoresForSync(localStore, cloudStore, today),
        shouldSaveCloud: true,
      };
    }
    const reconciled = reconcileOrphanOverrides(cloudStore, today);
    return { mergedStore: reconciled, shouldSaveCloud: reconciled !== cloudStore };
  }

  return {
    mergedStore: localStore,
    shouldSaveCloud: true,
  };
}

// Otra pestaña guardó: se fusiona con lo que muestra esta. Las preferencias
// (tema, idioma) vienen de la escritura más reciente, la suya; las dos
// comparten además la cookie que las fija.
export function mergeStoreFromOtherTab(
  currentStore: ExpenseStore,
  otherTabStore: ExpenseStore,
  today: Date = new Date(),
): ExpenseStore {
  const merged = mergeStoresForSync(currentStore, otherTabStore, today);
  return { ...merged, preferences: otherTabStore.preferences ?? merged.preferences };
}

// Mismo contenido aunque uno venga normalizado y el otro no, o con las claves
// en otro orden: evita hidratar (y avisar de cambios) cuando una fusión no
// trae nada nuevo.
export function storesEquivalent(a: ExpenseStore, b: ExpenseStore) {
  const today = new Date();
  return (
    stableStringify(normalizeExpenseStore(a, today)) ===
    stableStringify(normalizeExpenseStore(b, today))
  );
}

function stableStringify(value: unknown) {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : nested,
  );
}

// Al volver a la app se trae la nube como mucho cada 30 s, y nunca con un
// guardado en marcha: ese guardado ya detecta (y fusiona) los cambios ajenos.
export const CLOUD_PULL_THROTTLE_MS = 30_000;

export function shouldPullCloud({
  cloudReady,
  busy,
  lastCloudContactAt,
  now,
}: {
  cloudReady: boolean;
  busy: boolean;
  lastCloudContactAt: number;
  now: number;
}) {
  return cloudReady && !busy && now - lastCloudContactAt >= CLOUD_PULL_THROTTLE_MS;
}

const TRANSIENT_ERROR_PATTERN =
  /fetch|network|abort|timeout|timed out|load failed|PGRST00[0-2]|50[234]/i;

// Fallos que se arreglan solos (sin red, servidor reiniciando, petición
// cortada, la nube cambiando una y otra vez mientras se guardaba): se
// reintenta y los cambios se muestran como pendientes. El resto se enseña
// como error.
export function isTransientSyncError(error: unknown) {
  if (
    isAuthRetryableFetchError(error) ||
    error instanceof TypeError ||
    error instanceof CloudSaveConflictError
  ) {
    return true;
  }
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

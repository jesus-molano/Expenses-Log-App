import type { User } from "@supabase/supabase-js";
import type { AppSupabaseClient, Json } from "@/data/supabase/database.types";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import type { ExpenseStore } from "@/domain/types";
import {
  assignExpenseStoreOwner,
  normalizeExpenseStore,
} from "./store-normalization";

const METADATA_STORE_KEY = "expense_store";
const METADATA_SYNCED_AT_KEY = "expense_store_synced_at";

// Una petición a la nube que no contesta (red que acepta conexiones y no
// responde) debe fallar para que la sincronización pueda reintentar.
export const CLOUD_REQUEST_TIMEOUT_MS = 20_000;

function requestTimeout() {
  return AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS);
}

export type CloudStoreResult = {
  store: ExpenseStore | null;
  mode: "table" | "unavailable";
};

export type CloudStoreSaveResult = {
  mode: "table" | "unavailable";
};

export async function loadCloudStore(
  supabase: AppSupabaseClient,
  user: User,
): Promise<CloudStoreResult> {
  const { data, error } = await supabase
    .from("app_stores")
    .select("store")
    .eq("user_id", toDatabaseUuid(user.id))
    .abortSignal(requestTimeout())
    .maybeSingle();

  if (!error) {
    return {
      store: data?.store
        ? assignExpenseStoreOwner(normalizeExpenseStore(data.store), user.id)
        : null,
      mode: "table",
    };
  }

  if (!isMissingAppStoresError(error)) {
    throw error;
  }

  return {
    store: null,
    mode: "unavailable",
  };
}

export async function saveCloudStore(
  supabase: AppSupabaseClient,
  user: User,
  store: ExpenseStore,
): Promise<CloudStoreSaveResult> {
  const { error } = await supabase
    .from("app_stores")
    .upsert({
      user_id: toDatabaseUuid(user.id),
      store: assignExpenseStoreOwner(store, user.id) as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .abortSignal(requestTimeout());

  if (!error) return { mode: "table" };

  if (!isMissingAppStoresError(error)) {
    throw error;
  }

  return { mode: "unavailable" };
}

export async function clearOversizedMetadata(supabase: AppSupabaseClient) {
  const { error } = await supabase.auth.updateUser({
    data: {
      [METADATA_STORE_KEY]: null,
      [METADATA_SYNCED_AT_KEY]: null,
    },
  });

  if (error) throw error;
}

// Solo la tabla inexistente cuenta como "sin nube". Un fallo temporal de
// PostgREST (PGRST002, "schema cache") o de permisos es un error a reintentar:
// tratarlo como "sin nube" daría por guardados cambios que no han subido.
export function isMissingAppStoresError(error: { code?: string; message?: string }) {
  if (error.code) return error.code === "PGRST205" || error.code === "42P01";
  const message = error.message ?? "";
  return (
    message.includes("PGRST205") ||
    /relation "(public\.)?app_stores" does not exist/.test(message)
  );
}

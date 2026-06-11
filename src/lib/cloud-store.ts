import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ExpenseStore } from "@/domain/types";

const METADATA_STORE_KEY = "expense_store";
const METADATA_SYNCED_AT_KEY = "expense_store_synced_at";

export type CloudStoreResult = {
  store: ExpenseStore | null;
  mode: "table" | "unavailable";
};

export type CloudStoreSaveResult = {
  mode: "table" | "unavailable";
};

export async function loadCloudStore(
  supabase: SupabaseClient,
  user: User,
): Promise<CloudStoreResult> {
  const { data, error } = await supabase
    .from("app_stores")
    .select("store")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!error) {
    return {
      store: (data?.store as ExpenseStore | null) ?? null,
      mode: "table",
    };
  }

  if (!isMissingAppStoresError(error.message)) {
    throw error;
  }

  return {
    store: null,
    mode: "unavailable",
  };
}

export async function saveCloudStore(
  supabase: SupabaseClient,
  user: User,
  store: ExpenseStore,
): Promise<CloudStoreSaveResult> {
  const { error } = await supabase.from("app_stores").upsert({
    user_id: user.id,
    store,
    updated_at: new Date().toISOString(),
  });

  if (!error) return { mode: "table" };

  if (!isMissingAppStoresError(error.message)) {
    throw error;
  }

  return { mode: "unavailable" };
}

export async function clearOversizedMetadata(supabase: SupabaseClient) {
  const { error } = await supabase.auth.updateUser({
    data: {
      [METADATA_STORE_KEY]: null,
      [METADATA_SYNCED_AT_KEY]: null,
    },
  });

  if (error) throw error;
}

export function isMissingAppStoresError(message: string) {
  return (
    message.includes("app_stores") ||
    message.includes("schema cache") ||
    message.includes("PGRST205")
  );
}

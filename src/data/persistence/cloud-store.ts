import type { User } from "@supabase/supabase-js";
import type { AppSupabaseClient, Json } from "@/data/supabase/database.types";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { isMissingRpcError } from "@/data/supabase/rpc-errors";
import type { ExpenseStore } from "@/domain/types";
import {
  assignExpenseStoreOwner,
  normalizeExpenseStore,
} from "./store-normalization";

const METADATA_STORE_KEY = "expense_store";
const METADATA_SYNCED_AT_KEY = "expense_store_synced_at";
const SAVE_RPC = "save_app_store";

// Una petición a la nube que no contesta (red que acepta conexiones y no
// responde) debe fallar para que la sincronización pueda reintentar.
export const CLOUD_REQUEST_TIMEOUT_MS = 20_000;

// Sin la migración del CAS el RPC no existe: se guarda con el upsert de
// siempre y no se vuelve a probar hasta pasado este tiempo, para no pagar una
// petición fallida en cada guardado.
export const SAVE_RPC_RETRY_MS = 10 * 60_000;

function requestTimeout() {
  return AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS);
}

export type CloudStoreResult = {
  store: ExpenseStore | null;
  mode: "table" | "unavailable";
  // Revisión de la fila para el compare-and-swap: null si no hay fila o si
  // la base aún no tiene la columna.
  revision: number | null;
};

// `revision: null` en un guardado correcto significa que se guardó sin CAS
// (base sin migrar): el siguiente guardado no puede comprobar nada.
export type CloudStoreSaveResult =
  | { status: "saved"; mode: "table"; revision: number | null }
  | { status: "saved"; mode: "unavailable"; revision: null }
  | { status: "conflict"; revision: number | null };

export async function loadCloudStore(
  supabase: AppSupabaseClient,
  user: User,
): Promise<CloudStoreResult> {
  // `*` y no "store, revision": sin la migración la columna no existe y
  // pedirla por nombre haría fallar la carga.
  const { data, error } = await supabase
    .from("app_stores")
    .select("*")
    .eq("user_id", toDatabaseUuid(user.id))
    .abortSignal(requestTimeout())
    .maybeSingle();

  if (!error) {
    return {
      store: data?.store
        ? assignExpenseStoreOwner(normalizeExpenseStore(data.store), user.id)
        : null,
      mode: "table",
      revision: data ? revisionOf(data.revision) : null,
    };
  }

  if (!isMissingAppStoresError(error)) {
    throw error;
  }

  return {
    store: null,
    mode: "unavailable",
    revision: null,
  };
}

// Guarda solo si la nube sigue en `expectedRevision` (null: "aún no hay
// fila"). Si otro dispositivo guardó antes devuelve el conflicto en lugar de
// pisarlo; quien llama fusiona y reintenta.
export async function saveCloudStore(
  supabase: AppSupabaseClient,
  user: User,
  store: ExpenseStore,
  expectedRevision: number | null = null,
): Promise<CloudStoreSaveResult> {
  const payload = assignExpenseStoreOwner(store, user.id) as unknown as Json;

  if (Date.now() >= saveRpcMissingUntil) {
    const { data, error } = await supabase
      .rpc(SAVE_RPC, {
        p_store: payload,
        p_expected_revision: expectedRevision,
      })
      .abortSignal(requestTimeout());

    if (!error) return parseSaveResponse(data);
    if (isMissingAppStoresError(error)) return UNAVAILABLE_SAVE;
    if (!isMissingRpcError(error, SAVE_RPC)) throw error;
    rememberMissingSaveRpc(error);
  }

  return saveWithoutRevision(supabase, user, payload);
}

const UNAVAILABLE_SAVE: CloudStoreSaveResult = {
  status: "saved",
  mode: "unavailable",
  revision: null,
};

// El guardado anterior al CAS: lo usan los clientes antiguos y este mientras
// la migración no esté aplicada. Con ella aplicada, el trigger sube la
// revisión y los demás dispositivos lo ven como un conflicto.
async function saveWithoutRevision(
  supabase: AppSupabaseClient,
  user: User,
  payload: Json,
): Promise<CloudStoreSaveResult> {
  const { error } = await supabase
    .from("app_stores")
    .upsert({
      user_id: toDatabaseUuid(user.id),
      store: payload,
      updated_at: new Date().toISOString(),
    })
    .abortSignal(requestTimeout());

  if (!error) return { status: "saved", mode: "table", revision: null };

  if (!isMissingAppStoresError(error)) {
    throw error;
  }

  return UNAVAILABLE_SAVE;
}

function parseSaveResponse(data: unknown): CloudStoreSaveResult {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const { status, revision } = data as { status?: unknown; revision?: unknown };
    if (status === "saved" && typeof revision === "number") {
      return { status: "saved", mode: "table", revision };
    }
    if (status === "conflict") {
      return { status: "conflict", revision: revisionOf(revision) };
    }
  }
  throw new Error("Unexpected save_app_store response.");
}

function revisionOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  // PostgREST puede devolver un bigint como texto según la configuración.
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

let saveRpcMissingUntil = 0;
let loggedMissingSaveRpc = false;

function rememberMissingSaveRpc(error: { message?: string }) {
  saveRpcMissingUntil = Date.now() + SAVE_RPC_RETRY_MS;
  if (loggedMissingSaveRpc) return;
  loggedMissingSaveRpc = true;
  console.warn(
    "save_app_store is not available yet (migration 20261023120000 not applied); saving without revision checks.",
    error.message,
  );
}

// Solo para tests: vuelve a probar el RPC y a registrar su ausencia.
export function resetCloudStoreCapabilities() {
  saveRpcMissingUntil = 0;
  loggedMissingSaveRpc = false;
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
// PostgREST (PGRST002, "schema cache"), de permisos o la falta del RPC del
// CAS (PGRST202) es otra cosa: tratarlo como "sin nube" daría por guardados
// cambios que no han subido.
export function isMissingAppStoresError(error: { code?: string; message?: string }) {
  if (isMissingRpcError(error, SAVE_RPC)) return false;
  if (error.code) return error.code === "PGRST205" || error.code === "42P01";
  const message = error.message ?? "";
  return (
    message.includes("PGRST205") ||
    /relation "(public\.)?app_stores" does not exist/.test(message)
  );
}

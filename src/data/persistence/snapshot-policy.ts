import { toDateOnly } from "@/domain/calendar";
import type { StoreSummary } from "@/domain/store-summary";
import type { ExpenseStore } from "@/domain/types";

// Copias del store guardadas en este dispositivo. La diaria se hace sola al
// abrir la app; el resto, justo antes de importar, restaurar o limpiar, o
// cuando el usuario la pide.
export type SnapshotReason =
  | "daily"
  | "before-import"
  | "before-restore"
  | "before-clear"
  | "manual";

export type StoreSnapshot = {
  id: string;
  createdAt: string;
  reason: SnapshotReason;
  // Huella del contenido, para no repetir una copia idéntica a la anterior.
  hash: string;
  summary: StoreSummary;
  store: ExpenseStore;
};

export const SNAPSHOT_LIMITS = { daily: 7, other: 5 } as const;

const REASONS: SnapshotReason[] = [
  "daily",
  "before-import",
  "before-restore",
  "before-clear",
  "manual",
];

// FNV-1a de 32 bits sobre el JSON sin las preferencias (cambiar de tema no
// es un cambio de datos). Basta para detectar que nada ha cambiado.
export function hashStoreContent(store: ExpenseStore): string {
  const content = JSON.stringify({ ...store, preferences: undefined });
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// Una diaria por día natural, y solo si los datos han cambiado desde la
// última copia de cualquier tipo.
export function shouldTakeDailySnapshot(
  snapshots: StoreSnapshot[],
  { now, hash }: { now: Date; hash: string },
): boolean {
  const today = toDateOnly(now);
  const latest = sortNewestFirst(snapshots)[0];
  const tookDailyToday = snapshots.some(
    (snapshot) =>
      snapshot.reason === "daily" && toDateOnly(new Date(snapshot.createdAt)) === today,
  );
  return !tookDailyToday && latest?.hash !== hash;
}

// Ids que sobran: se quedan las 7 diarias y las 5 de otro tipo más recientes.
export function snapshotsToPrune(snapshots: StoreSnapshot[]): string[] {
  const sorted = sortNewestFirst(snapshots);
  const daily = sorted.filter((snapshot) => snapshot.reason === "daily");
  const other = sorted.filter((snapshot) => snapshot.reason !== "daily");
  return [
    ...daily.slice(SNAPSHOT_LIMITS.daily),
    ...other.slice(SNAPSHOT_LIMITS.other),
  ].map((snapshot) => snapshot.id);
}

export function sortNewestFirst(snapshots: StoreSnapshot[]): StoreSnapshot[] {
  return [...snapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Lo leído de IndexedDB puede venir de otra versión o estar dañado: solo
// valen las entradas con forma de copia.
export function isStoreSnapshot(value: unknown): value is StoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<StoreSnapshot>;
  return (
    typeof snapshot.id === "string" &&
    typeof snapshot.createdAt === "string" &&
    !Number.isNaN(Date.parse(snapshot.createdAt)) &&
    REASONS.includes(snapshot.reason as SnapshotReason) &&
    typeof snapshot.hash === "string" &&
    Boolean(snapshot.summary) &&
    Boolean(snapshot.store) &&
    typeof snapshot.store === "object"
  );
}

// Almacenamiento persistente del navegador (Storage API). Sin él, el navegador
// puede borrar localStorage e IndexedDB cuando le falta espacio; con él, solo
// los borra el usuario. Chrome lo concede solo (app instalada o muy usada) y
// Firefox lo pregunta.
export type StoragePersistence = {
  supported: boolean;
  persisted: boolean;
  usage: number | null;
  quota: number | null;
};

export async function readStoragePersistence(): Promise<StoragePersistence> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage?.persisted || !storage.persist) {
    return { supported: false, persisted: false, usage: null, quota: null };
  }

  const [persisted, estimate] = await Promise.all([
    storage.persisted().catch(() => false),
    storage.estimate?.().catch(() => null) ?? Promise.resolve(null),
  ]);
  return {
    supported: true,
    persisted,
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
  };
}

export async function requestStoragePersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

type PostgrestLikeError = { code?: string; message?: string };

// PostgREST responde PGRST202 cuando la función no existe (o su caché de
// esquema aún no la ve): la migración que la crea no se ha aplicado. El
// cliente cae entonces al camino anterior en lugar de fallar.
export function isMissingRpcError(error: PostgrestLikeError, functionName: string) {
  const message = error.message ?? "";
  if (error.code === "PGRST202" || message.includes("PGRST202")) return true;
  return (
    new RegExp(`could not find the function (public\\.)?${functionName}\\b`, "i").test(
      message,
    ) ||
    (error.code === "42883" && message.includes(functionName))
  );
}

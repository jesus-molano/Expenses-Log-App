export const DEFAULT_REDIRECT_PATH = "/settings";

// Controles (tab, saltos de línea, NUL…), DEL y barra invertida. El parser de
// URL quita los controles sin avisar y trata "\" como "/", así que
// "/\t/evil.com" o "/\evil.com" acabarían siendo "//evil.com": otro host.
const UNSAFE_REDIRECT_CHARS = /[\u0000-\u001F\u007F\\]/;

// Destino tras volver del login: solo una ruta de la propia app. `next` llega
// ya decodificado por URLSearchParams y no se decodifica otra vez. Se resuelve
// contra el origen de la petición y se devuelve la ruta normalizada (sin
// "/./", "/../" ni host), que nunca empieza por "//".
export function resolveSafeRedirectPath(
  next: string | null | undefined,
  origin: string,
): string {
  if (!next || !next.startsWith("/") || UNSAFE_REDIRECT_CHARS.test(next)) {
    return DEFAULT_REDIRECT_PATH;
  }

  try {
    const base = new URL(origin);
    const url = new URL(next, base);
    if (url.origin !== base.origin || url.pathname.startsWith("//")) {
      return DEFAULT_REDIRECT_PATH;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT_PATH;
  }
}

// Guía de instalación en iPhone/iPad: en iOS los avisos push solo funcionan
// con la app añadida a la pantalla de inicio (iOS 16.4 o posterior), así que
// "no soportado" no basta: hay que explicar cómo instalarla.

export type InstallGuide = "ios-safari" | "ios-other";

export type InstallEnvironment = {
  userAgent: string;
  maxTouchPoints: number;
  // Abierta ya como app instalada.
  standalone: boolean;
};

export function detectInstallGuide(env: InstallEnvironment): InstallGuide | null {
  if (env.standalone) return null;
  const { userAgent } = env;
  // iPadOS se presenta como Mac de escritorio; se distingue por el táctil.
  const isIos =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && env.maxTouchPoints > 1);
  if (!isIos) return null;
  // Chrome, Firefox, Edge u Opera en iOS: el botón Compartir está en otro sitio.
  return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent) ? "ios-other" : "ios-safari";
}

export function readInstallEnvironment(): InstallEnvironment {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone:
      standaloneNavigator.standalone === true ||
      Boolean(window.matchMedia?.("(display-mode: standalone)").matches),
  };
}

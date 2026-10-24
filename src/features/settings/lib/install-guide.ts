// Guía de instalación en iPhone/iPad: en iOS los avisos push solo funcionan
// con la app añadida a la pantalla de inicio (iOS 16.4 o posterior), así que
// "no soportado" no basta: hay que explicar cómo instalarla.

import { isAppleMobile, isStandaloneDisplay } from "@/shared/platform";

export type InstallGuide = "ios-safari" | "ios-other";

export type InstallEnvironment = {
  userAgent: string;
  maxTouchPoints: number;
  // Abierta ya como app instalada.
  standalone: boolean;
};

export function detectInstallGuide(env: InstallEnvironment): InstallGuide | null {
  if (env.standalone) return null;
  // iPadOS se presenta como Mac de escritorio; se distingue por el táctil.
  if (!isAppleMobile(env)) return null;
  // Chrome, Firefox, Edge u Opera en iOS: el botón Compartir está en otro sitio.
  return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(env.userAgent) ? "ios-other" : "ios-safari";
}

export function readInstallEnvironment(): InstallEnvironment {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: isStandaloneDisplay(),
  };
}

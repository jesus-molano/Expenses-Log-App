import type { AppLanguage } from "@/domain/types";

type SpeechRecognitionHost = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  navigator: Pick<Navigator, "userAgent" | "maxTouchPoints">;
};

// El dictado del navegador (Web Speech API) solo es fiable en Chromium fuera
// de iOS: en iOS y Safari falta o se cuelga en apps instaladas, así que allí
// se oculta y se sugiere el micrófono del teclado.
export function getDictationSupport(host: SpeechRecognitionHost) {
  if (!host.SpeechRecognition && !host.webkitSpeechRecognition) return false;
  const userAgent = host.navigator.userAgent;
  const isAppleTouch =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && host.navigator.maxTouchPoints > 1);
  if (isAppleTouch) return false;
  return /Chrome\/|Chromium\/|Edg\//.test(userAgent);
}

export function dictationLanguage(language: AppLanguage) {
  return language === "en" ? "en-US" : "es-ES";
}

export type DictationError =
  | "offline"
  | "not-allowed"
  | "no-speech"
  | "network"
  | "audio-capture"
  | "service-not-allowed"
  | "language-not-supported";

export function toDictationError(code: string): DictationError | null {
  switch (code) {
    case "not-allowed":
    case "no-speech":
    case "network":
    case "audio-capture":
    case "service-not-allowed":
    case "language-not-supported":
      return code;
    // "aborted" lo provoca la propia app al parar.
    default:
      return null;
  }
}

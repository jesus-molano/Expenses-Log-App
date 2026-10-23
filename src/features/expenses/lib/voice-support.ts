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

// Lo dictado tras lo escrito: si lo escrito acaba en salto de línea (otro
// gasto), lo dictado va en su propia línea.
export function appendDictated(typed: string, dictated: string) {
  if (/\n\s*$/.test(typed) && dictated.trim()) return `${typed.trimEnd()}\n${dictated.trim()}`;
  return joinWords(typed, dictated);
}

// Une trozos de texto con un solo espacio, sin huecos de los vacíos.
export function joinWords(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

type RecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };

// "doscientos" no empieza por la palabra "dos": un prefijo de una sola
// palabra tiene que acabar en un límite de palabra. Una frase de varias
// palabras que Android reenvía puede cambiar el final de la última ("doce
// euro" → "doce euros") y sigue siendo la misma.
function startsWithWords(text: string, prefix: string) {
  const folded = text.toLocaleLowerCase();
  const foldedPrefix = prefix.toLocaleLowerCase();
  if (!folded.startsWith(foldedPrefix)) return false;
  if (folded.length === foldedPrefix.length || /\s/.test(foldedPrefix.trim())) return true;
  return /[^\p{L}\p{N}]/u.test(folded[foldedPrefix.length]);
}

// Texto de una sesión de reconocimiento a partir de todos sus resultados.
// Chrome en Android puede repetir en cada resultado lo ya dicho ("café",
// "café cinco euros"): un final que empieza por el anterior lo sustituye en
// lugar de sumarse, y lo parcial no repite lo ya fijado.
export function sessionTranscript(results: ArrayLike<RecognitionResultLike>) {
  const finals: string[] = [];
  let interim = "";
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const text = result[0].transcript.trim();
    if (!text) continue;
    if (!result.isFinal) {
      interim = joinWords(interim, text);
      continue;
    }
    const last = finals.at(-1);
    if (last && startsWithWords(text, last)) {
      finals[finals.length - 1] = text;
    } else if (!last || !startsWithWords(last, text)) {
      finals.push(text);
    }
  }
  const final = finals.join(" ");
  const lastFinal = finals.at(-1);
  if (lastFinal && startsWithWords(interim, lastFinal)) {
    interim = interim.slice(lastFinal.length).trim();
  }
  return { final, interim };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppLanguage } from "@/domain/types";
import {
  dictationLanguage,
  getDictationSupport,
  joinWords,
  sessionTranscript,
  toDictationError,
  type DictationError,
} from "../lib/voice-support";

export const DICTATION_MAX_MS = 30_000;
export const DICTATION_SILENCE_MS = 2_000;
// Al parar, el reconocedor entrega lo que aún procesa antes de terminar; si
// tarda más que esto, se entrega lo que haya.
export const DICTATION_STOP_GRACE_MS = 1_200;
// En Android `continuous` no tiene efecto y cada frase termina la sesión: se
// reinicia, con un tope para no entrar en bucle si el micro falla.
const MAX_RESTARTS = 20;

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
type Phase = "idle" | "listening" | "stopping";

function recognitionConstructor(): RecognitionConstructor | null {
  const host = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

// Dictado con el reconocimiento del navegador. Termina al tocar de nuevo, a
// los 30 s, tras 2 s sin oír nada nuevo o al salir de la app; entonces
// entrega el texto una sola vez (vacío si no se oyó nada). Un error o
// cerrar la hoja lo terminan sin entregar: lo oído queda en el campo.
export function useSpeechDictation({
  language,
  onTranscript,
  onFinish,
}: {
  language: AppLanguage;
  onTranscript: (text: string) => void;
  onFinish: (text: string) => void;
}) {
  const [supported] = useState(
    () => typeof window !== "undefined" && getDictationSupport(window),
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<DictationError | null>(null);
  // Si el navegador no permite el servicio (p. ej. Brave) no tiene sentido
  // seguir ofreciéndolo en esta sesión.
  const [unavailable, setUnavailable] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const phaseRef = useRef<Phase>("idle");
  // Lo dicho en sesiones anteriores (Android reinicia tras cada frase) y en
  // la actual.
  const committedRef = useRef("");
  const sessionRef = useRef({ final: "", interim: "" });
  const heardRef = useRef(false);
  const restartsRef = useRef(0);
  const maxTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onTranscript, onFinish });

  useEffect(() => {
    callbacksRef.current = { onTranscript, onFinish };
  }, [onFinish, onTranscript]);

  const clearTimers = useCallback(() => {
    for (const timer of [maxTimerRef, silenceTimerRef, stopTimerRef]) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const transcript = useCallback(
    () => joinWords(committedRef.current, sessionRef.current.final, sessionRef.current.interim),
    [],
  );

  const teardown = useCallback(() => {
    clearTimers();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    phaseRef.current = "idle";
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // Ya estaba parado.
    }
  }, [clearTimers]);

  const deliver = useCallback(() => {
    if (phaseRef.current !== "stopping") return;
    const text = transcript();
    teardown();
    callbacksRef.current.onFinish(text);
  }, [teardown, transcript]);

  // Con `shouldDeliver`, pide al reconocedor que entregue lo que aún procesa
  // (stop, no abort) y luego pasa el texto a onFinish; sin él, lo descarta.
  const finish = useCallback(
    (shouldDeliver = true) => {
      const phase = phaseRef.current;
      if (phase === "idle") return;
      setListening(false);
      if (!shouldDeliver) {
        teardown();
        return;
      }
      if (phase === "stopping") return;
      phaseRef.current = "stopping";
      clearTimers();
      const recognition = recognitionRef.current;
      try {
        recognition?.stop();
      } catch {
        deliver();
        return;
      }
      if (!recognition) {
        deliver();
        return;
      }
      stopTimerRef.current = window.setTimeout(deliver, DICTATION_STOP_GRACE_MS);
    },
    [clearTimers, deliver, teardown],
  );

  const start = useCallback(() => {
    if (phaseRef.current !== "idle" || !supported || unavailable) return;
    if (!navigator.onLine) {
      setError("offline");
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) return;

    committedRef.current = "";
    sessionRef.current = { final: "", interim: "" };
    heardRef.current = false;
    restartsRef.current = 0;
    phaseRef.current = "listening";
    setError(null);
    setListening(true);

    const recognition = new Constructor();
    recognition.lang = dictationLanguage(language);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      sessionRef.current = sessionTranscript(event.results);
      if (sessionRef.current.final || sessionRef.current.interim) heardRef.current = true;
      callbacksRef.current.onTranscript(transcript());
      if (phaseRef.current !== "listening" || !heardRef.current) return;
      // Cualquier resultado, también parcial, cuenta como seguir hablando.
      if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => finish(), DICTATION_SILENCE_MS);
    };

    recognition.onerror = (event) => {
      if (phaseRef.current === "stopping") {
        deliver();
        return;
      }
      const code = toDictationError(event.error);
      if (!code) return;
      if (code === "no-speech" && heardRef.current) {
        finish();
        return;
      }
      if (code === "service-not-allowed" && !heardRef.current) setUnavailable(true);
      setError(code);
      finish(false);
    };

    recognition.onend = () => {
      if (phaseRef.current === "stopping") {
        deliver();
        return;
      }
      if (phaseRef.current !== "listening") return;
      // Lo de esta sesión, también lo aún parcial, pasa a la parte fija antes
      // de volver a escuchar.
      committedRef.current = transcript();
      sessionRef.current = { final: "", interim: "" };
      if (restartsRef.current >= MAX_RESTARTS) {
        phaseRef.current = "stopping";
        setListening(false);
        deliver();
        return;
      }
      restartsRef.current += 1;
      // La misma instancia se puede volver a arrancar cuando ha terminado.
      try {
        recognition.start();
      } catch {
        phaseRef.current = "stopping";
        setListening(false);
        deliver();
      }
    };

    recognitionRef.current = recognition;
    maxTimerRef.current = window.setTimeout(() => finish(), DICTATION_MAX_MS);
    try {
      recognition.start();
    } catch {
      teardown();
      setListening(false);
    }
  }, [deliver, finish, language, supported, teardown, transcript, unavailable]);

  useEffect(() => {
    function stopWhenHidden() {
      if (document.visibilityState === "hidden") finish();
    }
    // Al volver la conexión, el aviso de "sin conexión" ya no aplica.
    function clearNetworkError() {
      setError((current) => (current === "offline" || current === "network" ? null : current));
    }
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("online", clearNetworkError);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("online", clearNetworkError);
      // Al desmontar se descarta lo que estuviera escuchando.
      finish(false);
    };
  }, [finish]);

  return {
    supported: supported && !unavailable,
    listening,
    error,
    start,
    stop: () => finish(),
    // Descarta lo dictado (cerrar la hoja o pasar a manual).
    cancel: () => finish(false),
    // Quita el último error (al abrir o cerrar la captura).
    reset: () => setError(null),
    toggle: () => (phaseRef.current === "listening" ? finish() : start()),
  };
}

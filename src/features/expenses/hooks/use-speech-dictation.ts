"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppLanguage } from "@/domain/types";
import {
  dictationLanguage,
  getDictationSupport,
  toDictationError,
  type DictationError,
} from "../lib/voice-support";

export const DICTATION_MAX_MS = 30_000;
export const DICTATION_SILENCE_MS = 2_000;
// En Android `continuous` no tiene efecto y cada frase termina la sesión: se
// reinicia, con un tope para no entrar en bucle si el micro falla.
const MAX_RESTARTS = 20;

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
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

function recognitionConstructor(): RecognitionConstructor | null {
  const host = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

// Dictado con el reconocimiento del navegador. Termina al tocar de nuevo, a
// los 30 s, tras 2 s sin una frase nueva, si no se oye nada o al salir de la
// app; entonces entrega el texto una sola vez.
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
  // Tras un fallo del servicio sin ningún resultado (p. ej. Brave) no tiene
  // sentido seguir ofreciéndolo en esta sesión.
  const [unavailable, setUnavailable] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const listeningRef = useRef(false);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const heardRef = useRef(false);
  const restartsRef = useRef(0);
  const maxTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onTranscript, onFinish });

  useEffect(() => {
    callbacksRef.current = { onTranscript, onFinish };
  }, [onFinish, onTranscript]);

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current !== null) window.clearTimeout(maxTimerRef.current);
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
    maxTimerRef.current = null;
    silenceTimerRef.current = null;
  }, []);

  const finish = useCallback(
    (deliver = true) => {
      if (!listeningRef.current) return;
      listeningRef.current = false;
      clearTimers();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.abort();
      }
      setListening(false);
      const text = `${finalRef.current} ${interimRef.current}`.trim();
      if (deliver && text) callbacksRef.current.onFinish(text);
    },
    [clearTimers],
  );

  const startRecognition = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = dictationLanguage(language);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalRef.current = `${finalRef.current} ${result[0].transcript}`.trim();
          heardRef.current = true;
          if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = window.setTimeout(() => finish(), DICTATION_SILENCE_MS);
        } else {
          interim += result[0].transcript;
        }
      }
      interimRef.current = interim;
      callbacksRef.current.onTranscript(`${finalRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      const code = toDictationError(event.error);
      if (!code) return;
      if (code === "no-speech" && heardRef.current) {
        finish();
        return;
      }
      if ((code === "network" || code === "service-not-allowed") && !heardRef.current) {
        setUnavailable(true);
      }
      setError(code);
      finish();
    };

    recognition.onend = () => {
      if (!listeningRef.current) return;
      if (restartsRef.current >= MAX_RESTARTS) {
        finish();
        return;
      }
      restartsRef.current += 1;
      // La misma instancia se puede volver a arrancar cuando ha terminado.
      try {
        recognition.start();
      } catch {
        finish();
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      finish(false);
    }
  }, [finish, language]);

  const start = useCallback(() => {
    if (listeningRef.current || !supported || unavailable) return;
    if (!navigator.onLine) {
      setError("offline");
      return;
    }
    finalRef.current = "";
    interimRef.current = "";
    heardRef.current = false;
    restartsRef.current = 0;
    listeningRef.current = true;
    setError(null);
    setListening(true);
    maxTimerRef.current = window.setTimeout(() => finish(), DICTATION_MAX_MS);
    startRecognition();
  }, [finish, startRecognition, supported, unavailable]);

  useEffect(() => {
    function stopWhenHidden() {
      if (document.visibilityState === "hidden") finish();
    }
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      // Al cerrar la hoja se descarta lo que estuviera escuchando.
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
    toggle: () => (listeningRef.current ? finish() : start()),
  };
}

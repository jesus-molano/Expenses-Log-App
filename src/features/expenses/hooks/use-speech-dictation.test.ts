import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DICTATION_MAX_MS,
  DICTATION_SILENCE_MS,
  DICTATION_STOP_GRACE_MS,
  useSpeechDictation,
} from "./use-speech-dictation";

type Result = { isFinal: boolean; 0: { transcript: string } };

// Reconocedor falso: guarda los resultados de la sesión como Chrome (cada
// evento trae todos) y simula que stop() entrega lo pendiente y termina.
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: { resultIndex: number; results: Result[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  results: Result[] = [];
  start = vi.fn(() => {
    this.results = [];
  });
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  // Un resultado parcial se sustituye por el siguiente; uno final se queda.
  say(text: string, isFinal: boolean) {
    if (this.results.at(-1)?.isFinal === false) this.results.pop();
    this.results.push({ isFinal, 0: { transcript: text } });
    this.onresult?.({ resultIndex: 0, results: [...this.results] });
  }

  end() {
    this.onend?.();
  }
}

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36";

function setup() {
  const onFinish = vi.fn();
  const onTranscript = vi.fn();
  const hook = renderHook(() =>
    useSpeechDictation({ language: "es", onTranscript, onFinish }),
  );
  return { ...hook, onFinish, onTranscript };
}

describe("useSpeechDictation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeRecognition.instances = [];
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ANDROID_CHROME);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("delivers the text once after two seconds without hearing anything new", () => {
    const { result, onFinish, onTranscript } = setup();

    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0];
    expect(recognition.lang).toBe("es-ES");

    act(() => recognition.say("Netflix doce", false));
    act(() => recognition.say("Netflix 12,99 el 5", true));
    expect(onTranscript).toHaveBeenLastCalledWith("Netflix 12,99 el 5");

    act(() => vi.advanceTimersByTime(DICTATION_SILENCE_MS));
    expect(result.current.listening).toBe(false);
    // Pide al reconocedor lo que aún procesa y entrega al terminar.
    expect(recognition.stop).toHaveBeenCalled();
    act(() => recognition.end());
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith("Netflix 12,99 el 5");
  });

  it("keeps listening while a phrase is still being spoken", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0];
    act(() => recognition.say("Netflix doce noventa y nueve", true));
    act(() => vi.advanceTimersByTime(DICTATION_SILENCE_MS - 500));
    act(() => recognition.say("el", false));
    act(() => vi.advanceTimersByTime(DICTATION_SILENCE_MS - 500));
    act(() => recognition.say("el cinco", true));
    act(() => vi.advanceTimersByTime(DICTATION_SILENCE_MS));
    act(() => recognition.end());

    expect(onFinish).toHaveBeenCalledWith("Netflix doce noventa y nueve el cinco");
  });

  it("delivers the last words that arrive after stopping", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0];
    act(() => recognition.say("Netflix doce", false));
    act(() => result.current.stop());
    act(() => recognition.say("Netflix doce noventa y nueve", true));
    act(() => recognition.end());

    expect(onFinish).toHaveBeenCalledWith("Netflix doce noventa y nueve");
  });

  it("stays busy until what was dictated is delivered", () => {
    const { result } = setup();

    act(() => result.current.start());
    expect(result.current.busy).toBe(true);
    act(() => FakeRecognition.instances[0].say("Luz", false));
    act(() => result.current.stop());
    expect(result.current.listening).toBe(false);
    expect(result.current.busy).toBe(true);
    act(() => FakeRecognition.instances[0].end());
    expect(result.current.busy).toBe(false);
  });

  it("delivers what it has if the recognizer never ends after stopping", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].say("Luz", false));
    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(DICTATION_STOP_GRACE_MS));

    expect(onFinish).toHaveBeenCalledWith("Luz");
    expect(FakeRecognition.instances[0].abort).toHaveBeenCalled();
  });

  it("restarts after each phrase, as Android ends the session, keeping unfinished words", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0];
    act(() => recognition.say("Gimnasio 35", true));
    act(() => recognition.say("y Spotify", false));
    act(() => recognition.end());
    expect(recognition.start).toHaveBeenCalledTimes(2);

    act(() => recognition.say("10,99", true));
    act(() => vi.advanceTimersByTime(DICTATION_SILENCE_MS));
    act(() => recognition.end());
    expect(onFinish).toHaveBeenCalledWith("Gimnasio 35 y Spotify 10,99");
  });

  it("does not repeat words when Android sends cumulative final results", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0];
    act(() => recognition.say("café", true));
    act(() => recognition.say("café cinco euros", true));
    act(() => result.current.stop());
    act(() => recognition.end());

    expect(onFinish).toHaveBeenCalledWith("café cinco euros");
  });

  it("stops at the time limit and when the app goes to the background", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].say("Luz", false));
    act(() => vi.advanceTimersByTime(DICTATION_MAX_MS));
    act(() => FakeRecognition.instances[0].end());
    expect(onFinish).toHaveBeenCalledWith("Luz");

    act(() => result.current.start());
    act(() => FakeRecognition.instances[1].say("Agua 30", true));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => FakeRecognition.instances[1].end());
    expect(onFinish).toHaveBeenLastCalledWith("Agua 30");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("delivers an empty text when stopped before hearing anything", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    act(() => result.current.stop());
    act(() => FakeRecognition.instances[0].end());

    expect(onFinish).toHaveBeenCalledWith("");
  });

  it("reports errors without analyzing what was heard", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].onerror?.({ error: "not-allowed" }));
    expect(result.current.error).toBe("not-allowed");
    expect(result.current.listening).toBe(false);

    act(() => result.current.start());
    act(() => FakeRecognition.instances[1].say("Netflix do", false));
    act(() => FakeRecognition.instances[1].onerror?.({ error: "network" }));
    expect(result.current.error).toBe("network");
    // Un fallo de red puntual no esconde el micro.
    expect(result.current.supported).toBe(true);
    expect(onFinish).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current.error).toBeNull();
  });

  it("turns itself off when the browser does not allow the service", () => {
    const { result } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].onerror?.({ error: "service-not-allowed" }));

    expect(result.current.supported).toBe(false);
  });

  it("needs a connection, and clears the error on reset", () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    const { result } = setup();

    act(() => result.current.start());
    expect(result.current.error).toBe("offline");
    expect(FakeRecognition.instances).toHaveLength(0);

    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it("discards what was being dictated when cancelled or unmounted", () => {
    const { result, onFinish, unmount } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].say("Netflix", true));
    act(() => result.current.cancel());
    expect(FakeRecognition.instances[0].abort).toHaveBeenCalled();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[1].say("Spotify", true));
    unmount();

    expect(onFinish).not.toHaveBeenCalled();
    expect(FakeRecognition.instances[1].abort).toHaveBeenCalled();
  });
});

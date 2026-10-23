import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DICTATION_MAX_MS, DICTATION_SILENCE_MS, useSpeechDictation } from "./use-speech-dictation";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  say(text: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
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

  it("delivers the text once after two seconds without a new phrase", () => {
    const { result, onFinish, onTranscript } = setup();

    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0];
    expect(recognition.lang).toBe("es-ES");

    act(() => recognition.say("Netflix doce", false));
    act(() => recognition.say("Netflix 12,99 el 5", true));
    expect(onTranscript).toHaveBeenLastCalledWith("Netflix 12,99 el 5");

    act(() => vi.advanceTimersByTime(DICTATION_SILENCE_MS));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith("Netflix 12,99 el 5");
    expect(result.current.listening).toBe(false);
  });

  it("restarts after each phrase, as Android ends the session", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0];
    act(() => recognition.say("Gimnasio 35", true));
    act(() => recognition.onend?.());
    expect(recognition.start).toHaveBeenCalledTimes(2);

    act(() => recognition.say("y Spotify 10,99", true));
    act(() => vi.advanceTimersByTime(DICTATION_SILENCE_MS));
    expect(onFinish).toHaveBeenCalledWith("Gimnasio 35 y Spotify 10,99");
  });

  it("stops at the time limit and when the app goes to the background", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].say("Luz", false));
    act(() => vi.advanceTimersByTime(DICTATION_MAX_MS));
    expect(onFinish).toHaveBeenCalledWith("Luz");

    act(() => result.current.start());
    act(() => FakeRecognition.instances[1].say("Agua 30", true));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(onFinish).toHaveBeenLastCalledWith("Agua 30");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("reports errors and turns itself off when the service never answers", () => {
    const { result, onFinish } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].onerror?.({ error: "not-allowed" }));
    expect(result.current.error).toBe("not-allowed");
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    act(() => FakeRecognition.instances[1].onerror?.({ error: "network" }));
    expect(result.current.error).toBe("network");
    expect(result.current.supported).toBe(false);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("needs a connection", () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    const { result } = setup();

    act(() => result.current.start());

    expect(result.current.error).toBe("offline");
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("discards what was being dictated when the sheet closes", () => {
    const { result, onFinish, unmount } = setup();

    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].say("Netflix", true));
    unmount();

    expect(onFinish).not.toHaveBeenCalled();
    expect(FakeRecognition.instances[0].abort).toHaveBeenCalled();
  });
});

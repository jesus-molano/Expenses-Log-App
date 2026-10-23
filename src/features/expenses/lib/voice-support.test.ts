import { describe, expect, it } from "vitest";
import {
  appendDictated,
  getDictationSupport,
  joinWords,
  sessionTranscript,
  toDictationError,
} from "./voice-support";

const recognizer = { webkitSpeechRecognition: class {} };

function host(userAgent: string, maxTouchPoints = 0, speech: object = recognizer) {
  return { ...speech, navigator: { userAgent, maxTouchPoints } };
}

describe("getDictationSupport", () => {
  it("allows Chromium on Android and desktop", () => {
    expect(
      getDictationSupport(
        host("Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36"),
      ),
    ).toBe(true);
    expect(
      getDictationSupport(
        host("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0"),
      ),
    ).toBe(true);
  });

  it("hides dictation on iOS, iPadOS and Safari", () => {
    expect(
      getDictationSupport(
        host("Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0 Mobile/15E148 Safari/604.1"),
      ),
    ).toBe(false);
    expect(
      getDictationSupport(
        host("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15", 5),
      ),
    ).toBe(false);
    expect(
      getDictationSupport(
        host("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15"),
      ),
    ).toBe(false);
  });

  it("needs the speech recognition API", () => {
    expect(getDictationSupport(host("Chrome/150.0", 0, {}))).toBe(false);
  });

  it("ignores the abort the app causes itself", () => {
    expect(toDictationError("aborted")).toBeNull();
    expect(toDictationError("not-allowed")).toBe("not-allowed");
  });
});

describe("sessionTranscript", () => {
  const result = (transcript: string, isFinal: boolean) => ({ isFinal, 0: { transcript } });

  it("joins final results and the pending partial one", () => {
    expect(
      sessionTranscript([result("Gimnasio 35", true), result("y Spotify", false)]),
    ).toEqual({ final: "Gimnasio 35", interim: "y Spotify" });
  });

  it("does not repeat cumulative results from Chrome on Android", () => {
    expect(sessionTranscript([result("café", true), result("café cinco euros", true)])).toEqual({
      final: "café cinco euros",
      interim: "",
    });
    expect(sessionTranscript([result("Café cinco", true), result("café", true)]).final).toBe(
      "Café cinco",
    );
    expect(sessionTranscript([result("café", true), result("café cinco", false)])).toEqual({
      final: "café",
      interim: "cinco",
    });
  });
});

describe("joinWords", () => {
  it("joins with single spaces and skips empty parts", () => {
    expect(joinWords(" Seguro del coche ", "", "420 al año")).toBe("Seguro del coche 420 al año");
    expect(joinWords("", " ")).toBe("");
  });
});

describe("word boundaries and typed text", () => {
  const result = (transcript: string, isFinal: boolean) => ({ isFinal, 0: { transcript } });

  it("only treats whole words as repeated", () => {
    expect(sessionTranscript([result("dos", true), result("doscientos euros", true)]).final).toBe(
      "dos doscientos euros",
    );
    expect(sessionTranscript([result("dos", true), result("doscientos", false)]).interim).toBe(
      "doscientos",
    );
  });

  it("keeps a typed line break before what is dictated", () => {
    expect(appendDictated("Netflix 12,99\n", "Spotify 10,99")).toBe("Netflix 12,99\nSpotify 10,99");
    expect(appendDictated("Seguro del coche", "420 al año")).toBe("Seguro del coche 420 al año");
    expect(appendDictated("Netflix\n", "")).toBe("Netflix");
  });
});

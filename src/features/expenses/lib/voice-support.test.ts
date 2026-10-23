import { describe, expect, it } from "vitest";
import { getDictationSupport, toDictationError } from "./voice-support";

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

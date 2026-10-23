import { describe, expect, it } from "vitest";
import { detectInstallGuide } from "./install-guide";

const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const iphoneChrome =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1";
const ipadDesktopMode =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const android =
  "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36";

describe("detectInstallGuide", () => {
  it("guides iPhone and iPad users that have not installed the app", () => {
    expect(detectInstallGuide({ userAgent: iphoneSafari, maxTouchPoints: 5, standalone: false })).toBe(
      "ios-safari",
    );
    expect(detectInstallGuide({ userAgent: iphoneChrome, maxTouchPoints: 5, standalone: false })).toBe(
      "ios-other",
    );
    expect(
      detectInstallGuide({ userAgent: ipadDesktopMode, maxTouchPoints: 5, standalone: false }),
    ).toBe("ios-safari");
  });

  it("stays hidden once installed and outside iOS", () => {
    expect(detectInstallGuide({ userAgent: iphoneSafari, maxTouchPoints: 5, standalone: true })).toBeNull();
    expect(detectInstallGuide({ userAgent: android, maxTouchPoints: 5, standalone: false })).toBeNull();
    expect(
      detectInstallGuide({ userAgent: ipadDesktopMode, maxTouchPoints: 0, standalone: false }),
    ).toBeNull();
  });
});

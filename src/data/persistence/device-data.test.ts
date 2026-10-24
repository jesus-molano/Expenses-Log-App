import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDeviceData } from "./device-data";
import { clearExpenseLocalData } from "./local-store";
import { clearSnapshots } from "./snapshot-store";

vi.mock("./local-store", () => ({
  clearExpenseLocalData: vi.fn(),
}));

vi.mock("./snapshot-store", () => ({
  clearSnapshots: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("clearDeviceData", () => {
  it("clears the stored data and waits for the automatic copies to be cleared", async () => {
    let finishSnapshots = () => {};
    vi.mocked(clearSnapshots).mockReturnValue(
      new Promise<void>((resolve) => {
        finishSnapshots = resolve;
      }),
    );
    let done = false;

    const clearing = clearDeviceData().then(() => {
      done = true;
    });
    await Promise.resolve();

    expect(clearExpenseLocalData).toHaveBeenCalledTimes(1);
    expect(clearSnapshots).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);

    finishSnapshots();
    await clearing;
    expect(done).toBe(true);
  });
});

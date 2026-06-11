import { describe, expect, it } from "vitest";
import { errorMessage, savedMessage, syncedMessage } from "./sync-messages";

describe("sync messages", () => {
  it("maps cloud modes to user-facing messages", () => {
    expect(syncedMessage("table")).toBe("Sincronizado en la nube");
    expect(savedMessage("unavailable")).toBe("Guardado localmente");
  });

  it("prefers concrete error messages", () => {
    expect(errorMessage(new Error("boom"), "settings.cloudSaveError")).toBe(
      "boom",
    );
    expect(errorMessage("unknown", "settings.cloudSaveError")).toBe(
      "No se pudo guardar en la nube.",
    );
  });
});

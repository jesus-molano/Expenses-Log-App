import { describe, expect, it, vi } from "vitest";
import { urlBase64ToUint8Array } from "./push-notifications";

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 values", () => {
    const atobSpy = vi
      .spyOn(window, "atob")
      .mockImplementation((value) => Buffer.from(value, "base64").toString("binary"));

    const output = urlBase64ToUint8Array("SGVsbG8td29ybGQ");

    expect(Array.from(output)).toEqual(
      Array.from("Hello-world", (character) => character.charCodeAt(0)),
    );
    atobSpy.mockRestore();
  });
});

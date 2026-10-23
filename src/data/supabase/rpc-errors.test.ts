import { describe, expect, it } from "vitest";
import { isMissingRpcError } from "./rpc-errors";

describe("isMissingRpcError", () => {
  it("recognises PostgREST's missing function error", () => {
    expect(isMissingRpcError({ code: "PGRST202", message: "" }, "save_app_store")).toBe(true);
    expect(
      isMissingRpcError(
        {
          message:
            "Could not find the function public.save_app_store(p_expected_revision, p_store) in the schema cache",
        },
        "save_app_store",
      ),
    ).toBe(true);
    expect(
      isMissingRpcError(
        { code: "42883", message: "function public.save_app_store(jsonb) does not exist" },
        "save_app_store",
      ),
    ).toBe(true);
  });

  it("does not confuse other errors or other functions", () => {
    expect(isMissingRpcError({ code: "42501", message: "denied" }, "save_app_store")).toBe(false);
    expect(
      isMissingRpcError(
        { message: "Could not find the function public.claim_push_subscription" },
        "save_app_store",
      ),
    ).toBe(false);
    expect(
      isMissingRpcError({ code: "42883", message: "operator does not exist" }, "save_app_store"),
    ).toBe(false);
  });
});

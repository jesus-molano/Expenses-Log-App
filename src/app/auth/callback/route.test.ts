import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { GET, resolveSafeRedirectPath } from "./route";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("/auth/callback", () => {
  it("allows only internal redirect paths", () => {
    expect(resolveSafeRedirectPath("/settings")).toBe("/settings");
    expect(resolveSafeRedirectPath("/money?from=expenses")).toBe(
      "/money?from=expenses",
    );
    expect(resolveSafeRedirectPath("https://evil.example")).toBe("/settings");
    expect(resolveSafeRedirectPath("//evil.example")).toBe("/settings");
    expect(resolveSafeRedirectPath("%2F%2Fevil.example")).toBe("/settings");
    expect(resolveSafeRedirectPath(null)).toBe("/settings");
  });

  it("redirects external next values back to settings", async () => {
    vi.mocked(createClient).mockResolvedValue(null);

    const response = await GET(
      new NextRequest(
        "http://localhost/auth/callback?next=https%3A%2F%2Fevil.example",
      ),
    );

    expect(response.headers.get("location")).toBe("http://localhost/settings");
  });
});

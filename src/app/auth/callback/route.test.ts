import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { GET } from "./route";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

async function redirectFor(query: string) {
  const response = await GET(
    new NextRequest(`http://localhost/auth/callback?${query}`),
  );
  return response.headers.get("location");
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("/auth/callback", () => {
  it("redirects to an internal next path after exchanging the code", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { exchangeCodeForSession },
    } as never);

    expect(await redirectFor("code=abc&next=%2Fmoney%3Ffrom%3Dexpenses")).toBe(
      "http://localhost/money?from=expenses",
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it.each([
    ["absolute URL", "next=https%3A%2F%2Fevil.example"],
    ["protocol-relative", "next=%2F%2Fevil.example"],
    ["backslash", "next=%2F%5Cevil.example"],
    ["raw backslash", "next=/\\evil.example"],
    ["tab", "next=%2F%09%2Fevil.example"],
    ["newline", "next=%2F%0A%2Fevil.example"],
    ["carriage return", "next=%2F%0D%2Fevil.example"],
    ["dot segment", "next=%2F.%2F%2Fevil.example"],
    ["missing", ""],
  ])("sends %s back to settings on this origin", async (_label, query) => {
    vi.mocked(createClient).mockResolvedValue(null);

    expect(await redirectFor(query)).toBe("http://localhost/settings");
  });
});

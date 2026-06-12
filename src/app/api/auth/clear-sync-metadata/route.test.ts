import { describe, expect, it, vi, afterEach } from "vitest";
import { clearOversizedMetadata } from "@/data/persistence/cloud-store";
import { createClient } from "@/utils/supabase/server";
import { GET, POST } from "./route";

vi.mock("@/data/persistence/cloud-store", () => ({
  clearOversizedMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("/api/auth/clear-sync-metadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects GET requests", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(payload.error).toContain("Method not allowed");
  });

  it("requires an authenticated user before clearing metadata", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as never);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(clearOversizedMetadata).not.toHaveBeenCalled();
  });

  it("clears metadata for authenticated users", async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "00000000-0000-4000-8000-000000000001" },
          },
          error: null,
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(clearOversizedMetadata).toHaveBeenCalledWith(supabase);
  });
});

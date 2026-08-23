import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import { createClient } from "@/utils/supabase/server";
import { DELETE } from "./route";

vi.mock("@/data/supabase/admin-client", () => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function mockClients(options?: { user?: { id: string } | null; deleteError?: unknown }) {
  const deleteUser = vi.fn().mockResolvedValue({
    data: null,
    error: options?.deleteError ?? null,
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options?.user === undefined ? { id: "user-1" } : options.user },
        error: null,
      }),
    },
  } as never);
  vi.mocked(createSupabaseServiceClient).mockReturnValue({
    auth: { admin: { deleteUser } },
  } as never);
  return { deleteUser };
}

describe("DELETE /api/account", () => {
  it("requires configured auth", async () => {
    vi.mocked(createClient).mockResolvedValue(null);
    vi.mocked(createSupabaseServiceClient).mockReturnValue(null);

    const response = await DELETE();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "AUTH_NOT_CONFIGURED" });
  });

  it("requires an authenticated user", async () => {
    mockClients({ user: null });

    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "UNAUTHENTICATED" });
  });

  it("relies on auth deletion and database cascades", async () => {
    const { deleteUser } = mockClients();

    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("does not expose the provider error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockClients({ deleteError: { message: "sensitive provider detail" } });

    const response = await DELETE();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "ACCOUNT_DELETE_FAILED" });
  });
});

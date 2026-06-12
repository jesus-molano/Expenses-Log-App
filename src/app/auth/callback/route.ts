import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export function resolveSafeRedirectPath(next: string | null): string {
  if (!next) return "/settings";

  try {
    const decoded = decodeURIComponent(next);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/settings";
    if (decoded.includes("\\") || decoded.includes("\u0000")) return "/settings";

    return decoded;
  } catch {
    return "/settings";
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = resolveSafeRedirectPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    await supabase?.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

import { NextResponse, type NextRequest } from "next/server";
import { resolveSafeRedirectPath } from "@/shared/safe-redirect";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = resolveSafeRedirectPath(
    requestUrl.searchParams.get("next"),
    requestUrl.origin,
  );

  if (code) {
    const supabase = await createClient();
    await supabase?.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

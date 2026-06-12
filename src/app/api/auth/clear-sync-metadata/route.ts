import { NextResponse } from "next/server";
import { clearOversizedMetadata } from "@/data/persistence/cloud-store";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Auth is not configured." },
      { status: 500 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to repair sync metadata." },
      { status: 401 },
    );
  }

  await clearOversizedMetadata(supabase);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

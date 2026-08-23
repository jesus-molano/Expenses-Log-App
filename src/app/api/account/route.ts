import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import { createClient } from "@/utils/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const admin = createSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json(
      { code: "AUTH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  if (!admin) {
    return NextResponse.json(
      { code: "ACCOUNT_DELETE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error("Could not delete authenticated account", deleteUserError);
    return NextResponse.json(
      { code: "ACCOUNT_DELETE_FAILED" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

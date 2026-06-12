import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import { toDatabaseUuid } from "@/data/supabase/database.types";
import { createClient } from "@/utils/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const admin = createSupabaseServiceClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Auth is not configured." },
      { status: 500 },
    );
  }

  if (!admin) {
    return NextResponse.json(
      { error: "Admin account deletion is not configured." },
      { status: 500 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "You must be signed in to delete your account." },
      { status: 401 },
    );
  }

  const userId = toDatabaseUuid(user.id);

  const { error: pushError } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);
  if (pushError) {
    return NextResponse.json({ error: pushError.message }, { status: 500 });
  }

  const { error: storeError } = await admin
    .from("app_stores")
    .delete()
    .eq("user_id", userId);
  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    return NextResponse.json(
      { error: deleteUserError.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/data/supabase/admin-client";
import { createClient } from "@/utils/supabase/server";

const USER_SCOPED_TABLES: Array<{ table: string; column: string }> = [
  { table: "push_subscriptions", column: "user_id" },
  { table: "expense_occurrence_overrides", column: "user_id" },
  { table: "expense_templates", column: "user_id" },
  { table: "expense_categories", column: "user_id" },
  { table: "app_stores", column: "user_id" },
  { table: "profiles", column: "id" },
];

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

  for (const { table, column } of USER_SCOPED_TABLES) {
    const { error } = await admin.from(table).delete().eq(column, user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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


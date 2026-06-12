import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/data/supabase/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = () => {
  if (!supabaseUrl || !supabaseKey) return null;
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
};

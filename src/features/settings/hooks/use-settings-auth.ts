"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { t } from "@/shared/i18n";
import type { createClient } from "@/utils/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export function useSettingsAuth(
  supabase: SupabaseBrowserClient,
  setMessage: (message: string) => void,
) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMessage(t("settings.signedOut"));
  }

  return {
    user,
    setUser,
    signOut,
  };
}

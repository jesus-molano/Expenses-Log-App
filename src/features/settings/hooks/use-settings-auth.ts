"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { clearDeviceData } from "@/data/persistence/device-data";
import { t } from "@/shared/i18n";
import type { createClient } from "@/utils/supabase/client";
import { releasePushSubscription } from "../lib/push-notifications";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export type SignOutOptions = {
  // Borra también los datos de gastos de este dispositivo (equipo compartido).
  clearLocalData: boolean;
};

// Recarga en la portada para descartar el store que sigue en memoria.
export function reloadHome() {
  window.location.replace("/");
}

export function useSettingsAuth(
  supabase: SupabaseBrowserClient,
  setMessage: (message: string) => void,
  // Recarga tras borrar los datos locales; los tests la sustituyen.
  { reload = reloadHome }: { reload?: () => void } = {},
) {
  const [user, setUser] = useState<User | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const signingOutRef = useRef(false);

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

  // Devuelve true si la sesión quedó cerrada.
  async function signOut({ clearLocalData }: SignOutOptions) {
    if (!supabase || signingOutRef.current) return false;
    signingOutRef.current = true;
    setIsSigningOut(true);
    let reloading = false;

    try {
      // Antes del signOut: el borrado remoto necesita la sesión.
      await releasePushSubscription();
      await supabase.auth.signOut();
      // Sin red, signOut devuelve un error pero quita la sesión local; solo
      // falla de verdad si la sesión sigue ahí.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setMessage(t("settings.signOutError"));
        return false;
      }

      if (clearLocalData) {
        // Las copias automáticas también: llevan el store entero.
        await clearDeviceData();
        // Recarga para descartar también el store que sigue en memoria.
        reloading = true;
        reload();
        return true;
      }

      setUser(null);
      setMessage(t("settings.signedOut"));
      return true;
    } catch {
      setMessage(t("settings.signOutError"));
      return false;
    } finally {
      // Mientras recarga, los botones siguen desactivados.
      if (!reloading) {
        signingOutRef.current = false;
        setIsSigningOut(false);
      }
    }
  }

  return {
    user,
    setUser,
    isSigningOut,
    signOut,
  };
}

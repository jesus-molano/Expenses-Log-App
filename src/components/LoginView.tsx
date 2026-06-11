"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { createClient } from "@/utils/supabase/client";

export function LoginView() {
  const [message, setMessage] = useState("");

  async function signInWithGoogle() {
    const supabase = createClient();

    if (!supabase) {
      setMessage(t("login.notConfigured"));
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) setMessage(error.message);
  }

  return (
    <main className="app-page-bg grid min-h-dvh px-4 py-5 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/settings"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/10"
        >
          <ArrowLeft size={18} />
          {t("common.settings")}
        </Link>

        <section className="mt-4 rounded-[1.35rem] border border-white/10 bg-slate-950/82 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <div className="grid size-12 place-items-center rounded-full bg-white text-slate-950 shadow-[0_0_26px_rgba(132,204,22,0.18)]">
            G
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-white">
            {t("login.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {t("login.body")}
          </p>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-5 h-12 w-full rounded-2xl bg-lime-300 text-base font-semibold text-slate-950 shadow-[0_0_32px_rgba(132,204,22,0.24)]"
          >
            {t("login.continueGoogle")}
          </button>
          {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { t } from "@/shared/i18n";
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
    <main className="app-page grid min-h-dvh px-4 py-5">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/settings"
          className="app-button app-button-secondary app-button-sm inline-flex"
        >
          <ArrowLeft size={18} />
          {t("common.settings")}
        </Link>

        <section className="app-section-card mt-4 p-5">
          <div className="grid size-12 place-items-center rounded-full bg-[var(--app-control)] text-[var(--app-text)]">
            G
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-[var(--app-text)]">
            {t("login.title")}
          </h1>
          <p className="mt-2 text-sm text-[var(--app-text-muted)]">
            {t("login.body")}
          </p>

          <Button
            type="button"
            onClick={signInWithGoogle}
            className="mt-5 w-full"
            size="lg"
          >
            {t("login.continueGoogle")}
          </Button>
          {message ? (
            <p className="mt-4 text-sm text-[var(--app-text-muted)]">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}


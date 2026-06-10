"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function LoginView() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();

    if (!supabase) {
      setMessage("Supabase no esta configurado.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setMessage(error ? error.message : "Revisa tu email para entrar.");
  }

  return (
    <main className="grid min-h-dvh bg-slate-100 px-4 py-5 text-slate-950">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-slate-700"
        >
          <ArrowLeft size={18} />
          Gastos
        </Link>

        <form onSubmit={submit} className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid size-12 place-items-center rounded-full bg-slate-950 text-white">
            <Mail size={22} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Entrar</h1>
          <p className="mt-2 text-sm text-slate-500">
            Magic link de Supabase. El modo demo local sigue disponible sin login.
          </p>

          <label className="mt-5 grid gap-1.5 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-12 rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-slate-900"
            />
          </label>

          <button
            type="submit"
            className="mt-5 h-12 w-full rounded-xl bg-slate-950 text-base font-semibold text-white"
          >
            Enviar magic link
          </button>
          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}

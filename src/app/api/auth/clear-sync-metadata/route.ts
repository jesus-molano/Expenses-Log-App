import { NextResponse } from "next/server";
import { clearOversizedMetadata } from "@/data/persistence/cloud-store";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  if (supabase) {
    await clearOversizedMetadata(supabase);
  }

  return new NextResponse(
    `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="refresh" content="1; url=/settings" />
        <title>Sesión reparada</title>
        <style>
          body {
            margin: 0;
            min-height: 100dvh;
            display: grid;
            place-items: center;
            background: #020617;
            color: #f8fafc;
            font-family: system-ui, sans-serif;
          }
          main {
            width: min(28rem, calc(100vw - 2rem));
            border: 1px solid rgb(255 255 255 / 0.12);
            border-radius: 1.5rem;
            padding: 1.25rem;
            background: rgb(15 23 42 / 0.82);
          }
          a { color: #bef264; }
        </style>
      </head>
      <body>
        <main>
          <h1>Sesión reparada</h1>
          <p>He limpiado la metadata pesada de la sesión. Volviendo a ajustes...</p>
          <p><a href="/settings">Abrir ajustes</a></p>
        </main>
      </body>
    </html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}


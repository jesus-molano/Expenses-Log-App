"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { readLanguageCookie, t } from "@/shared/i18n";
import { readThemeCookie } from "@/shared/theme";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const language = readLanguageCookie() ?? "es";

  useEffect(() => {
    console.error("Unhandled root error", error);
  }, [error]);

  return (
    <html lang={language} data-theme={readThemeCookie() ?? "vice-afterglow"}>
      <body className="min-h-full">
        <main className="app-page app-page-safe grid min-h-dvh place-items-center px-6 text-center">
          <div className="app-section-card max-w-sm p-5">
            <h1 className="text-xl font-semibold text-[var(--app-text)]">
              {t("boot.errorTitle", language)}
            </h1>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {t("boot.errorBody", language)}
            </p>
            <Button type="button" onClick={retry} className="mt-5">
              {t("boot.retry", language)}
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}

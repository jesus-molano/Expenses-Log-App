import { cookies } from "next/headers";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/lib/i18n";

function readCookieLanguage(value: string | undefined): AppLanguage {
  return value === "en" ? "en" : "es";
}

export default async function Loading() {
  const cookieStore = await cookies();
  const language = readCookieLanguage(cookieStore.get("expense-language")?.value);

  return (
    <main className="app-page-bg grid min-h-dvh place-items-center px-6 text-center text-white">
      <div>
        <div className="app-loading-dot mx-auto size-11 animate-pulse rounded-full border" />
        <p className="mt-3 text-sm font-semibold text-slate-200">
          {t("common.loading", language)}
        </p>
      </div>
    </main>
  );
}

import Link from "next/link";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

const LANGUAGES: AppLanguage[] = ["es", "en"];

// Se pinta en el HTML del servidor mientras la app hidrata los datos locales.
// No usa hooks: si el JavaScript no llega a cargar, sigue visible y, a los
// pocos segundos, muestra ayuda, los recursos que fallaron y cómo reintentar.
// Sin JavaScript los Link son enlaces normales que recargan el documento.
export function AppBootShell() {
  return (
    <main
      className="app-page app-page-safe app-boot-shell"
      aria-busy="true"
    >
      <div className="app-boot-skeleton app-boot-skeleton-header" />
      <div className="app-boot-skeleton app-boot-skeleton-row" />
      <div className="app-boot-skeleton app-boot-skeleton-row" />
      <div className="app-boot-skeleton app-boot-skeleton-row" />

      <p role="status" className="sr-only">
        {LANGUAGES.map((language) => (
          <span key={language} lang={language} className="app-boot-text">
            {t("boot.loading", language)}
          </span>
        ))}
      </p>

      <section className="app-section-card app-boot-help p-4">
        {LANGUAGES.map((language) => (
          <div key={language} lang={language} className="app-boot-text">
            <p className="text-sm text-[var(--app-text)]">
              {t("boot.help", language)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/"
                prefetch={false}
                className="app-button app-button-primary"
              >
                {t("boot.retry", language)}
              </Link>
              <Link
                href="/?sw-reset=1"
                prefetch={false}
                className="app-button app-button-secondary"
              >
                {t("boot.repair", language)}
              </Link>
            </div>
          </div>
        ))}
        <pre
          data-boot-diagnostics
          className="mt-3 whitespace-pre-wrap break-all text-xs text-[var(--app-text-muted)]"
        />
      </section>
    </main>
  );
}

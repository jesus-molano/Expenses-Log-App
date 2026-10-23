import Link from "next/link";
import type { AppLanguage } from "@/domain/types";
import { t } from "@/shared/i18n";

const LANGUAGES: AppLanguage[] = ["es", "en"];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// El script boot-guard reescribe estos nodos antes de hidratar (estado para
// lectores de pantalla y recursos que fallaron). Con dangerouslySetInnerHTML
// React no compara su contenido al hidratar.
const loadingStatusHtml = LANGUAGES.map(
  (language) =>
    `<span lang="${language}" class="app-boot-text">${escapeHtml(t("boot.loading", language))}</span>`,
).join("");

// Se pinta en el HTML del servidor mientras la app hidrata los datos locales.
// No usa hooks: si el JavaScript no llega a cargar, sigue visible y, a los
// pocos segundos, muestra ayuda, los recursos que fallaron y cómo reintentar.
// Sin JavaScript los Link son enlaces normales que recargan el documento.
export function AppBootShell() {
  return (
    <main className="app-page app-page-safe app-boot-shell px-4">
      <div className="mx-auto grid w-full max-w-2xl gap-3.5">
        <div className="grid gap-3.5" aria-hidden="true">
          <div className="app-boot-skeleton app-boot-skeleton-header" />
          <div className="app-boot-skeleton app-boot-skeleton-row" />
          <div className="app-boot-skeleton app-boot-skeleton-row" />
          <div className="app-boot-skeleton app-boot-skeleton-row" />
        </div>

        <p
          role="status"
          className="sr-only"
          data-boot-status
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: loadingStatusHtml }}
        />

        <section className="app-section-card app-boot-help p-4">
          {LANGUAGES.map((language) => (
            <div key={language} lang={language} className="app-boot-text">
              <p className="text-sm text-[var(--app-text)]" data-boot-help>
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
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: "" }}
            className="mt-3 whitespace-pre-wrap break-all text-xs text-[var(--app-text-muted)]"
          />
        </section>
      </div>
    </main>
  );
}

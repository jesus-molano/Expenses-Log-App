import type { MetadataRoute } from "next";
import { DEFAULT_THEME, THEME_COLORS } from "@/shared/theme";

const shortcutIcons = [{ src: "/icon-192.png?v=5", sizes: "192x192", type: "image/png" }];

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Reminders",
    short_name: "Expense Log",
    description: "Seguimiento de gastos recurrentes con recordatorios.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Fondo del tema por defecto: la pantalla de carga no cambia de color al
    // abrir la app. Con la app abierta, `theme-color` sigue al tema elegido.
    background_color: THEME_COLORS[DEFAULT_THEME],
    theme_color: THEME_COLORS[DEFAULT_THEME],
    orientation: "portrait",
    // Accesos directos al mantener pulsado el icono (Android).
    shortcuts: [
      {
        name: "Añadir gasto",
        short_name: "Añadir",
        url: "/expenses/new",
        icons: shortcutIcons,
      },
      {
        name: "Añadir por voz",
        short_name: "Por voz",
        url: "/expenses/new?mode=voice",
        icons: shortcutIcons,
      },
      // La pestaña Mes: cuánto queda libre y qué falta por pagar este mes.
      {
        name: "Mes",
        short_name: "Mes",
        url: "/money",
        icons: shortcutIcons,
      },
    ],
    icons: [
      {
        src: "/icon-192.png?v=5",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=5",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Dibujo dentro de la zona segura (scripts/generate-pwa-icons.mjs): la
      // máscara del launcher no lo recorta.
      {
        src: "/icon-maskable-192.png?v=1",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png?v=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

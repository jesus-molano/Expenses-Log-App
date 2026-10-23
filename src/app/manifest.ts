import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Reminders",
    short_name: "Expense Log",
    description: "Seguimiento de gastos recurrentes con recordatorios.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    orientation: "portrait",
    // Accesos directos al mantener pulsado el icono (Android).
    shortcuts: [
      {
        name: "Añadir gasto",
        short_name: "Añadir",
        url: "/expenses/new",
        icons: [{ src: "/icon-192.png?v=5", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Añadir por voz",
        short_name: "Por voz",
        url: "/expenses/new?mode=voice",
        icons: [{ src: "/icon-192.png?v=5", sizes: "192x192", type: "image/png" }],
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
      {
        src: "/icon-512.png?v=5",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

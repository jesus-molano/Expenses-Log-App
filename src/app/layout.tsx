import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { AppBootShell } from "@/app/providers/AppBootShell";
import { BOOT_GUARD_SCRIPT } from "@/app/providers/boot-guard-script";
import { PwaRegister } from "@/app/providers/PwaRegister";
import { ThemeApplier } from "@/app/providers/ThemeApplier";
import { ExpenseStoreProvider } from "@/stores/app/use-expense-store";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Reminders",
  description: "Seguimiento inteligente de gastos recurrentes",
  manifest: "/manifest.webmanifest?v=6",
  appleWebApp: {
    capable: true,
    title: "Expense Log",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=5", sizes: "any" },
      { url: "/favicon-32x32.png?v=5", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=5", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=5", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="vice-afterglow"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline a propósito: next/script beforeInteractive depende del runtime de Next. */}
        <script
          id="boot-guard"
          dangerouslySetInnerHTML={{ __html: BOOT_GUARD_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeApplier />
        <PwaRegister />
        <ExpenseStoreProvider fallback={<AppBootShell />}>
          {children}
        </ExpenseStoreProvider>
      </body>
    </html>
  );
}

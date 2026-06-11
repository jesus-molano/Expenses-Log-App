import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { PwaRegister } from "@/components/PwaRegister";
import { ThemeApplier } from "@/components/ThemeApplier";
import type { AppLanguage, AppTheme } from "@/domain/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Reminders",
  description: "Seguimiento inteligente de gastos recurrentes",
  manifest: "/manifest.webmanifest?v=4",
  appleWebApp: {
    capable: true,
    title: "Expense Log",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", sizes: "any" },
      { url: "/favicon-32x32.png?v=4", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=4", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=4", sizes: "180x180", type: "image/png" },
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

function readCookieTheme(value: string | undefined): AppTheme {
  return value === "rose-pine" || value === "catppuccin" || value === "light"
    ? value
    : "legacy";
}

function readCookieLanguage(value: string | undefined): AppLanguage {
  return value === "en" ? "en" : "es";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = readCookieTheme(cookieStore.get("expense-theme")?.value);
  const language = readCookieLanguage(cookieStore.get("expense-language")?.value);

  return (
    <html
      lang={language}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeApplier />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

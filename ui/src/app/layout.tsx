import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { HeaderNav } from "@/components/header-nav";
import { I18nProvider } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Crucible",
  description: "MCP Server Management Portal",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.variable}>
        <I18nProvider>
          <div className="min-h-screen bg-background">
            <HeaderNav />
            <main className="mx-auto max-w-[1200px] px-6 py-6">
              {children}
            </main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}

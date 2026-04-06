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
  description: "AI Tool Management Portal",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
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

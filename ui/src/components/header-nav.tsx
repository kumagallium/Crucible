"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/i18n";
import { Globe, Menu, X } from "lucide-react";

export function HeaderNav() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_ITEMS = [
    { href: "/", label: t("nav.servers") },
    { href: "/register", label: t("nav.register") },
    { href: "/guide", label: t("nav.guide") },
    { href: "/about", label: t("nav.about") },
    { href: "/release-notes", label: t("nav.releaseNotes") },
  ];

  const toggleLocale = () => {
    const next: Locale = locale === "ja" ? "en" : "ja";
    setLocale(next);
  };

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 flex items-center justify-between h-14">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo.png"
            alt="Crucible"
            width={140}
            height={42}
            className="-my-2"
            priority
          />
        </Link>

        {/* デスクトップナビゲーション */}
        <div className="hidden md:flex items-center gap-1">
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="w-px h-5 bg-border mx-1.5" />

          <button
            onClick={toggleLocale}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors duration-200"
            title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
          >
            <Globe className="h-3.5 w-3.5" />
            {locale === "ja" ? "EN" : "JA"}
          </button>
        </div>

        {/* モバイルハンバーガーボタン */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors duration-200"
          aria-label="メニュー"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* モバイルメニュー */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="mx-auto max-w-[1200px] px-4 py-2 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="h-px bg-border my-1" />

            <button
              onClick={() => {
                toggleLocale();
                setMobileOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors duration-200"
            >
              <Globe className="h-4 w-4" />
              {locale === "ja" ? "English" : "日本語"}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

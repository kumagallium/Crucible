"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Servers" },
  { href: "/register", label: "Register" },
  { href: "/guide", label: "Guide" },
  { href: "/about", label: "About" },
  { href: "/release-notes", label: "Release Notes" },
];

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1200px] px-6 flex items-center justify-between h-14">
        {/* ロゴ */}
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

        {/* ナビゲーション */}
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
      </div>
    </header>
  );
}

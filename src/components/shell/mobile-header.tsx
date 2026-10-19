import Link from "next/link";
import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2" aria-label="Bctrl Hub — Hoje">
        <BrandSymbol className="size-7" title="" aria-hidden />
        <BrandWordmark className="text-lg" />
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}

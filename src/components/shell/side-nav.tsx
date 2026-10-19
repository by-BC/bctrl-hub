"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";
import { NAV_ITEMS, isActivePath } from "./nav-items";
import { SyncStatus } from "./sync-status";
import { ThemeToggle } from "./theme-toggle";

export function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
        <BrandSymbol className="size-8" />
        <BrandWordmark className="text-xl" />
      </Link>

      <Suspense fallback={<SideNavLinks pathname={null} />}>
        <ActiveSideNavLinks />
      </Suspense>

      <SyncStatus className="px-3 pb-3" />

      <div className="flex items-center justify-between border-t px-3 py-3">
        <ThemeToggle />
        <LogoutButton withLabel />
      </div>
    </aside>
  );
}

function ActiveSideNavLinks() {
  return <SideNavLinks pathname={usePathname()} />;
}

function SideNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Navegação principal" className="flex-1 px-3">
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon aria-hidden className={cn("size-[18px]", active && "text-primary-text")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

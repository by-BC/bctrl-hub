"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActivePath } from "./nav-items";

// usePathname() só existe em runtime nas rotas dinâmicas: o item ativo entra
// via Suspense e o fallback (sem destaque) vai no shell estático.
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavList pathname={null} />}>
      <ActiveBottomNav />
    </Suspense>
  );
}

function ActiveBottomNav() {
  return <BottomNavList pathname={usePathname()} />;
}

function BottomNavList({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.filter((item) => item.mobile).map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-5", active && "text-primary-text")}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

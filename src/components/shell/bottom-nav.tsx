"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Suspense, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryItems = NAV_ITEMS.filter((item) => !item.mobile);
  const moreActive = pathname !== null && secondaryItems.some((item) => isActivePath(pathname, item.href));

  return (
    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {NAV_ITEMS.filter((item) => item.mobile).map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
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
        <li>
          <button
            type="button"
            aria-label="Mais seções"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              moreActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu aria-hidden className={cn("size-5", moreActive && "text-primary-text")} />
            Mais
          </button>
        </li>
      </ul>
    </nav>
    <SheetContent side="bottom" className="gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] lg:hidden">
      <SheetHeader className="pb-2">
        <SheetTitle>Mais seções</SheetTitle>
      </SheetHeader>
      <nav aria-label="Outras seções" className="px-4 pb-4">
        <ul className="grid gap-1">
          {secondaryItems.map(({ href, label, icon: Icon }) => {
            const active = pathname !== null && isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active && "bg-accent text-primary-text",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </SheetContent>
    </Sheet>
  );
}

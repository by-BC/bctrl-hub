import { BottomNav } from "@/components/shell/bottom-nav";
import { MobileHeader } from "@/components/shell/mobile-header";
import { SideNav } from "@/components/shell/side-nav";

// O acesso já é garantido pelo proxy (src/proxy.ts). Este layout não lê a
// sessão: com Cache Components, o shell continua estático e instantâneo.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main
          id="conteudo"
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-10 lg:pt-10 lg:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

import { BottomNav } from "@/components/shell/bottom-nav";
import { MobileHeader } from "@/components/shell/mobile-header";
import { SideNav } from "@/components/shell/side-nav";
import { WorkoutSessionProvider } from "@/features/workout-session/workout-session-provider";

// O acesso já é garantido pelo proxy (src/proxy.ts). Este layout não lê a
// sessão: com Cache Components, o shell continua estático e instantâneo.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {/* Teclado: o primeiro Tab oferece pular a navegação lateral. */}
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-4 outline-none pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-10 lg:pt-10 lg:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomNav />
      {/* Lê a sessão de treino do aparelho e reenvia treino finalizado sem rede. */}
      <WorkoutSessionProvider />
    </div>
  );
}

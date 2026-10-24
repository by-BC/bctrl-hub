import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";

/** Um único acesso aos geradores, sem competir com os dados principais do Perfil. */
export function ProfileStories() {
  return (
    <Link
      href="/perfil/stories"
      className="group flex min-h-20 items-center gap-4 rounded-2xl border bg-card px-5 py-4 outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Criar um story</span>
        <span className="block text-sm text-muted-foreground">Do dia ou de um treino salvo</span>
      </span>
      <ArrowUpRight aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

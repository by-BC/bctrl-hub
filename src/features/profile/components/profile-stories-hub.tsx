import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

/** O Perfil oferece somente o resumo geral do dia; stories de sessões ficam em Treino. */
export function ProfileStoriesHub() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/perfil/story"
        className="group relative flex min-h-40 items-center justify-between gap-6 overflow-hidden rounded-2xl bg-brand-ink px-6 py-7 text-brand-paper outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-8"
      >
        <span className="relative z-10 max-w-md">
          <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-highlight-text"><Sparkles aria-hidden className="size-4" /> Resumo do dia</span>
          <span className="block text-2xl font-bold sm:text-3xl">Seu dia em um story</span>
          <span className="mt-2 block text-sm text-brand-paper/70">Treino, alimentação, hábitos e tarefas em um resumo geral.</span>
        </span>
        <span aria-hidden className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-paper/30 transition-transform group-hover:translate-x-1"><ArrowRight className="size-5" /></span>
        <span aria-hidden className="absolute -right-8 -top-20 size-64 rounded-full border border-brand-paper/10" />
        <span aria-hidden className="absolute -right-2 -top-14 size-48 rounded-full border border-brand-paper/10" />
      </Link>
    </div>
  );
}

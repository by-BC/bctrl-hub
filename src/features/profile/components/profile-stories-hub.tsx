"use client";

import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useHistory } from "@/features/history/hooks";
import { formatDay } from "@/lib/format";

export function ProfileStoriesHub() {
  const { data, isPending, isError } = useHistory();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <Link
        href="/perfil/story"
        className="group relative flex min-h-40 items-center justify-between gap-6 overflow-hidden rounded-2xl bg-brand-ink px-6 py-7 text-brand-paper outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-8"
      >
        <span className="relative z-10 max-w-md">
          <span className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-highlight-text"><Sparkles aria-hidden className="size-4" /> Resumo do dia</span>
          <span className="block text-2xl font-bold sm:text-3xl">Seu dia em um story</span>
          <span className="mt-2 block text-sm text-brand-paper/70">Treino, alimentação, hábitos e tarefas.</span>
        </span>
        <span aria-hidden className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-paper/30 transition-transform group-hover:translate-x-1"><ArrowRight className="size-5" /></span>
        <span aria-hidden className="absolute -right-8 -top-20 size-64 rounded-full border border-brand-paper/10" />
        <span aria-hidden className="absolute -right-2 -top-14 size-48 rounded-full border border-brand-paper/10" />
      </Link>

      <section className="space-y-4" aria-labelledby="workout-story-list-title">
        <div>
          <h2 id="workout-story-list-title" className="text-xl font-semibold">Um treino para compartilhar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Escolha uma sessão para abrir os quatro layouts do Perfil.</p>
        </div>
        {isPending ? (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando treinos">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[76px] w-full rounded-xl" />)}
          </div>
        ) : isError ? (
          <p role="alert" className="rounded-xl border p-5 text-sm text-muted-foreground">Não foi possível carregar os treinos salvos.</p>
        ) : data.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Finalize seu primeiro treino para criar um story por aqui.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card" aria-label="Treinos recentes">
            {data.slice(0, 8).map((workout, index) => (
              <li key={workout.id}>
                <Link
                  href={`/perfil/stories/${workout.id}`}
                  className="group flex min-h-[76px] items-center gap-4 px-4 py-3 outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{workout.routine?.name ?? "Treino livre"}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays aria-hidden className="size-3.5" />{formatDay(workout.day)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary-text">Layouts <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!isPending && !isError && data.length > 8 && (
          <Link href="/treino/historico" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-text underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Abrir histórico completo <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </section>
    </div>
  );
}

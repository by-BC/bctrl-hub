"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/format";
import { useHistory } from "@/features/history/hooks";

/** Acesso no Perfil aos quatro layouts que podem ser aplicados a qualquer treino salvo. */
export function ProfileStories() {
  const { data, isPending, isError } = useHistory();

  return (
    <section className="space-y-3" aria-labelledby="profile-stories-title">
      <div>
        <h2 id="profile-stories-title" className="text-lg font-semibold">Stories</h2>
        <p className="text-sm text-muted-foreground">O story do dia e quatro estilos para compartilhar um treino.</p>
      </div>
      <Link
        href="/perfil/story"
        className="flex min-h-16 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span>
          <span className="block font-semibold">Story de hoje</span>
          <span className="block text-sm text-muted-foreground">Alimentação, hábitos, tarefas e treino</span>
        </span>
        <span aria-hidden className="text-muted-foreground">›</span>
      </Link>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Layouts para um treino</h3>
        {isPending ? (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando treinos">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <p role="alert" className="rounded-xl border p-4 text-sm text-muted-foreground">Não foi possível carregar os treinos salvos.</p>
        ) : data.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Finalize um treino para liberar os layouts.</p>
        ) : (
          <ul className="space-y-2" aria-label="Treinos para criar stories">
            {data.slice(0, 5).map((workout) => (
              <li key={workout.id}>
                <Link
                  href={`/perfil/stories/${workout.id}`}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{workout.routine?.name ?? "Treino livre"}</span>
                    <span className="block text-sm text-muted-foreground first-letter:uppercase">{formatDay(workout.day)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-primary">Ver layouts <span aria-hidden>→</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!isPending && !isError && data.length > 5 && (
          <Link href="/treino/historico" className="inline-flex min-h-11 items-center text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Ver mais treinos no histórico
          </Link>
        )}
      </div>
    </section>
  );
}

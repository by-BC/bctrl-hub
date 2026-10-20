"use client";

import { Award, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AchievementView } from "@/lib/domain/achievements";
import { formatInt, formatShortDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAchievements } from "../hooks";

/** Unidade do progresso de cada conquista ("82 de 100 treinos"). */
const PROGRESS_UNIT: Record<string, (n: number) => string> = {
  first_pr: (n) => (n === 1 ? "recorde" : "recordes"),
  training_weeks_4: (n) => (n === 1 ? "semana" : "semanas"),
  control_days_30: (n) => (n === 1 ? "dia" : "dias"),
  session_1000kg: () => "kg",
  workouts_100: (n) => (n === 1 ? "treino" : "treinos"),
  diet_month_80: () => "%",
};

/** "82 de 100 treinos", "640 de 1.000 kg", "62% de 80%". */
export function progressText(a: Pick<AchievementView, "key" | "current" | "target">): string {
  const unit = PROGRESS_UNIT[a.key]?.(a.target) ?? "";
  const current = formatInt(Math.floor(a.current));
  const target = formatInt(a.target);
  if (unit === "%") return `${current}% de ${target}%`;
  return `${current} de ${target}${unit ? ` ${unit}` : ""}`;
}

/** Conquistas do histórico inteiro (inclui o Hevy). */
export function AchievementsSection() {
  const { achievements, isError, refetch } = useAchievements();
  return (
    <section aria-labelledby="conquistas-titulo" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="conquistas-titulo" className="flex items-center gap-2 text-lg font-semibold">
          <Award aria-hidden className="size-5 text-primary-text" />
          Conquistas
        </h2>
        {achievements && (
          <p className="num text-xs text-muted-foreground">
            {achievements.filter((a) => a.unlockedOn).length} de {achievements.length} desbloqueadas
          </p>
        )}
      </div>
      {isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar as conquistas.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : achievements ? (
        <Achievements items={achievements} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1" role="status" aria-busy="true" aria-label="Carregando as conquistas">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[6.5rem] rounded-xl" />
          ))}
        </div>
      )}
    </section>
  );
}

/** Lista das conquistas: desbloqueadas primeiro; estado sempre com ícone e texto. */
export function Achievements({ items }: { items: readonly AchievementView[] }) {
  const unlocked = items.filter((a) => a.unlockedOn);
  const locked = items.filter((a) => !a.unlockedOn);
  return (
    <div className="space-y-3">
      {unlocked.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma conquista ainda. A barra mostra quanto falta para cada uma.</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1" aria-label="Conquistas">
        {[...unlocked, ...locked].map((a) => (
          <AchievementCard key={a.key} a={a} />
        ))}
      </ul>
    </div>
  );
}

function AchievementCard({ a }: { a: AchievementView }) {
  const done = a.unlockedOn !== null;
  const pct = Math.round(a.progress * 100);
  return (
    <li
      data-testid={`achievement-${a.key}`}
      data-state={done ? "unlocked" : "locked"}
      className={cn(
        "flex min-h-[6.5rem] gap-3 rounded-xl border p-4",
        done ? "border-primary/40 bg-primary/10" : "bg-card",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Award className="size-5" /> : <Lock className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{a.title}</p>
        <p className="text-xs font-medium">
          {done ? (
            <span className="text-primary-text">Desbloqueada em {formatShortDay(a.unlockedOn!, { year: true })}</span>
          ) : (
            <span className="text-muted-foreground">Bloqueada</span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{a.rule}</p>
        {!done && (
          <div className="mt-2">
            <div
              role="progressbar"
              aria-label={`Progresso de ${a.title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={progressText(a)}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${pct}%` }} />
            </div>
            <p className="num mt-1 text-xs text-muted-foreground">{progressText(a)}</p>
          </div>
        )}
      </div>
    </li>
  );
}

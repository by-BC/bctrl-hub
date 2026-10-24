"use client";

import { ChevronRight, CircleCheck, History, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { habitOrder, QuickCheck, unitOf } from "@/features/habits/components/habit-week";
import { HabitLogSheet } from "@/features/habits/components/habit-log-sheet";
import type { Habit, HabitLog } from "@/features/habits/api";
import { useHabitLogs, useHabits } from "@/features/habits/hooks";
import { MealCard } from "@/features/meals/components/meal-day";
import { MealSheet } from "@/features/meals/components/meal-sheet";
import { DayNutrition } from "@/features/nutrition/components/nutrition-bars";
import { useMealDay } from "@/features/meals/hooks";
import { useToday } from "@/features/progress/use-today";
import { useRoutines } from "@/features/routines/hooks";
import { TaskRow } from "@/features/tasks/components/task-list";
import { useTasks } from "@/features/tasks/hooks";
import { useWeekSummary } from "@/features/week/hooks";
import { StartWorkoutCard, WORKOUT_CARD_SKELETON } from "@/features/workout-session/components/start-workout-card";
import { useLastFinishedRoutineId, useWorkoutHydrated } from "@/features/workout-session/hooks";
import { useActiveWorkout } from "@/features/workout-session/store";
import { dayMet, habitProgress } from "@/features/habits/domain/habits";
import { weekStart } from "@/lib/domain/week";
import { nextRoutineId } from "@/lib/domain/workout";
import { formatDay, formatKg } from "@/lib/format";
import { HexWeekCard } from "./hex-week-card";

/** Tarefas pendentes mostradas no painel (as demais ficam em /tarefas). */
const TASKS_ON_PANEL = 3;

/**
 * Painel Hoje: Hex Week da semana, treino de hoje, refeições, hábitos e tarefas, com as
 * ações rápidas de cada feature. Dados lidos no cliente (TanStack Query + RLS) com o dia
 * calculado no navegador: o shell da página continua estático.
 */
export function TodayPanel() {
  const today = useToday();

  return (
    <>
      <p className="num -mt-4 mb-6 min-h-5 text-sm text-muted-foreground first-letter:uppercase" data-testid="today-date">
        {today && formatDay(today)}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6">
        <div className="lg:sticky lg:top-10">
          <HexWeekCard today={today} />
        </div>
        <div className="grid min-w-0 gap-4 lg:gap-6">
          {today ? <TodayWorkout today={today} /> : <Skeleton className={WORKOUT_CARD_SKELETON} />}
          <PanelSection id="refeicoes" title="Refeições de hoje" href="/comida" linkLabel="Comida">
            {today ? <TodayMeals today={today} /> : <MealsSkeleton />}
          </PanelSection>
          <PanelSection id="habitos" title="Hábitos" href="/habitos" linkLabel="Hábitos">
            {today ? <TodayHabits today={today} /> : <ListSkeleton rows={3} />}
          </PanelSection>
          <PanelSection id="tarefas" title="Tarefas pendentes" href="/tarefas" linkLabel="Tarefas">
            <TodayTasks />
          </PanelSection>
        </div>
      </div>
    </>
  );
}

// ── Blocos ────────────────────────────────────────────────────────────────

function PanelSection({
  id,
  title,
  href,
  linkLabel,
  children,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} data-testid={`today-${id}`} className="rounded-2xl border bg-card p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id={`${id}-titulo`} className="font-semibold">
          {title}
        </h2>
        <Button asChild variant="ghost" className="-mr-2 h-11 text-muted-foreground">
          <Link href={href} aria-label={`Abrir ${linkLabel}`}>
            {linkLabel}
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </header>
      {children}
    </section>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Linha da adesão + 5 refeições (o plano típico): o bloco não pula quando os dados chegam. */
function MealsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando refeições">
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function LoadError({ what, retry }: { what: string; retry: () => unknown }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 text-sm">
      <p>Não foi possível carregar {what}.</p>
      <Button variant="outline" className="h-11" onClick={() => retry()}>
        Tentar de novo
      </Button>
    </div>
  );
}

function EmptyLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      {icon}
      <span>{children}</span>
    </p>
  );
}

/**
 * Treino de hoje: sessão no aparelho → "Continuar treino"; treino já finalizado hoje →
 * "Finalizado hoje" com o próximo da sequência; senão, a próxima rotina + Iniciar.
 */
function TodayWorkout({ today }: { today: string }) {
  const hydrated = useWorkoutHydrated();
  const active = useActiveWorkout((s) => s.workout !== null);
  const summary = useWeekSummary(weekStart(today));

  if (!hydrated || (!active && summary.isPending)) return <Skeleton className={WORKOUT_CARD_SKELETON} />;
  const trainedToday = summary.data?.days.find((d) => d.day === today)?.trained ?? false;
  if (active || !trainedToday) return <StartWorkoutCard eyebrow="Treino de hoje" />;
  return <FinishedToday />;
}

function FinishedToday() {
  const routines = useRoutines();
  const last = useLastFinishedRoutineId();
  const list = routines.data ?? [];
  const lastName = list.find((r) => r.id === last.data)?.name;
  const nextId = nextRoutineId(
    list.map((r) => ({ id: r.id, position: r.position, archivedAt: r.archived_at })),
    last.data ?? null,
  );
  const next = list.find((r) => r.id === nextId);

  return (
    <section
      aria-labelledby="treino-feito-titulo"
      className="rounded-2xl border bg-card p-4"
      data-testid="finished-workout-card"
    >
      <p className="num mb-1 text-xs tracking-[0.2em] text-muted-foreground uppercase">Treino de hoje</p>
      <h2 id="treino-feito-titulo" className="flex items-center gap-2 text-xl font-bold">
        <CircleCheck aria-hidden className="size-5 shrink-0 text-primary-text" />
        Finalizado hoje
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        {lastName ? `${lastName} concluído.` : "Treino concluído."}
        {next && ` Próximo na sequência: ${next.name}.`}
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/treino/historico">
          <History aria-hidden />
          Ver no histórico
        </Link>
      </Button>
    </section>
  );
}

/** Refeições do dia: tocar abre o mesmo sheet de /comida (escolher a opção e marcar). */
function TodayMeals({ today }: { today: string }) {
  const { data, isError, refetch } = useMealDay(today);
  const [openMealId, setOpenMealId] = useState<string | null>(null);

  if (isError) return <LoadError what="as refeições" retry={refetch} />;
  if (!data) return <MealsSkeleton />;
  if (data.visible.length === 0) {
    return (
      <EmptyLine icon={<Plus aria-hidden className="mt-0.5 size-4 shrink-0" />}>
        Nenhuma refeição no plano.{" "}
        <Link href="/comida/plano" className="font-medium text-primary-text underline underline-offset-4">
          Montar o plano
        </Link>
      </EmptyLine>
    );
  }

  const openMeal = data.visible.find((m) => m.id === openMealId) ?? null;
  const { done, planned } = data.adherence;
  const unlogged = data.visible.filter((meal) => !data.byMeal.has(meal.id));
  const logged = data.visible.filter((meal) => data.byMeal.has(meal.id));

  return (
    <>
      <p className="num mb-3 text-sm text-muted-foreground" data-testid="today-meals-adherence">
        {done} de {planned} no plano hoje
      </p>
      {unlogged.length > 0 ? (
        <ul className="space-y-2" aria-label="Refeições pendentes">
          {unlogged.map((meal) => (
            <li key={meal.id}>
              <MealCard meal={meal} log={undefined} onOpen={() => setOpenMealId(meal.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">Todas as refeições foram registradas.</p>
      )}
      {logged.length > 0 && (
        <details className="mt-3 rounded-xl border px-3">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-medium">
            Refeições registradas <span className="num text-muted-foreground">{logged.length}</span>
          </summary>
          <ul className="space-y-2 border-t py-3" aria-label="Refeições registradas">
            {logged.map((meal) => (
              <li key={meal.id}>
                <MealCard meal={meal} log={data.byMeal.get(meal.id)} onOpen={() => setOpenMealId(meal.id)} />
              </li>
            ))}
          </ul>
        </details>
      )}
      <DayNutrition day={today} headingLevel={3} className="mt-3" />
      <MealSheet
        day={today}
        meal={openMeal}
        log={openMeal ? data.byMeal.get(openMeal.id) : undefined}
        onOpenChange={(open) => !open && setOpenMealId(null)}
      />
    </>
  );
}

/** Hábitos ativos: check rápido de hoje ou "Registrar" (cardio e quantidade abrem o sheet). */
function TodayHabits({ today }: { today: string }) {
  const week = weekStart(today);
  const habits = useHabits();
  const logs = useHabitLogs(week);
  const [logging, setLogging] = useState<string | null>(null);

  const logsByHabit = useMemo(() => {
    const map = new Map<string, HabitLog[]>();
    for (const log of logs.data ?? []) {
      const list = map.get(log.habit_id);
      if (list) list.push(log);
      else map.set(log.habit_id, [log]);
    }
    return map;
  }, [logs.data]);

  if (habits.isError || logs.isError) {
    return <LoadError what="os hábitos" retry={() => Promise.all([habits.refetch(), logs.refetch()])} />;
  }
  if (!habits.data || !logs.data) return <ListSkeleton rows={3} />;

  const active = habits.data
    .filter((h) => !h.archived_at)
    .sort((a, b) => habitOrder(a) - habitOrder(b));
  if (active.length === 0) {
    return (
      <EmptyLine icon={<Plus aria-hidden className="mt-0.5 size-4 shrink-0" />}>
        Nenhum hábito ainda.{" "}
        <Link href="/habitos" className="font-medium text-primary-text underline underline-offset-4">
          Criar o primeiro
        </Link>
      </EmptyLine>
    );
  }

  const loggingHabit = active.find((h) => h.id === logging) ?? null;

  return (
    <>
      <ul className="divide-y" aria-label="Hábitos de hoje">
        {active.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            logs={logsByHabit.get(habit.id) ?? []}
            week={week}
            today={today}
            onLog={() => setLogging(habit.id)}
          />
        ))}
      </ul>
      <HabitLogSheet
        habit={loggingHabit}
        logs={loggingHabit ? (logsByHabit.get(loggingHabit.id) ?? []) : []}
        week={week}
        today={today}
        onOpenChange={(open) => !open && setLogging(null)}
      />
    </>
  );
}

function HabitRow({
  habit,
  logs,
  week,
  today,
  onLog,
}: {
  habit: Habit;
  logs: HabitLog[];
  week: string;
  today: string;
  onLog: () => void;
}) {
  const progress = useMemo(() => habitProgress(habit, logs, week), [habit, logs, week]);
  const unit = unitOf(habit);
  const todayMet = habit.period === "day" && dayMet(habit, progress, today);

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
      data-testid="today-habit"
    >
      <div className="min-w-0">
        <p className="font-medium break-words">{habit.name}</p>
        <p className="num flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="today-habit-total">
          {progress.met && <CircleCheck aria-hidden className="size-3.5 shrink-0 text-primary-text" />}
          {formatKg(progress.done)}/{formatKg(progress.target)} {unit} na semana
          {habit.period === "day" && ` · hoje ${todayMet ? "feito" : "pendente"}`}
        </p>
      </div>
      <div className="flex min-w-40 shrink-0 grow sm:grow-0">
        {habit.kind === "check" ? (
          <QuickCheck habit={habit} logs={logs} week={week} today={today} />
        ) : (
          <Button variant="outline" className="h-11 flex-1" onClick={onLog} aria-label={`Registrar ${habit.name}`}>
            <Plus aria-hidden />
            Registrar
          </Button>
        )}
      </div>
    </li>
  );
}

function TodayTasks() {
  const { data, isPending, isError, refetch } = useTasks();
  const [showAll, setShowAll] = useState(false);
  if (isError) return <LoadError what="as tarefas" retry={refetch} />;
  if (isPending) return <ListSkeleton rows={2} />;

  const pending = data.filter((t) => !t.done_at);
  if (pending.length === 0) {
    return (
      <EmptyLine icon={<ListChecks aria-hidden className="mt-0.5 size-4 shrink-0" />}>
        Nada pendente.{" "}
        <Link href="/tarefas" className="font-medium text-primary-text underline underline-offset-4">
          Anotar uma tarefa
        </Link>
      </EmptyLine>
    );
  }
  const shown = showAll ? pending : pending.slice(0, TASKS_ON_PANEL);
  return (
    <>
      <ul aria-label="Tarefas pendentes" className="divide-y rounded-xl border">
        {shown.map((task) => (
          <TaskRow key={task.id} task={task} deletable={false} />
        ))}
      </ul>
      {pending.length > TASKS_ON_PANEL && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" className="h-11 px-2 text-sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Mostrar menos" : `Ver mais ${pending.length - TASKS_ON_PANEL} tarefas`}
          </Button>
          <Link href="/tarefas" className="text-sm font-medium text-primary-text underline underline-offset-4">
            Abrir tarefas
          </Link>
        </div>
      )}
    </>
  );
}

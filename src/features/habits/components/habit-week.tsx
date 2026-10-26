"use client";

import {
  ArchiveRestore,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Dumbbell,
  Flame,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/features/progress/use-today";
import { useWeekSummary } from "@/features/week/hooks";
import {
  dayMet,
  groupByWeek,
  habitProgress,
  streak,
  type HabitLogLike,
  type HabitProgress,
} from "@/features/habits/domain/habits";
import { weekDays, weekStart } from "@/lib/domain/week";
import { formatKg, formatShortDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "../api";
import {
  newHabitLog,
  useDeleteHabit,
  useHabitLogs,
  useHabits,
  useLogHabit,
  useTrainedDays,
  useUndoHabitLog,
  useUpdateHabit,
} from "../hooks";
import { HabitFormSheet } from "./habit-form-sheet";
import { HabitLogSheet } from "./habit-log-sheet";

/** Ordem dos hábitos do sistema na tela; os customizados vêm depois, por criação. */
const SYSTEM_ORDER: Record<string, number> = { cardio: 0, abs: 1, supplements: 2 };
export const habitOrder = (h: Pick<Habit, "system_key">) => (h.system_key ? SYSTEM_ORDER[h.system_key] ?? 9 : 10);

/** "30/150 min", "2/3 dias". */
export function unitOf(habit: Pick<Habit, "kind" | "unit">) {
  return habit.kind === "check" ? "dias" : (habit.unit ?? "");
}

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const weekdayShort = (day: string) => weekdayFormatter.format(new Date(`${day}T12:00:00Z`)).replace(".", "");

/** Conteúdo de /habitos: progresso da semana (domingo a sábado) de cada hábito e o streak. */
export function HabitWeek() {
  const today = useToday();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader title="Hábitos" eyebrow="Semana">
        <Button className="h-11 font-semibold" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          Novo hábito
        </Button>
      </PageHeader>
      {today ? <WeekContent today={today} /> : <WeekSkeleton />}
      <HabitFormSheet open={creating} habit={null} onOpenChange={setCreating} />
    </>
  );
}

function WeekContent({ today }: { today: string }) {
  const week = weekStart(today);
  const days = weekDays(week);
  const habits = useHabits();
  const logs = useHabitLogs(week);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
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
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
        <p>Não foi possível carregar os hábitos.</p>
        <Button variant="outline" className="h-11" onClick={() => Promise.all([habits.refetch(), logs.refetch()])}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!habits.data || !logs.data) return <WeekSkeleton />;

  const active = habits.data.filter((h) => !h.archived_at).sort((a, b) => habitOrder(a) - habitOrder(b));
  const archived = habits.data.filter((h) => h.archived_at);
  const editingHabit = habits.data.find((h) => h.id === editing) ?? null;
  const loggingHabit = habits.data.find((h) => h.id === logging) ?? null;

  return (
    <>
      <p className="num mb-4 text-sm text-muted-foreground" data-testid="habit-week">
        Semana de {formatShortDay(days[0])} a {formatShortDay(days[6])}
      </p>

      <ul className="grid gap-3 md:grid-cols-2" aria-label="Hábitos da semana">
        <li>
          <TrainingCard week={week} />
        </li>
        {active.map((habit) => (
          <li key={habit.id}>
            <HabitCard
              habit={habit}
              logs={logsByHabit.get(habit.id) ?? []}
              week={week}
              today={today}
              onEdit={() => setEditing(habit.id)}
              onLog={() => setLogging(habit.id)}
            />
          </li>
        ))}
      </ul>

      {active.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Nenhum hábito ainda. Toque em “Novo hábito” para criar o primeiro.
        </p>
      )}

      {archived.length > 0 && (
        <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen} asChild>
          <section aria-label="Arquivados" className="mt-6">
            <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <ChevronDown aria-hidden className={`size-4 transition-transform ${archivedOpen ? "rotate-180" : ""}`} />
              Arquivados <span className="num font-normal text-muted-foreground">{archived.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 divide-y rounded-xl border bg-card">
                {archived.map((habit) => (
                  <ArchivedRow key={habit.id} habit={habit} />
                ))}
              </ul>
            </CollapsibleContent>
          </section>
        </Collapsible>
      )}

      <HabitFormSheet open={!!editingHabit} habit={editingHabit} onOpenChange={(open) => !open && setEditing(null)} />
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

// ── Cartões ───────────────────────────────────────────────────────────────

function ProgressBar({ label, done, target, pct, met }: { label: string; done: number; target: number; pct: number; met: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(done, target)}
      aria-valuetext={`${formatKg(done)} de ${formatKg(target)}`}
      className="h-2 overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn("h-full rounded-full transition-[width] motion-reduce:transition-none", met ? "bg-primary" : "bg-highlight")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusLine({ met, missing, unit }: { met: boolean; missing: number; unit: string }) {
  return met ? (
    <span className="flex items-center gap-1.5 text-sm font-medium text-primary-text">
      <CircleCheck aria-hidden className="size-4 shrink-0" />
      Meta cumprida
    </span>
  ) : (
    <span className="num flex items-center gap-1.5 text-sm text-muted-foreground">
      <CircleDashed aria-hidden className="size-4 shrink-0" />
      Faltam {formatKg(missing)} {unit}
    </span>
  );
}

function StreakBadge({ weeks }: { weeks: number }) {
  return (
    <span
      className={cn("num flex items-center gap-1 text-xs", weeks > 0 ? "text-highlight-text" : "text-muted-foreground")}
      data-testid="habit-streak"
    >
      <Flame aria-hidden className="size-3.5 shrink-0" />
      {weeks === 1 ? "1 semana seguida" : `${weeks} semanas seguidas`}
    </span>
  );
}

function CardShell({
  name,
  testId,
  children,
  action,
}: {
  name: string;
  testId: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <article aria-label={name} data-testid={testId} className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 pt-2 font-semibold break-words">{name}</h2>
        {action}
      </header>
      {children}
    </article>
  );
}

/** "Treino": somente leitura, conta os treinos finalizados da semana (meta 4). */
function TrainingCard({ week }: { week: string }) {
  const summary = useWeekSummary(week);
  const trained = useTrainedDays(week);
  const target = summary.data?.workouts.target ?? 4;

  // Mesma regra de um hábito "check" semanal: dias distintos com treino finalizado.
  const weeks = useMemo(() => {
    if (!trained.data) return null;
    const logs: HabitLogLike[] = trained.data.map((day) => ({ day, value: 1 }));
    return streak({ kind: "check", period: "week", target }, groupByWeek(logs, weekStart), week);
  }, [trained.data, target, week]);

  const done = summary.data?.workouts.done ?? 0;
  const met = done >= target;

  return (
    <CardShell
      name="Treino"
      testId="habit-card"
      action={
        <Button asChild variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Ir para Treino">
          <Link href="/treino">
            <Dumbbell aria-hidden />
          </Link>
        </Button>
      }
    >
      {summary.isError ? (
        <p className="text-sm text-muted-foreground" role="status">
          Treinos da semana indisponíveis.
        </p>
      ) : !summary.data ? (
        <Skeleton className="h-14 w-full" />
      ) : (
        <>
          <p className="num text-2xl font-semibold" data-testid="habit-total">
            {done}/{target} <span className="text-sm font-normal text-muted-foreground">treinos</span>
          </p>
          <ProgressBar label="Treino" done={done} target={target} pct={Math.min(100, Math.round((done / target) * 100))} met={met} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusLine met={met} missing={target - done} unit="treinos" />
            {weeks !== null && <StreakBadge weeks={weeks} />}
          </div>
        </>
      )}
      <p className="mt-auto text-xs text-muted-foreground">Conta sozinho ao finalizar um treino.</p>
    </CardShell>
  );
}

function HabitCard({
  habit,
  logs,
  week,
  today,
  onEdit,
  onLog,
}: {
  habit: Habit;
  logs: HabitLog[];
  week: string;
  today: string;
  onEdit: () => void;
  onLog: () => void;
}) {
  const progress = useMemo(() => habitProgress(habit, logs, week), [habit, logs, week]);
  const weeks = useMemo(() => streak(habit, groupByWeek(logs, weekStart), week), [habit, logs, week]);
  const unit = unitOf(habit);

  return (
    <CardShell
      name={habit.name}
      testId="habit-card"
      action={
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Editar ${habit.name}`} onClick={onEdit}>
          <Pencil aria-hidden />
        </Button>
      }
    >
      <p className="num text-2xl font-semibold" data-testid="habit-total">
        {formatKg(progress.done)}/{formatKg(progress.target)}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {unit}
          {habit.period === "day" && " na semana"}
        </span>
      </p>
      <ProgressBar label={habit.name} {...progress} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusLine met={progress.met} missing={progress.target - progress.done} unit={unit} />
        <StreakBadge weeks={weeks} />
      </div>

      {habit.kind === "cardio" && <CardioTotals progress={progress} />}
      {habit.period === "day" && <TodayLine habit={habit} progress={progress} today={today} />}
      <DayStrip habit={habit} progress={progress} today={today} />

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {habit.kind === "check" ? (
          <>
            <QuickCheck habit={habit} logs={logs} week={week} today={today} />
            <Button variant="outline" className="h-11" onClick={onLog} aria-label={`Outro dia: registros de ${habit.name}`}>
              <CalendarPlus aria-hidden />
              Outro dia
            </Button>
          </>
        ) : (
          <Button className="h-11 flex-1 font-semibold" onClick={onLog} aria-label={`Registrar ${habit.name}`}>
            <Plus aria-hidden />
            Registrar
          </Button>
        )}
      </div>
    </CardShell>
  );
}

function CardioTotals({ progress }: { progress: HabitProgress }) {
  return (
    <dl className="num grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2 text-center" data-testid="cardio-totals">
      <div>
        <dt className="text-[0.7rem] text-muted-foreground">Sessões</dt>
        <dd className="font-semibold">{progress.sessions}</dd>
      </div>
      <div>
        <dt className="text-[0.7rem] text-muted-foreground">Distância</dt>
        <dd className="font-semibold">{formatKg(progress.distanceKm)} km</dd>
      </div>
      <div>
        <dt className="text-[0.7rem] text-muted-foreground">Calorias</dt>
        <dd className="font-semibold">{formatKg(progress.kcal)} kcal</dd>
      </div>
    </dl>
  );
}

/** Hábito diário: o dia de hoje em destaque. */
function TodayLine({ habit, progress, today }: { habit: Habit; progress: HabitProgress; today: string }) {
  const met = dayMet(habit, progress, today);
  const value = progress.byDay[today] ?? 0;
  return (
    <p
      className={cn("flex items-center gap-1.5 text-sm font-medium", met ? "text-primary-text" : "text-muted-foreground")}
      data-testid="habit-today"
    >
      {met ? <CircleCheck aria-hidden className="size-4" /> : <CircleDashed aria-hidden className="size-4" />}
      Hoje: {habit.kind === "check" ? (met ? "feito" : "pendente") : `${formatKg(value)}/${formatKg(habit.target)} ${habit.unit ?? ""}`}
    </p>
  );
}

/** Os 7 dias (domingo → sábado) com ícone de feito/pendente. Só leitura. */
function DayStrip({ habit, progress, today }: { habit: Habit; progress: HabitProgress; today: string }) {
  const days = Object.keys(progress.byDay);
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label={`Dias de ${habit.name} nesta semana`}>
      {days.map((day) => {
        const value = progress.byDay[day];
        const full = habit.period === "day" ? dayMet(habit, progress, day) : value > 0;
        const label = `${weekdayShort(day)}: ${value > 0 ? (habit.kind === "check" ? "feito" : `${formatKg(value)} ${habit.unit ?? ""}`) : "sem registro"}`;
        return (
          <li
            key={day}
            aria-label={label}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-md py-1 text-[0.7rem] text-muted-foreground",
              day === today && "ring-1 ring-ring/60",
            )}
          >
            <span aria-hidden className="first-letter:uppercase">
              {weekdayShort(day).slice(0, 3)}
            </span>
            <span
              aria-hidden
              className={cn(
                "grid size-5 place-items-center rounded-full",
                full ? "bg-primary text-primary-foreground" : value > 0 ? "bg-highlight/40" : "border border-border",
              )}
            >
              {full && <Check className="size-3" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Check rápido de hoje em 1 toque; tocar de novo (ou "Desfazer" no aviso) desmarca.
 * O nome do hábito vai em texto só para leitores de tela (o nome acessível contém o texto visível).
 */
export function QuickCheck({ habit, logs, week, today }: { habit: Habit; logs: HabitLog[]; week: string; today: string }) {
  const logHabit = useLogHabit();
  const undo = useUndoHabitLog();
  const todayIds = logs.filter((l) => l.day === today).map((l) => l.id);
  const done = todayIds.length > 0;

  if (done) {
    return (
      <Button
        variant="secondary"
        className="h-11 flex-1 font-semibold"
        onClick={() => undo.mutate({ week, ids: todayIds })}
      >
        <Undo2 aria-hidden />
        <span>
          Feito hoje · Desfazer<span className="sr-only"> {habit.name} de hoje</span>
        </span>
      </Button>
    );
  }
  return (
    <Button
      className="h-11 flex-1 font-semibold"
      onClick={() => {
        const log = newHabitLog(habit.id, today);
        logHabit.mutate({ week, log });
        toast.success(`${habit.name}: feito hoje`, {
          action: { label: "Desfazer", onClick: () => undo.mutate({ week, ids: [log.id] }) },
        });
      }}
    >
      <Check aria-hidden />
      <span>
        Marcar<span className="sr-only"> {habit.name}</span> hoje
      </span>
    </Button>
  );
}

function ArchivedRow({ habit }: { habit: Habit }) {
  const update = useUpdateHabit();
  const remove = useDeleteHabit();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <li className="flex items-center gap-2 py-1 pr-1 pl-4" data-testid="archived-habit">
      <span className="min-w-0 flex-1 truncate text-sm">{habit.name}</span>
      <Button
        variant="ghost"
        className="h-11"
        aria-label={`Desarquivar ${habit.name}`}
        onClick={() => update.mutate({ id: habit.id, patch: { archived_at: null } })}
      >
        <ArchiveRestore aria-hidden />
        Desarquivar
      </Button>
      {!habit.system_key && (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-muted-foreground hover:text-destructive"
          aria-label={`Excluir ${habit.name}`}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Excluir “${habit.name}”?`}
        description="O hábito e todos os registros dele somem. Não dá para desfazer."
        confirmLabel="Excluir hábito"
        destructive
        onConfirm={() => remove.mutate(habit.id)}
      />
    </li>
  );
}

function WeekSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando hábitos" className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

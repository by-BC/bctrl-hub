"use client";

import { Archive, CalendarClock, CircleCheck, CircleSlash, Pencil, Plus, Save, Target } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/features/progress/use-today";
import { GOAL_METRICS, goalReached, latestValue, METRIC, type GoalMetric } from "@/lib/domain/composition";
import { cn } from "@/lib/utils";
import type { CompositionGoal, Measurement } from "../api";
import { useCompositionGoals, useSaveCompositionGoal, useUpdateCompositionGoal } from "../hooks";
import { formatDateBR, formatDayMonth, goalFormErrors, goalView } from "../goals-view";
import { metricInputValue, metricText, parseMetricInput } from "../view";
import { MetricValue } from "./metric-value";

type Editing = { open: boolean; goal: CompositionGoal | null };

/**
 * Metas de composição (% de gordura, músculo esquelético, visceral e peso): uma ativa por
 * métrica, com progresso (partida → atual → alvo) e a projeção pela tendência de todo o histórico.
 */
export function CompositionGoals({ measurements }: { measurements: Measurement[] }) {
  const goals = useCompositionGoals();
  const [editing, setEditing] = useState<Editing>({ open: false, goal: null });
  const used = new Set(goals.data?.map((g) => g.metric));
  const free = GOAL_METRICS.filter((m) => !used.has(m));

  return (
    <section aria-labelledby="metas-composicao" className="space-y-2" data-testid="composition-goals">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="metas-composicao" className="text-lg font-semibold">
          Metas
        </h2>
        {goals.data && free.length > 0 && (
          <Button variant="outline" className="h-11" onClick={() => setEditing({ open: true, goal: null })}>
            <Plus aria-hidden />
            Nova meta
          </Button>
        )}
      </div>

      {goals.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" aria-label="Carregando metas" />
      ) : goals.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-4 text-sm">
          <p>Não foi possível carregar as metas.</p>
          <Button variant="outline" className="h-11" onClick={() => goals.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : goals.data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground" data-testid="composition-goals-empty">
          <Target aria-hidden className="mb-2 size-5" />
          <p>Defina um alvo de % de gordura, massa muscular, gordura visceral ou peso para ver o progresso e quando deve chegar lá.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {goals.data.map((goal) => (
            <GoalCard key={goal.id} goal={goal} measurements={measurements} onEdit={() => setEditing({ open: true, goal })} />
          ))}
        </ul>
      )}

      <Sheet open={editing.open} onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}>
        <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl">
          {editing.open && (
            <GoalForm
              key={editing.goal?.id ?? "nova"}
              goal={editing.goal}
              free={free}
              measurements={measurements}
              close={() => setEditing((e) => ({ ...e, open: false }))}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function GoalCard({ goal, measurements, onEdit }: { goal: CompositionGoal; measurements: Measurement[]; onEdit: () => void }) {
  const update = useUpdateCompositionGoal();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const v = goalView(goal, measurements);
  const pct = Math.round(v.progress * 100);
  const hasDate = "date" in v.projection;

  return (
    <li className="space-y-3 rounded-xl border bg-card p-4" data-testid="composition-goal" data-metric={goal.metric}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold">{v.def.label}</h3>
        <span className="num text-sm font-semibold" data-testid="goal-progress">
          {v.progressText}
        </span>
      </div>
      {goal.achieved_on && (
        <p className="flex items-center gap-1 text-xs font-medium text-primary-text" data-testid="goal-achieved">
          <CircleCheck aria-hidden className="size-3.5 shrink-0" />
          Meta atingida em <span className="num">{formatDateBR(goal.achieved_on)}</span>
        </p>
      )}

      {/* Medidor de uma cor até o alvo; o número está no texto acima. */}
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-chart-1 transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <GoalPoint term="Partida" value={<MetricValue value={v.start.value} def={v.def} />} note={formatDayMonth(v.start.day)} />
        <GoalPoint term="Atual" value={<MetricValue value={v.current.value} def={v.def} />} note={formatDayMonth(v.current.day)} />
        <GoalPoint
          term="Alvo"
          value={<MetricValue value={v.target} def={v.def} />}
          note={goal.target_date ? `até ${formatDateBR(goal.target_date)}` : "sem data"}
        />
      </dl>

      <p className="flex items-start gap-1.5 text-sm" data-testid="goal-projection" data-projection={hasDate ? "date" : (v.projection as { none: string }).none}>
        {hasDate ? (
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
        ) : (
          <CircleSlash aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className={cn(!hasDate && "text-muted-foreground")}>
          {v.projectionText}
          {v.late && <span className="font-medium text-highlight-text"> (depois da data-alvo)</span>}
        </span>
      </p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onEdit} aria-label={`Editar meta: ${v.def.label}`}>
          <Pencil aria-hidden />
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => setConfirmOpen(true)}
          aria-label={`Arquivar meta: ${v.def.label}`}
        >
          <Archive aria-hidden />
          Arquivar
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Arquivar meta?"
        description={`A meta de ${v.def.label.toLowerCase()} (${metricText(v.target, v.def)}) sai da lista. Depois você pode definir outra para a mesma métrica.`}
        confirmLabel="Arquivar meta"
        onConfirm={() => update.mutate({ id: goal.id, patch: { archived_at: new Date().toISOString() } })}
      />
    </li>
  );
}

function GoalPoint({ term, value, note }: { term: string; value: ReactNode; note: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="font-semibold">{value}</dd>
      <dd className="num text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

function GoalForm({
  goal,
  free,
  measurements,
  close,
}: {
  goal: CompositionGoal | null;
  free: GoalMetric[];
  measurements: Measurement[];
  close: () => void;
}) {
  const save = useSaveCompositionGoal();
  const update = useUpdateCompositionGoal();
  const today = useToday();
  const ids = { metric: useId(), target: useId(), date: useId(), error: useId() };
  const firstWithData = free.find((m) => latestValue(measurements, m) !== null);
  const [metric, setMetric] = useState<GoalMetric | "">(goal?.metric ?? firstWithData ?? "");
  const [target, setTarget] = useState(metricInputValue(goal?.target));
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const latest = metric ? latestValue(measurements, metric) : null;
  // Na edição a partida é a gravada; na criação, a medição mais recente da métrica.
  const start = goal ? { value: goal.start_value, day: goal.start_day } : latest;
  const def = metric ? METRIC[metric] : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!today) return;
    const value = parseMetricInput(target);
    const found = goalFormErrors(metric, value, start?.value ?? null, targetDate, today);
    setErrors(found);
    if (found.length > 0 || !metric || value === null || !start) return;
    const rounded = Math.round(value * 100) / 100;
    if (goal) {
      // Com o alvo novo, a conclusão vale se a última medição já chegou lá.
      const reached = latest ? goalReached(goal.start_value, latest.value, rounded) : false;
      const achieved_on = reached ? (goal.achieved_on ?? latest!.day) : null;
      update.mutate({ id: goal.id, patch: { target: rounded, target_date: targetDate || null, achieved_on } });
    } else {
      save.mutate({
        id: crypto.randomUUID(),
        metric,
        target: rounded,
        target_date: targetDate || null,
        start_value: start.value,
        start_day: start.day,
      });
    }
    close();
  }

  const title = goal ? "Editar meta" : "Nova meta";
  return (
    <>
      <SheetHeader className="pr-12 text-left">
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>A partida é a medição mais recente da métrica; a data-alvo é opcional.</SheetDescription>
      </SheetHeader>
      <form aria-label={title} noValidate onSubmit={submit} className="space-y-4 px-4 pb-6">
        {goal ? (
          <p className="text-sm">
            Métrica: <span className="font-semibold">{METRIC[goal.metric].label}</span>
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={ids.metric}>Métrica</Label>
            <select
              id={ids.metric}
              value={metric}
              onChange={(e) => setMetric(e.target.value as GoalMetric)}
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {free.map((m) => {
                const has = latestValue(measurements, m) !== null;
                return (
                  <option key={m} value={m} disabled={!has}>
                    {METRIC[m].label}
                    {has ? "" : " (sem medição)"}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <p className="text-sm text-muted-foreground" data-testid="goal-start">
          {start && def ? (
            <>
              Partida: <span className="num font-semibold text-foreground">{metricText(start.value, def)}</span> em{" "}
              <span className="num">{formatDateBR(start.day)}</span>
            </>
          ) : (
            "Sem medição dessa métrica: registre uma medição antes de definir a meta."
          )}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={ids.target}>{def?.unit ? `Alvo (${def.unit})` : "Alvo"}</Label>
            <Input
              id={ids.target}
              inputMode="decimal"
              autoComplete="off"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-invalid={errors.length > 0 || undefined}
              aria-describedby={errors.length > 0 ? ids.error : undefined}
              className="num h-11 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.date}>Data-alvo (opcional)</Label>
            <Input
              id={ids.date}
              type="date"
              value={targetDate}
              min={today ?? undefined}
              onChange={(e) => setTargetDate(e.target.value)}
              className="num h-11 text-base"
            />
          </div>
        </div>

        {errors.length > 0 && (
          <div id={ids.error} role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
            <ul className="list-disc space-y-0.5 pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <Button type="submit" className="h-11 w-full font-semibold" disabled={!start}>
          <Save aria-hidden />
          {goal ? "Salvar alterações" : "Salvar meta"}
        </Button>
      </form>
    </>
  );
}

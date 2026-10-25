"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSaveFinanceBudget } from "../hooks";
import type { FinanceMonthData } from "../api";
import { financeBudgetSchema } from "../schemas/finance";
import { BRL, BUCKET_LABELS } from "../domain/finance";
export function FinanceBudget({ month, budget, actualIncome, spent, subSpent }: {
  month: string;
  budget: FinanceMonthData["budget"];
  actualIncome: number;
  spent: Record<string, number>;
  subSpent: Record<string, number>;
}) {
  const save = useSaveFinanceBudget();
  const [plannedIncome, setPlannedIncome] = useState(() => String(budget?.planned_income ?? ""));
  const [fixedPct, setFixedPct] = useState(String((budget?.fixed_pct ?? 0.5) * 100));
  const [freedomPct, setFreedomPct] = useState(String((budget?.freedom_pct ?? 0.2) * 100));
  const [variablePct, setVariablePct] = useState(String((budget?.variable_pct ?? 0.3) * 100));
  const [comfortPct, setComfortPct] = useState(String((budget?.comfort_pct ?? 0.5) * 100));
  const [pleasuresPct, setPleasuresPct] = useState(String((budget?.pleasures_pct ?? 0.2) * 100));
  const [knowledgePct, setKnowledgePct] = useState(String((budget?.knowledge_pct ?? 0.15) * 100));
  const [goalsPct, setGoalsPct] = useState(String((budget?.goals_pct ?? 0.15) * 100));
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
      month_start: month,
      planned_income: Number(plannedIncome || 0),
      fixed_pct: Number(fixedPct) / 100,
      freedom_pct: Number(freedomPct) / 100,
      variable_pct: Number(variablePct) / 100,
      comfort_pct: Number(comfortPct) / 100,
      pleasures_pct: Number(pleasuresPct) / 100,
      knowledge_pct: Number(knowledgePct) / 100,
      goals_pct: Number(goalsPct) / 100,
    };
    const parsed = financeBudgetSchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revise os valores do orÃ§amento.");
    setError(null);
    save.mutate({ id: budget?.id ?? crypto.randomUUID(), ...parsed.data });
  };

  const incomeForPlan = Number(plannedIncome) || budget?.planned_income || actualIncome;
  const buckets = [
    { key: "fixed", pct: Number(fixedPct) / 100, label: BUCKET_LABELS.fixed },
    { key: "freedom", pct: Number(freedomPct) / 100, label: BUCKET_LABELS.freedom },
    { key: "variable", pct: Number(variablePct) / 100, label: BUCKET_LABELS.variable },
  ];
  const subBuckets = [
    { key: "comfort", pct: Number(comfortPct) / 100, label: "Conforto" },
    { key: "pleasures", pct: Number(pleasuresPct) / 100, label: "Prazeres" },
    { key: "knowledge", pct: Number(knowledgePct) / 100, label: "Conhecimento" },
    { key: "goals", pct: Number(goalsPct) / 100, label: "Metas" },
  ];

  return (
    <section aria-labelledby="finance-budget-title" className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="num text-xs tracking-[0.18em] text-muted-foreground uppercase">Planeje antes de gastar</p>
          <h2 id="finance-budget-title" className="mt-1 text-lg font-semibold">OrÃ§amento do mÃªs</h2>
        </div>
        <p className="text-right text-xs text-muted-foreground">ReferÃªncia inicial 50 / 20 / 30<br />ajuste Ã s suas prioridades</p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(5rem,0.65fr))]">
          <NumberField label="Renda lÃ­quida planejada" value={plannedIncome} onChange={setPlannedIncome} step="0.01" min="0" placeholder="0,00" prefix="R$" />
          <NumberField label="Fixos %" value={fixedPct} onChange={setFixedPct} step="1" min="0" max="100" suffix="%" />
          <NumberField label="Reserva %" value={freedomPct} onChange={setFreedomPct} step="1" min="0" max="100" suffix="%" />
          <NumberField label="Eventuais %" value={variablePct} onChange={setVariablePct} step="1" min="0" max="100" suffix="%" />
        </div>

        <details className="rounded-xl border border-dashed px-3 py-2">
          <summary className="min-h-9 cursor-pointer content-center text-sm font-medium">Dividir os gastos eventuais</summary>
          <div className="grid grid-cols-2 gap-3 py-3 sm:grid-cols-4">
            <NumberField label="Conforto %" value={comfortPct} onChange={setComfortPct} step="1" min="0" max="100" suffix="%" />
            <NumberField label="Prazeres %" value={pleasuresPct} onChange={setPleasuresPct} step="1" min="0" max="100" suffix="%" />
            <NumberField label="Conhecimento %" value={knowledgePct} onChange={setKnowledgePct} step="1" min="0" max="100" suffix="%" />
            <NumberField label="Metas %" value={goalsPct} onChange={setGoalsPct} step="1" min="0" max="100" suffix="%" />
          </div>
        </details>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Entradas registradas neste mÃªs: <strong className="num text-foreground">{BRL.format(actualIncome)}</strong></p>
          <Button type="submit" variant="outline" className="h-10" disabled={save.isPending}>{save.isPending ? "Salvandoâ€¦" : "Salvar orÃ§amento"}</Button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        {buckets.map((bucket) => {
          const actual = spent[bucket.key] ?? 0;
          const planned = incomeForPlan * bucket.pct;
          const pct = planned > 0 ? Math.min(100, actual / planned * 100) : 0;
          return (
            <div key={bucket.key} className="min-w-0 rounded-xl bg-muted/50 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{bucket.label}</p>
                <span className="num shrink-0 text-xs text-muted-foreground">{Math.round(bucket.pct * 100)}%</span>
              </div>
              <p className="num mt-2 text-sm font-semibold">{BRL.format(actual)} <span className="font-normal text-muted-foreground">/ {BRL.format(planned)}</span></p>
              <div role="progressbar" aria-label={`${bucket.label} usado`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                <div className={`h-full rounded-full ${pct > 100 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Gastos eventuais por subcategoria">
        {subBuckets.map((bucket) => {
          const actual = subSpent[bucket.key] ?? 0;
          const planned = incomeForPlan * (Number(variablePct) / 100) * bucket.pct;
          const pct = planned > 0 ? Math.min(100, actual / planned * 100) : 0;
          return (
            <div key={bucket.key} className="min-w-0 rounded-xl border border-dashed p-3">
              <p className="truncate text-xs text-muted-foreground">{bucket.label} Â· {Math.round(bucket.pct * 100)}%</p>
              <p className="num mt-1 truncate text-sm font-semibold">{BRL.format(actual)} <span className="font-normal text-muted-foreground">/ {BRL.format(planned)}</span></p>
              <div role="progressbar" aria-label={`${bucket.label} usado`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${actual > planned ? "bg-destructive" : "bg-primary/70"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange, ...inputProps }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  const { prefix, suffix, ...props } = inputProps;
  const id = `finance-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block truncate text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex h-10 min-w-0 items-center rounded-md border border-input bg-background px-3 focus-within:ring-[3px] focus-within:ring-ring/40">
        {prefix && <span className="mr-2 shrink-0 text-sm text-muted-foreground">{prefix}</span>}
        <input id={id} type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm" {...props} />
        {suffix && <span className="ml-2 shrink-0 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

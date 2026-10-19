"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { formatKg, kgInputValue, parseDecimal, parseReps } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PreviousSet, SessionSet } from "../store";
import { PrBadge } from "./pr-badge";

/** Colunas: série · anterior · kg · reps · ✓ (mesmo grid no cabeçalho e nas linhas). */
export const SET_GRID = "grid grid-cols-[1.75rem_minmax(0,1fr)_4.75rem_4rem_2.75rem] items-center gap-2";

type SetRowProps = {
  index: number;
  set: SessionSet;
  previous: PreviousSet | undefined;
  exerciseName: string;
  onChange: (patch: { weightKg?: number | null; reps?: number | null }) => void;
  onToggle: () => void;
};

/**
 * Uma série: anterior · carga · reps · ✓.
 * Os campos vazios mostram o anterior como dica; tocar em ✓ sem digitar usa o anterior.
 */
export function SetRow({ index, set, previous, exerciseName, onChange, onToggle }: SetRowProps) {
  const n = index + 1;
  const prevText = previous ? `${formatKg(previous.weightKg)} × ${previous.reps}` : "—";

  return (
    <li data-testid="set-row" data-done={set.done || undefined}>
      <div
        className={cn(
          SET_GRID,
          "rounded-lg px-1 py-1 transition-colors",
          set.done && "bg-primary/10 dark:bg-primary/20",
        )}
      >
        <span className="num text-center text-sm font-semibold text-muted-foreground" aria-hidden>
          {n}
        </span>
        <span className="num truncate text-sm text-muted-foreground" data-testid="previous">
          <span className="sr-only">Anterior: </span>
          {prevText}
        </span>
        <NumberField
          label={`Carga da série ${n} de ${exerciseName} (kg)`}
          value={set.weightKg}
          placeholder={previous ? kgInputValue(previous.weightKg) : "kg"}
          inputMode="decimal"
          toText={kgInputValue}
          parse={parseDecimal}
          onChange={(weightKg) => onChange({ weightKg })}
        />
        <NumberField
          label={`Repetições da série ${n} de ${exerciseName}`}
          value={set.reps}
          placeholder={previous ? String(previous.reps) : "reps"}
          inputMode="numeric"
          toText={(v) => (v === null ? "" : String(v))}
          parse={parseReps}
          onChange={(reps) => onChange({ reps })}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={set.done}
          aria-label={set.done ? `Desfazer série ${n} de ${exerciseName}` : `Concluir série ${n} de ${exerciseName}`}
          className={cn(
            "flex size-11 items-center justify-center rounded-lg border-2 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
            set.done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:border-primary hover:text-primary-text",
          )}
        >
          <Check aria-hidden className="size-5" strokeWidth={set.done ? 3 : 2} />
        </button>
      </div>
      {set.prs.length > 0 && <PrBadge kinds={set.prs} className="mt-1 ml-9" />}
    </li>
  );
}

type NumberFieldProps = {
  label: string;
  value: number | null;
  placeholder: string;
  inputMode: "decimal" | "numeric";
  toText: (value: number | null) => string;
  parse: (text: string) => number | null;
  onChange: (value: number | null) => void;
};

/** Enquanto digita, guarda o texto (ex.: "52,"); fora do foco, mostra o valor do store. */
function NumberField({ label, value, placeholder, inputMode, toText, parse, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== "" && parse(draft) === null;

  return (
    <input
      type="text"
      inputMode={inputMode}
      enterKeyHint="next"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      value={draft ?? toText(value)}
      onFocus={(e) => {
        setDraft(toText(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parse(e.target.value));
      }}
      onBlur={() => setDraft(null)}
      className="num h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-center text-base font-medium outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
    />
  );
}

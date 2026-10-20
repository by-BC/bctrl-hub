"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { FIELDS, type ExerciseType, type SetField } from "@/lib/domain/exercise-types";
import {
  durationInputValue,
  formatSet,
  kgInputValue,
  kmInputValue,
  parseDecimal,
  parseDuration,
  parseKm,
  parseReps,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PreviousSet, SessionSet, SetPatch } from "../store";
import { PrBadge } from "./pr-badge";

/**
 * Colunas: série · anterior · campos do tipo · ✓ (mesmo grid no cabeçalho e nas linhas).
 * Classes literais: o Tailwind só gera o que aparece escrito no código.
 */
const GRID_BY_FIELDS = {
  1: "grid grid-cols-[2.75rem_minmax(0,1fr)_6.5rem_2.75rem] items-center gap-2",
  2: "grid grid-cols-[2.75rem_minmax(0,1fr)_4.75rem_4rem_2.75rem] items-center gap-2",
} as const;

export const setGrid = (type: ExerciseType) => GRID_BY_FIELDS[FIELDS[type].length as 1 | 2];

/** Rótulo curto do campo no cabeçalho (carga extra com "+", assistência com "−"). */
export function fieldHeader(field: SetField, type: ExerciseType) {
  if (field === "weight") return type === "bodyweight_reps" ? "+kg" : type === "bodyweight_assisted_reps" ? "−kg" : "kg";
  if (field === "reps") return "Reps";
  if (field === "distance") return "km";
  return "Tempo";
}

type FieldSpec = {
  key: keyof SetPatch;
  label: (n: number, exercise: string) => string;
  placeholder: string;
  inputMode: "decimal" | "numeric" | "text";
  toText: (value: number | null) => string;
  parse: (text: string) => number | null;
};

const FIELD_SPECS: Record<SetField, FieldSpec> = {
  weight: {
    key: "weightKg",
    label: (n, e) => `Carga da série ${n} de ${e} (kg)`,
    placeholder: "kg",
    inputMode: "decimal",
    toText: kgInputValue,
    parse: parseDecimal,
  },
  reps: {
    key: "reps",
    label: (n, e) => `Repetições da série ${n} de ${e}`,
    placeholder: "reps",
    inputMode: "numeric",
    toText: (v) => (v === null ? "" : String(v)),
    parse: parseReps,
  },
  distance: {
    key: "distanceM",
    label: (n, e) => `Distância da série ${n} de ${e} (km)`,
    placeholder: "km",
    inputMode: "decimal",
    toText: kmInputValue,
    parse: parseKm,
  },
  duration: {
    key: "durationS",
    label: (n, e) => `Duração da série ${n} de ${e} (minutos:segundos)`,
    placeholder: "m:ss",
    // Teclado de texto: o numérico do iPhone não tem ":".
    inputMode: "text",
    toText: durationInputValue,
    parse: parseDuration,
  },
};

type SetRowProps = {
  index: number;
  set: SessionSet;
  previous: PreviousSet | undefined;
  exerciseName: string;
  exerciseType: ExerciseType;
  onChange: (patch: SetPatch) => void;
  onToggle: () => void;
  onToggleWarmup: () => void;
};

/**
 * Uma série: tipo (número ou "A" de aquecimento) · anterior · campos do tipo · ✓.
 * Os campos vazios mostram o anterior como dica; tocar em ✓ sem digitar usa o anterior.
 */
export function SetRow({ index, set, previous, exerciseName, exerciseType, onChange, onToggle, onToggleWarmup }: SetRowProps) {
  const n = index + 1;
  const warmup = set.setType === "warmup";
  const prevText = previous ? formatSet(previous, exerciseType, { unit: false }) : "—";

  return (
    <li data-testid="set-row" data-done={set.done || undefined} data-set-type={set.setType}>
      <div
        className={cn(
          setGrid(exerciseType),
          "rounded-lg px-1 py-1 transition-colors",
          set.done && "bg-primary/10 dark:bg-primary/20",
        )}
      >
        <button
          type="button"
          onClick={onToggleWarmup}
          aria-pressed={warmup}
          aria-label={
            warmup
              ? `Desmarcar aquecimento da série ${n} de ${exerciseName}`
              : `Marcar série ${n} de ${exerciseName} como aquecimento`
          }
          title={warmup ? "Aquecimento (toque para desmarcar)" : "Toque para marcar como aquecimento"}
          className={cn(
            "num flex size-11 items-center justify-center rounded-lg text-sm font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
            warmup ? "bg-highlight/15 text-highlight-text" : "text-muted-foreground hover:bg-accent",
          )}
        >
          {warmup ? "A" : n}
        </button>
        <span className="num truncate text-sm text-muted-foreground" data-testid="previous">
          <span className="sr-only">Anterior: </span>
          {prevText}
        </span>
        {FIELDS[exerciseType].map((field) => {
          const spec = FIELD_SPECS[field];
          const prev = previous?.[spec.key] ?? null;
          return (
            <NumberField
              key={field}
              label={spec.label(n, exerciseName)}
              value={set[spec.key]}
              placeholder={prev !== null ? spec.toText(prev) : spec.placeholder}
              inputMode={spec.inputMode}
              toText={spec.toText}
              parse={spec.parse}
              onChange={(value) => onChange({ [spec.key]: value })}
            />
          );
        })}
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
      {(warmup || set.prs.length > 0) && (
        <div className="mt-1 ml-[3.25rem] flex flex-wrap gap-1">
          {warmup && <WarmupBadge />}
          <PrBadge kinds={set.prs} />
        </div>
      )}
    </li>
  );
}

/** Selo de aquecimento: texto (não depende só da cor). */
export function WarmupBadge({ className }: { className?: string }) {
  return (
    <span
      data-testid="warmup-badge"
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground",
        className,
      )}
    >
      Aquecimento · não conta para recordes
    </span>
  );
}

type NumberFieldProps = {
  label: string;
  value: number | null;
  placeholder: string;
  inputMode: "decimal" | "numeric" | "text";
  toText: (value: number | null) => string;
  parse: (text: string) => number | null;
  onChange: (value: number | null) => void;
};

/** Enquanto digita, guarda o texto (ex.: "52," ou "1:"); fora do foco, mostra o valor do store. */
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

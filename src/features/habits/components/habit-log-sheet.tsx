"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CARDIO_TYPES, cardioLabel, type CardioType } from "@/features/habits/domain/habits";
import { weekDays } from "@/lib/domain/week";
import { formatDay, formatKg } from "@/lib/format";
import { cardioLogFormSchema, quantityLogFormSchema } from "@/features/habits/schemas/habit";
import { cn } from "@/lib/utils";
import type { Habit, HabitLog } from "../api";
import { logRange, newHabitLog, useLogHabit, useUndoHabitLog } from "../hooks";

type HabitLogSheetProps = {
  habit: Habit | null;
  logs: HabitLog[];
  week: string;
  today: string;
  onOpenChange: (open: boolean) => void;
};

/**
 * Registrar um hábito: cardio (tipo, minutos, km e kcal opcionais), quantidade (valor) ou
 * check em outro dia. Lista os registros da semana, cada um com "Remover".
 */
export function HabitLogSheet({ habit, logs, week, today, onOpenChange }: HabitLogSheetProps) {
  return (
    <Sheet open={!!habit} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl">
        {habit && (
          <LogSheetBody
            key={habit.id}
            habit={habit}
            logs={logs}
            week={week}
            today={today}
            close={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function LogSheetBody({
  habit,
  logs,
  week,
  today,
  close,
}: {
  habit: Habit;
  logs: HabitLog[];
  week: string;
  today: string;
  close: () => void;
}) {
  const logHabit = useLogHabit();
  const undo = useUndoHabitLog();
  const days = new Set(weekDays(week));
  const weekLogs = logs.filter((l) => days.has(l.day)).sort((a, b) => b.day.localeCompare(a.day));

  const save = (log: ReturnType<typeof newHabitLog>, message: string) => {
    logHabit.mutate({ week, log });
    toast.success(message, { action: { label: "Desfazer", onClick: () => undo.mutate({ week, ids: [log.id] }) } });
    close();
  };

  return (
    <>
      <SheetHeader className="pr-12 text-left">
        <SheetTitle>{habit.name}</SheetTitle>
        <SheetDescription>
          {habit.kind === "cardio"
            ? "Tipo, minutos e, se quiser, distância e calorias. A meta soma os minutos."
            : habit.kind === "quantity"
              ? `Quanto você fez${habit.unit ? ` (${habit.unit})` : ""}.`
              : "Marque um dia que ficou para trás."}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        {habit.kind === "cardio" ? (
          <CardioForm
            today={today}
            onSubmit={(day, fields) =>
              save(newHabitLog(habit.id, day, fields), `${habit.name}: ${fields.value} min registrados`)
            }
          />
        ) : habit.kind === "quantity" ? (
          <QuantityForm
            habit={habit}
            today={today}
            onSubmit={(day, value) =>
              save(newHabitLog(habit.id, day, { value }), `${habit.name}: ${formatKg(value)} ${habit.unit ?? ""} registrados`)
            }
          />
        ) : (
          <CheckForm
            today={today}
            doneDays={new Set(logs.map((l) => l.day))}
            onSubmit={(day) => save(newHabitLog(habit.id, day), `${habit.name}: ${formatDay(day)} marcado`)}
          />
        )}

        <section aria-labelledby="registros-semana" className="space-y-2">
          <h3 id="registros-semana" className="text-sm font-semibold">
            Registros desta semana
          </h3>
          {weekLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro nesta semana.</p>
          ) : (
            <ul className="divide-y rounded-xl border" aria-label="Registros desta semana">
              {weekLogs.map((log) => (
                <li key={log.id} className="flex items-center gap-2 py-1 pr-1 pl-3" data-testid="habit-log">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block first-letter:uppercase">{formatDay(log.day)}</span>
                    <span className="num block text-muted-foreground">{describeLog(habit, log)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover registro de ${formatDay(log.day)}`}
                    onClick={() => undo.mutate({ week, ids: [log.id] })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function describeLog(habit: Habit, log: HabitLog) {
  if (habit.kind === "check") return "Feito";
  const parts = [`${formatKg(log.value)} ${habit.kind === "cardio" ? "min" : (habit.unit ?? "")}`.trim()];
  if (habit.kind === "cardio") {
    parts.unshift(cardioLabel(log.cardio_type));
    if (log.distance_km != null) parts.push(`${formatKg(log.distance_km)} km`);
    if (log.kcal != null) parts.push(`${formatKg(log.kcal)} kcal`);
  }
  return parts.join(" · ");
}

function DayField({ id, value, today, onChange }: { id: string; value: string; today: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Dia</Label>
      <Input
        id={id}
        type="date"
        value={value}
        min={logRange(today).from}
        max={today}
        required
        className="num h-11 text-base"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Dia válido: dentro do período lido e não no futuro. */
function checkDay(day: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "Escolha o dia.";
  if (day > today) return "Não dá para registrar um dia futuro.";
  if (day < logRange(today).from) return "Dia antigo demais.";
  return null;
}

function CardioForm({
  today,
  onSubmit,
}: {
  today: string;
  onSubmit: (day: string, fields: { value: number; cardio_type: CardioType; distance_km: number | null; kcal: number | null }) => void;
}) {
  const ids = { day: useId(), min: useId(), km: useId(), kcal: useId(), error: useId(), type: useId() };
  const [day, setDay] = useState(today);
  const [type, setType] = useState<CardioType>("treadmill");
  const [min, setMin] = useState("");
  const [km, setKm] = useState("");
  const [kcal, setKcal] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      aria-label="Registrar cardio"
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const dayError = checkDay(day, today);
        if (dayError) return setError(dayError);
        const parsed = cardioLogFormSchema.safeParse({ cardio_type: type, value: min, distance_km: km, kcal });
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
        onSubmit(day, { ...parsed.data, cardio_type: parsed.data.cardio_type as CardioType });
      }}
    >
      <fieldset className="space-y-1.5">
        <legend id={ids.type} className="mb-1.5 text-sm font-medium">
          Tipo
        </legend>
        <div role="radiogroup" aria-labelledby={ids.type} className="grid grid-cols-3 gap-2">
          {CARDIO_TYPES.map((t) => {
            const selected = t.value === type;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setType(t.value)}
                className={cn(
                  "min-h-11 rounded-lg border px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        <NumberInput id={ids.min} label="Minutos" value={min} onChange={setMin} inputMode="numeric" errorId={error ? ids.error : undefined} />
        <NumberInput id={ids.km} label="Km (opcional)" value={km} onChange={setKm} inputMode="decimal" />
        <NumberInput id={ids.kcal} label="Kcal (opcional)" value={kcal} onChange={setKcal} inputMode="numeric" />
      </div>
      <DayField id={ids.day} value={day} today={today} onChange={setDay} />
      <FieldError id={ids.error} message={error} />
      <Button type="submit" className="h-11 w-full font-semibold">
        <Plus aria-hidden />
        Registrar cardio
      </Button>
    </form>
  );
}

function QuantityForm({ habit, today, onSubmit }: { habit: Habit; today: string; onSubmit: (day: string, value: number) => void }) {
  const ids = { day: useId(), value: useId(), error: useId() };
  const [day, setDay] = useState(today);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label={`Registrar ${habit.name}`}
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const dayError = checkDay(day, today);
        if (dayError) return setError(dayError);
        const parsed = quantityLogFormSchema.safeParse({ value });
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Valor inválido.");
        onSubmit(day, parsed.data.value);
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          id={ids.value}
          label={habit.unit ? `Quantidade (${habit.unit})` : "Quantidade"}
          value={value}
          onChange={setValue}
          inputMode="decimal"
          errorId={error ? ids.error : undefined}
        />
        <DayField id={ids.day} value={day} today={today} onChange={setDay} />
      </div>
      <FieldError id={ids.error} message={error} />
      <Button type="submit" className="h-11 w-full font-semibold">
        <Plus aria-hidden />
        Registrar
      </Button>
    </form>
  );
}

function CheckForm({ today, doneDays, onSubmit }: { today: string; doneDays: Set<string>; onSubmit: (day: string) => void }) {
  const ids = { day: useId(), error: useId() };
  const [day, setDay] = useState(today);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-label="Marcar outro dia"
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const dayError = checkDay(day, today) ?? (doneDays.has(day) ? "Esse dia já está marcado." : null);
        if (dayError) return setError(dayError);
        onSubmit(day);
      }}
    >
      <DayField id={ids.day} value={day} today={today} onChange={setDay} />
      <FieldError id={ids.error} message={error} />
      <Button type="submit" className="h-11 w-full font-semibold">
        <Plus aria-hidden />
        Marcar dia
      </Button>
    </form>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  inputMode,
  errorId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode: "numeric" | "decimal";
  errorId?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        autoComplete="off"
        className="num h-11 text-base"
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

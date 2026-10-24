"use client";

import { Archive, Lock, Save, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Segmented } from "@/features/progress/components/chart-card";
import type { HabitKind, HabitPeriod } from "@/features/habits/domain/habits";
import { kgInputValue } from "@/lib/format";
import { habitFormSchema } from "@/features/habits/schemas/habit";
import type { Habit } from "../api";
import { useCreateHabit, useDeleteHabit, useUpdateHabit } from "../hooks";

const KINDS = [
  { value: "check", label: "Marcar" },
  { value: "quantity", label: "Quantidade" },
  { value: "cardio", label: "Cardio" },
] as const;

const PERIODS = [
  { value: "week", label: "Por semana" },
  { value: "day", label: "Por dia" },
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

type HabitFormSheetProps = {
  open: boolean;
  /** `null` cria um hábito novo. */
  habit: Habit | null;
  onOpenChange: (open: boolean) => void;
};

/** Criar ou editar hábito (nome, tipo, período, meta, unidade); arquivar e excluir os customizados. */
export function HabitFormSheet({ open, habit, onOpenChange }: HabitFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl">
        {open && <FormBody key={habit?.id ?? "novo"} habit={habit} close={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function FormBody({ habit, close }: { habit: Habit | null; close: () => void }) {
  const create = useCreateHabit();
  const update = useUpdateHabit();
  const remove = useDeleteHabit();
  const ids = { name: useId(), target: useId(), unit: useId(), error: useId() };
  const isSystem = !!habit?.system_key;

  const [name, setName] = useState(habit?.name ?? "");
  const [kind, setKind] = useState<HabitKind>((habit?.kind as HabitKind) ?? "check");
  const [period, setPeriod] = useState<HabitPeriod>((habit?.period as HabitPeriod) ?? "week");
  const [target, setTarget] = useState(habit ? kgInputValue(habit.target) : "3");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fixedTarget = kind === "check" && period === "day";
  const targetLabel =
    kind === "check"
      ? "Dias por semana"
      : `Meta ${period === "day" ? "por dia" : "por semana"}${kind === "cardio" ? " (min)" : unit ? ` (${unit})` : ""}`;

  const changeKindOrPeriod = (nextKind: HabitKind, nextPeriod: HabitPeriod) => {
    setKind(nextKind);
    setPeriod(nextPeriod);
    if (nextKind === "check" && nextPeriod === "day") setTarget("1");
    setError(null);
  };

  return (
    <>
      <SheetHeader className="pr-12 text-left">
        <SheetTitle>{habit ? `Editar ${habit.name}` : "Novo hábito"}</SheetTitle>
        <SheetDescription>
          {isSystem
            ? "Hábito do sistema: dá para editar, mas não excluir."
            : "Marcar conta dias feitos; Quantidade e Cardio somam o valor de cada registro."}
        </SheetDescription>
      </SheetHeader>

      <form
        aria-label={habit ? `Editar ${habit.name}` : "Novo hábito"}
        className="space-y-4 px-4 pb-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = habitFormSchema.safeParse({ name, kind, period, target: fixedTarget ? "1" : target, unit });
          if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
          const row = parsed.data;
          if (habit) {
            // Hábito do sistema mantém o tipo (o resumo da semana depende dele).
            const { kind: newKind, ...rest } = row;
            update.mutate({ id: habit.id, patch: isSystem ? rest : { ...rest, kind: newKind } });
          } else {
            create.mutate({ id: crypto.randomUUID(), ...row });
          }
          close();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor={ids.name}>Nome</Label>
          <Input
            id={ids.name}
            value={name}
            maxLength={120}
            autoComplete="off"
            placeholder="Ex.: Ler"
            className="h-11 text-base"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Tipo</p>
          {isSystem ? (
            <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <Lock aria-hidden className="size-4" />
              {KIND_LABEL[kind]} (fixo nos hábitos do sistema)
            </p>
          ) : (
            <Segmented label="Tipo" options={KINDS} value={kind} onChange={(k) => changeKindOrPeriod(k, period)} />
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Período</p>
          <Segmented label="Período" options={PERIODS} value={period} onChange={(p) => changeKindOrPeriod(kind, p)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {fixedTarget ? (
            <p className="col-span-2 text-sm text-muted-foreground">Meta: feito 1 vez por dia.</p>
          ) : (
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={ids.target} className="text-xs">
                {targetLabel}
              </Label>
              <Input
                id={ids.target}
                value={target}
                inputMode="decimal"
                autoComplete="off"
                className="num h-11 text-base"
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
          )}
          {kind === "quantity" && (
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={ids.unit} className="text-xs">
                Unidade (opcional)
              </Label>
              <Input
                id={ids.unit}
                value={unit}
                maxLength={20}
                autoComplete="off"
                placeholder="Ex.: páginas"
                className="h-11 text-base"
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          )}
        </div>

        {error && (
          <p id={ids.error} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="h-11 w-full font-semibold">
          <Save aria-hidden />
          {habit ? "Salvar" : "Criar hábito"}
        </Button>

        {habit && !isSystem && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() => {
                update.mutate({ id: habit.id, patch: { archived_at: new Date().toISOString() } });
                close();
              }}
            >
              <Archive aria-hidden />
              Arquivar
            </Button>
            <Button type="button" variant="outline" className="h-11 flex-1 text-destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 aria-hidden />
              Excluir
            </Button>
          </div>
        )}
      </form>

      {habit && !isSystem && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Excluir “${habit.name}”?`}
          description="O hábito e todos os registros dele somem. Se quiser só tirar da semana, arquive."
          confirmLabel="Excluir hábito"
          destructive
          onConfirm={() => {
            remove.mutate(habit.id);
            close();
          }}
        />
      )}
    </>
  );
}

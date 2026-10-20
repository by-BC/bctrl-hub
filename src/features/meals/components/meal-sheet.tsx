"use client";

import { Check, ChevronDown, CircleSlash2, Undo2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatMealTime, mealStatus } from "@/lib/domain/meals";
import { NOTE_MAX, offPlanNoteSchema, type MealItem } from "@/lib/schemas/meal";
import { OptionMacros } from "@/features/nutrition/components/macro-summary";
import type { Meal, MealLog, MealOption } from "../api";
import { buildMealLog, useLogMeal, useUnlogMeal } from "../hooks";
import { MealStatusBadge } from "./meal-status";

type MealSheetProps = {
  day: string;
  meal: Meal | null;
  log: MealLog | undefined;
  onOpenChange: (open: boolean) => void;
};

/**
 * Opções da refeição: tocar em "Comi a Opção N" marca como feita (2º toque) e fecha.
 * Também registra "fora do plano" com nota e desmarca.
 */
export function MealSheet({ day, meal, log, onOpenChange }: MealSheetProps) {
  return (
    <Sheet open={!!meal} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl">
        {meal && <MealSheetBody key={meal.id} day={day} meal={meal} log={log} close={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function MealSheetBody({ day, meal, log, close }: { day: string; meal: Meal; log: MealLog | undefined; close: () => void }) {
  const logMeal = useLogMeal();
  const unlogMeal = useUnlogMeal();
  const time = formatMealTime(meal.time);
  const base = { day, meal_id: meal.id };

  const choose = (option: MealOption) => {
    if (log && !log.off_plan && log.option_id === option.id) return close();
    logMeal.mutate(buildMealLog(log, base, { option_id: option.id }));
    close();
  };

  return (
    <>
      <SheetHeader className="pr-12 text-left">
        <SheetTitle>{meal.name}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="num">{time ?? "Após o treino"}</span>
          <MealStatusBadge status={mealStatus(log)} />
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-3 px-4">
        {meal.meal_options.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Esta refeição ainda não tem opções. Cadastre no plano alimentar.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Opções">
            {meal.meal_options.map((option, index) => (
              <li key={option.id}>
                <OptionCard
                  option={option}
                  index={index}
                  selected={!!log && !log.off_plan && log.option_id === option.id}
                  onChoose={() => choose(option)}
                />
              </li>
            ))}
          </ul>
        )}

        <OffPlanForm
          log={log}
          onSubmit={(note) => {
            logMeal.mutate(buildMealLog(log, base, { off_plan: true, note }));
            close();
          }}
        />
      </div>

      <SheetFooter className="gap-2">
        {log && (
          <Button
            variant="ghost"
            className="h-11"
            onClick={() => {
              unlogMeal.mutate(base);
              close();
            }}
          >
            <Undo2 aria-hidden />
            Desmarcar refeição
          </Button>
        )}
      </SheetFooter>
    </>
  );
}

export const optionLabel = (index: number) => `Opção ${index + 1}`;

function OptionCard({
  option,
  index,
  selected,
  onChoose,
}: {
  option: MealOption;
  index: number;
  selected: boolean;
  onChoose: () => void;
}) {
  const label = optionLabel(index);
  return (
    <article
      aria-label={`${label}: ${option.title}`}
      className={`space-y-3 rounded-xl border bg-card p-4 ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <header>
        <p className="num text-xs tracking-[0.15em] text-muted-foreground uppercase">{label}</p>
        <h3 className="font-semibold">{option.title}</h3>
        <OptionMacros items={option.items} className="mt-1" />
      </header>
      {option.items.length > 0 && (
        <ul className="space-y-1">
          {option.items.map((item, i) => (
            <ItemRow key={i} item={item} />
          ))}
        </ul>
      )}
      <Button
        className="h-11 w-full font-semibold"
        variant={selected ? "secondary" : "default"}
        aria-label={selected ? `${label} escolhida` : `Comi a ${label}: ${option.title}`}
        onClick={onChoose}
      >
        <Check aria-hidden />
        {selected ? `${label} escolhida` : `Comi a ${label}`}
      </Button>
    </article>
  );
}

function ItemRow({ item }: { item: MealItem }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">{item.name}</span>
        {item.qty && <span className="num shrink-0 text-muted-foreground">{item.qty}</span>}
      </div>
      {item.subs.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="-ml-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary-text outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <ChevronDown aria-hidden className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Ocultar" : "Ver"} {item.subs.length === 1 ? "substituição" : `${item.subs.length} substituições`}
            <span className="sr-only"> de {item.name}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mb-1 space-y-0.5 border-l-2 pl-3 text-muted-foreground">
              {item.subs.map((sub, i) => (
                <li key={i}>ou {sub}</li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </li>
  );
}

function OffPlanForm({ log, onSubmit }: { log: MealLog | undefined; onSubmit: (note: string | null) => void }) {
  const ids = { note: useId(), error: useId() };
  const [note, setNote] = useState(log?.off_plan ? (log.note ?? "") : "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      aria-label="Fora do plano"
      className="space-y-2 rounded-xl border border-dashed p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = offPlanNoteSchema.safeParse(note);
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Nota inválida.");
        onSubmit(parsed.data);
      }}
    >
      <Label htmlFor={ids.note}>Comeu outra coisa? Anote (opcional)</Label>
      <Textarea
        id={ids.note}
        value={note}
        rows={2}
        maxLength={NOTE_MAX}
        placeholder="Ex.: pizza no aniversário"
        className="min-h-11 text-base"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ids.error : undefined}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && (
        <p id={ids.error} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="h-11 w-full">
        <CircleSlash2 aria-hidden />
        {log?.off_plan ? "Salvar fora do plano" : "Marcar fora do plano"}
      </Button>
    </form>
  );
}

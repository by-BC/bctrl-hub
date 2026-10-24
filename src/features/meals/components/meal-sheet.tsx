"use client";

import { Check, ChevronDown, CircleSlash2, Plus, Trash2, Undo2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatMealTime, mealStatus, selectedMealItems } from "@/features/meals/domain/meals";
import { NOTE_MAX, offPlanNoteSchema, type MealItem } from "@/features/meals/schemas/meal";
import { formatMacros, OptionMacros } from "@/features/nutrition/components/macro-summary";
import { OffPlanSheet } from "@/features/nutrition/components/off-plan-sheet";
import { dayTotals, foodSnapshot, snapshotMacros } from "@/features/nutrition/domain/nutrition";
import type { Meal, MealLog, MealOption, OffPlanItem } from "../api";
import {
  buildMealLog,
  buildOffPlanAdd,
  useAddOffPlanItem,
  useLogMeal,
  useOffPlanItems,
  useRemoveOffPlanItem,
  useUnlogMeal,
} from "../hooks";
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

  const choose = (option: MealOption, selectedItemIndices: number[] | null) => {
    const current = log?.selected_item_indices ?? null;
    const sameSelection =
      current === selectedItemIndices ||
      (current !== null &&
        selectedItemIndices !== null &&
        current.length === selectedItemIndices.length &&
        current.every((value, index) => value === selectedItemIndices[index]));
    if (log && !log.off_plan && log.option_id === option.id && sameSelection) return close();
    logMeal.mutate(
      buildMealLog(log, base, { option_id: option.id, selected_item_indices: selectedItemIndices }),
    );
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
          <>
            <p className="text-sm text-muted-foreground">
              Marque apenas os alimentos que comeu. Sem marcar nenhum, o botão registra a opção inteira.
            </p>
            <ul className="space-y-3" aria-label="Opções">
              {meal.meal_options.map((option, index) => (
                <li key={option.id}>
                  <OptionCard
                    option={option}
                    index={index}
                    selected={!!log && !log.off_plan && log.option_id === option.id}
                    selectedItemIndices={
                      !!log && !log.off_plan && log.option_id === option.id ? log.selected_item_indices : undefined
                    }
                    onChoose={(indices) => choose(option, indices)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        <OffPlanItems day={day} meal={meal} log={log} />

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

function normalizeSelection(indices: readonly number[] | null | undefined, total: number): number[] | null {
  if (indices == null) return null;
  const valid = [...new Set(indices.filter((value) => Number.isInteger(value) && value >= 0 && value < total))].sort(
    (a, b) => a - b,
  );
  return valid.length === total ? null : valid;
}

function OptionCard({
  option,
  index,
  selected,
  selectedItemIndices,
  onChoose,
}: {
  option: MealOption;
  index: number;
  selected: boolean;
  selectedItemIndices: number[] | null | undefined;
  onChoose: (selectedItemIndices: number[] | null) => void;
}) {
  const label = optionLabel(index);
  const inputId = useId();
  const all = option.items.map((_item, itemIndex) => itemIndex);
  const total = option.items.length;
  const current = normalizeSelection(selectedItemIndices, total);
  const [checked, setChecked] = useState<number[]>(selected ? (current ?? all) : []);
  const partial = checked.length > 0 && checked.length < total;
  const displayedItems = checked.length > 0 ? selectedMealItems(option.items, checked) : option.items;
  const selection = checked.length === total ? null : checked;
  const unchanged =
    selected &&
    (current === selection ||
      (current !== null &&
        selection !== null &&
        current.length === selection.length &&
        current.every((value, itemIndex) => value === selection[itemIndex])));
  const buttonLabel = unchanged
    ? `${label} escolhida`
    : partial
      ? `Salvar ${checked.length} de ${total} itens da ${label}`
      : `Comi a ${label}: ${option.title}`;

  const toggle = (itemIndex: number, value: boolean) =>
    setChecked((currentIndices) =>
      value
        ? [...new Set([...currentIndices, itemIndex])].sort((a, b) => a - b)
        : currentIndices.filter((value) => value !== itemIndex),
    );

  return (
    <article
      aria-label={`${label}: ${option.title}`}
      className={`space-y-3 rounded-xl border bg-card p-4 ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <header>
        <p className="num text-xs tracking-[0.15em] text-muted-foreground uppercase">{label}</p>
        <h3 className="font-semibold">{option.title}</h3>
        <OptionMacros items={displayedItems} className="mt-1" />
      </header>
      {option.items.length > 0 && (
        <ul className="space-y-2" aria-label={`Alimentos da ${label}`}>
          {option.items.map((item, i) => (
            <ItemRow
              key={i}
              id={`${inputId}-${i}`}
              item={item}
              checked={checked.includes(i)}
              onCheckedChange={(value) => toggle(i, value)}
            />
          ))}
        </ul>
      )}
      <Button
        className="h-11 w-full font-semibold"
        variant={selected ? "secondary" : "default"}
        aria-label={buttonLabel}
        disabled={selected && checked.length === 0 && total > 0}
        onClick={() => onChoose(!selected && checked.length === 0 ? null : selection)}
      >
        <Check aria-hidden />
        {unchanged
          ? `${label} escolhida`
          : partial
            ? `Salvar ${checked.length} de ${total} itens`
            : `Comi a ${label}`}
      </Button>
      {selected && checked.length === 0 && total > 0 && (
        <p className="text-xs text-muted-foreground">Selecione pelo menos um item ou desmarque a refeição.</p>
      )}
    </article>
  );
}

function ItemRow({
  id,
  item,
  checked,
  onCheckedChange,
}: {
  id: string;
  item: MealItem;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border bg-background/50 px-3 py-2 text-sm">
      <div className="flex min-h-8 items-center gap-3">
        <Checkbox
          id={id}
          checked={checked}
          aria-label={`Comi ${item.name}`}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-3 font-normal">
          <span className="min-w-0">{item.name}</span>
          {item.qty && <span className="num shrink-0 text-muted-foreground">{item.qty}</span>}
        </Label>
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

const gramsFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Complementos da refeição (snapshot gravado): alimentos consumidos além da opção planejada.
 */
function OffPlanItems({ day, meal, log }: { day: string; meal: Meal; log: MealLog | undefined }) {
  const [adding, setAdding] = useState(false);
  const { data } = useOffPlanItems(day);
  const add = useAddOffPlanItem();
  const remove = useRemoveOffPlanItem();
  const items: OffPlanItem[] = log ? (data ?? []).filter((i) => i.meal_log_id === log.id) : [];
  const total = dayTotals({ options: [], offPlan: items.map(snapshotMacros) });

  return (
    <section aria-labelledby={`complementos-${meal.id}`} className="space-y-2 rounded-xl border border-dashed p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`complementos-${meal.id}`} className="text-sm font-semibold">
          Complementos da refeição
        </h3>
        {items.length > 0 && (
          <span className="num text-xs text-muted-foreground" data-testid="off-plan-total">
            {formatMacros(total)}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="divide-y" aria-label="Complementos da refeição">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-1" data-testid="off-plan-item">
              <span className="min-w-0 flex-1 text-sm">
                <span className="block break-words">{item.name}</span>
                <span className="num block text-xs text-muted-foreground">
                  {gramsFmt.format(item.grams)} g · {formatMacros(snapshotMacros(item))}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Remover ${item.name}`}
                onClick={() => remove.mutate({ day, id: item.id })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setAdding(true)}>
        <Plus aria-hidden />
        Adicionar complemento
      </Button>
      <OffPlanSheet
        open={adding}
        onOpenChange={setAdding}
        mealName={meal.name}
        onAdd={(food, grams) =>
          add.mutate(
            buildOffPlanAdd(log, { day, meal_id: meal.id }, { food_id: food.id, name: food.name, grams, ...foodSnapshot(food, grams) }),
          )
        }
      />
    </section>
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

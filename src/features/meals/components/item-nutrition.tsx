"use client";

import { ChevronDown, CircleAlert, Leaf, Utensils } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FoodPicker } from "@/features/nutrition/components/food-picker";
import { formatMacros } from "@/features/nutrition/components/macro-summary";
import { parseDecimal } from "@/lib/format";
import {
  isFreeItem,
  MACRO_KEYS,
  normalizeFoodName,
  parseQty,
  planItemMacros,
  roundMacros,
  type Food,
  type MacroKey,
  type Macros,
  type PlanItem,
} from "@/lib/domain/nutrition";
import type { MealItem } from "@/lib/schemas/meal";

/** Campos de nutrição do item no rascunho do editor (texto como digitado). */
export type NutritionDraft = {
  food_id: string | null;
  grams: string;
  free: boolean;
  override: Record<MacroKey, string>;
};

const MACRO_LABEL: Record<MacroKey, string> = {
  kcal: "kcal",
  protein: "Proteína (g)",
  carbs: "Carboidrato (g)",
  fat: "Gordura (g)",
};

const decimalText = (n: number | null | undefined) => (typeof n === "number" ? String(n).replace(".", ",") : "");

export function toNutritionDraft(item: MealItem): NutritionDraft {
  return {
    food_id: item.food_id ?? null,
    grams: decimalText(item.grams),
    free: isFreeItem(item),
    override: Object.fromEntries(MACRO_KEYS.map((k) => [k, decimalText(item.macros_override?.[k])])) as Record<
      MacroKey,
      string
    >,
  };
}

/** Texto → número; vazio → null; inválido → NaN (o Zod do formulário recusa com mensagem). */
const toNumber = (text: string) => (text.trim() === "" ? null : (parseDecimal(text) ?? Number.NaN));

/**
 * Rascunho → campos gravados no jsonb. Só grava o que tem valor: itens sem vínculo continuam
 * iguais aos da v1, e `free` só aparece quando contraria o texto da quantidade.
 */
export type NutritionFields = { food_id?: string; grams?: number; macros_override?: Partial<Macros>; free?: boolean };

export function nutritionFields(qty: string, d: NutritionDraft): NutritionFields {
  const out: NutritionFields = {};
  if (d.food_id) out.food_id = d.food_id;
  const grams = toNumber(d.grams);
  if (grams !== null) out.grams = grams;
  const override: Partial<Macros> = {};
  for (const k of MACRO_KEYS) {
    const v = toNumber(d.override[k]);
    if (v !== null) override[k] = v;
  }
  if (Object.keys(override).length > 0) out.macros_override = override;
  if (d.free !== parseQty(qty).free) out.free = d.free;
  return out;
}

/** Forma comparável de um item (para saber se o rascunho mudou). */
export function comparableNutrition(item: PlanItem) {
  const override = item.macros_override ?? {};
  return {
    food_id: item.food_id ?? null,
    grams: item.grams === undefined || item.grams === null ? null : Number.isNaN(item.grams) ? "x" : item.grams,
    free: isFreeItem(item),
    override: MACRO_KEYS.map((k) => {
      const v = override[k];
      return v === undefined || v === null ? null : Number.isNaN(v) ? "x" : v;
    }),
  };
}

/**
 * Bloco de nutrição de um item no editor do plano: alimento (TACO ou próprio), gramas,
 * "à vontade" e ajuste manual dos valores. Mostra o resultado do cálculo ao vivo.
 */
export function ItemNutrition({
  index,
  name,
  qty,
  draft,
  foods,
  onChange,
}: {
  index: number;
  name: string;
  qty: string;
  draft: NutritionDraft;
  foods: ReadonlyMap<string, Food> | null;
  onChange: (patch: Partial<NutritionDraft>) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(() => MACRO_KEYS.some((k) => draft.override[k] !== ""));
  const ids = { grams: useId(), free: useId() };
  const label = `Item ${index + 1}`;
  const food = draft.food_id ? (foods?.get(draft.food_id) ?? null) : null;
  const qtyGrams = parseQty(qty).grams;

  const item: PlanItem = { name, qty, ...nutritionFields(qty, draft) };
  const macros = foods ? planItemMacros(item, foods) : null;
  const computed = food ? planItemMacros({ ...item, macros_override: null }, foods ?? new Map()) : null;
  const firstWord = normalizeFoodName(name).split(/[\s/,]+/)[0] ?? "";

  return (
    <div className="space-y-2 rounded-md border bg-background p-2" data-testid="item-nutrition">
      <div className="flex items-center gap-2">
        <Utensils aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm" data-testid="item-food">
          {draft.food_id ? (
            food ? (
              <span className="line-clamp-2">{food.name}</span>
            ) : (
              <span className="text-muted-foreground">{foods ? "Alimento não encontrado" : "Carregando alimento…"}</span>
            )
          ) : (
            <span className="text-muted-foreground">Sem alimento vinculado</span>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          aria-label={`${label}: ${draft.food_id ? "trocar" : "vincular"} alimento`}
          onClick={() => setPickerOpen(true)}
        >
          {draft.food_id ? "Trocar" : "Vincular"}
        </Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={ids.grams} className="text-xs font-normal text-muted-foreground">
            Gramas
            {qtyGrams !== null && !draft.free && draft.grams.trim() === "" && (
              <span className="num"> · vazio usa {decimalText(qtyGrams)}</span>
            )}
          </Label>
          <Input
            id={ids.grams}
            aria-label={`${label}: gramas`}
            inputMode="decimal"
            autoComplete="off"
            value={draft.grams}
            disabled={draft.free}
            placeholder={qtyGrams !== null && !draft.free ? decimalText(qtyGrams) : "Ex.: 150"}
            className="num h-11 text-base"
            onChange={(e) => onChange({ grams: e.target.value })}
          />
        </div>
        <div className="flex min-h-11 items-center gap-2">
          <Checkbox
            id={ids.free}
            className="size-5"
            checked={draft.free}
            aria-label={`${label}: à vontade (0 kcal)`}
            onCheckedChange={(checked) => onChange({ free: checked === true })}
          />
          <Label htmlFor={ids.free} className="font-normal">
            À vontade
          </Label>
        </div>
      </div>

      <div aria-live="polite" className="text-xs" data-testid="item-macros">
        {draft.free ? (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Leaf aria-hidden className="size-3.5" />À vontade: não soma kcal
          </p>
        ) : macros ? (
          <p className="num text-muted-foreground">{formatMacros(macros)}</p>
        ) : foods ? (
          <p className="flex items-center gap-1 font-medium text-highlight-text">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            Sem valor: {draft.food_id ? "informe as gramas" : "vincule um alimento"} ou ajuste os valores
          </p>
        ) : null}
      </div>

      {!draft.free && (
        <Collapsible open={adjustOpen} onOpenChange={setAdjustOpen}>
          <CollapsibleTrigger className="-ml-1 flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-medium text-primary-text outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <ChevronDown aria-hidden className={`size-3.5 transition-transform ${adjustOpen ? "rotate-180" : ""}`} />
            Ajustar valores<span className="sr-only"> do item {index + 1}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Valores do item inteiro. Campo vazio usa o calculado.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MACRO_KEYS.map((k) => (
                <OverrideField
                  key={k}
                  label={MACRO_LABEL[k]}
                  ariaLabel={`${label}: ${MACRO_LABEL[k]}`}
                  value={draft.override[k]}
                  placeholder={computed ? decimalText(roundMacros(computed)[k]) : ""}
                  onChange={(v) => onChange({ override: { ...draft.override, [k]: v } })}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <FoodPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialQuery={food ? "" : firstWord}
        itemLabel={name.trim() || undefined}
        selectedId={draft.food_id}
        onSelect={(f) => onChange({ food_id: f.id, free: false })}
        onClear={() => onChange({ food_id: null })}
      />
    </div>
  );
}

function OverrideField({
  label,
  ariaLabel,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        className="num h-11 text-base"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/features/progress/components/chart-card";
import { amountToGrams, amountUnits, itemMacros, type Food } from "@/lib/domain/nutrition";
import { parseDecimal } from "@/lib/format";
import { FoodSearch } from "./food-search";
import { formatMacros } from "./macro-summary";

const one = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

type OffPlanSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealName: string;
  /** Alimento e gramas escolhidos; quem chama grava o snapshot. */
  onAdd: (food: Food, grams: number) => void;
};

/**
 * Adicionar alimento fora do plano: buscar (TACO ou próprio) → quantidade → Adicionar.
 * Com a refeição aberta: "Adicionar alimento", tocar no resultado e "Adicionar" (a quantidade
 * já vem preenchida com 100 g, ou 1 unidade quando o alimento tem peso por unidade).
 */
export function OffPlanSheet({ open, onOpenChange, mealName, onAdd }: OffPlanSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 p-0">
        {open && <Body mealName={mealName} onAdd={onAdd} close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ mealName, onAdd, close }: { mealName: string; onAdd: OffPlanSheetProps["onAdd"]; close: () => void }) {
  const [food, setFood] = useState<Food | null>(null);
  return (
    <>
      <DialogHeader className="min-w-0 space-y-3 p-5 pr-14 pb-3 text-left">
        <DialogTitle>Adicionar alimento</DialogTitle>
        <DialogDescription>
          {food ? `Quanto de "${food.name}" em ${mealName}?` : `Fora do plano em ${mealName}. Valores por 100 g.`}
        </DialogDescription>
      </DialogHeader>
      {food ? (
        <AmountForm
          food={food}
          onBack={() => setFood(null)}
          onSubmit={(grams) => {
            onAdd(food, grams);
            close();
          }}
        />
      ) : (
        <FoodSearch onSelect={setFood} allowCreate />
      )}
    </>
  );
}

function AmountForm({ food, onBack, onSubmit }: { food: Food; onBack: () => void; onSubmit: (grams: number) => void }) {
  const units = amountUnits(food);
  const ids = { amount: useId(), error: useId() };
  const [unitKey, setUnitKey] = useState(units.length > 2 ? units[2].key : "g");
  const [text, setText] = useState(units.length > 2 ? "1" : "100");
  const [error, setError] = useState<string | null>(null);
  const unit = units.find((u) => u.key === unitKey) ?? units[0];
  const grams = amountToGrams(parseDecimal(text), unit);
  const preview = grams !== null ? itemMacros(food, grams) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (grams === null) return setError("Informe a quantidade, por exemplo 150.");
    onSubmit(grams);
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Quantidade do alimento" className="space-y-4 border-t p-5">
      <div className="space-y-1.5">
        <Label htmlFor={ids.amount}>Quantidade</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={ids.amount}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? ids.error : undefined}
            className="num h-11 w-28 text-base"
          />
          <Segmented
            label="Unidade"
            options={units.map((u) => ({ value: u.key, label: u.label }))}
            value={unit.key}
            onChange={setUnitKey}
          />
        </div>
        {units.length > 2 && (
          <p className="num text-xs text-muted-foreground">
            {units
              .slice(2)
              .map((u) => `1 ${u.label} = ${one.format(u.grams)} g`)
              .join(" · ")}
          </p>
        )}
      </div>
      <p className="num text-sm" data-testid="off-plan-preview" aria-live="polite">
        {preview && grams !== null ? (
          <>
            <span className="text-muted-foreground">{one.format(grams)} g → </span>
            {formatMacros(preview)}
          </>
        ) : (
          <span className="text-muted-foreground">Informe a quantidade.</span>
        )}
      </p>
      {error && (
        <p id={ids.error} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onBack}>
          <ArrowLeft aria-hidden />
          Trocar
        </Button>
        <Button type="submit" className="h-11 flex-1 font-semibold">
          <Plus aria-hidden />
          Adicionar
        </Button>
      </div>
    </form>
  );
}

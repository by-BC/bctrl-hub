"use client";

import { Check, Plus, Search } from "lucide-react";
import { useDeferredValue, useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { searchFoods, type Food } from "@/features/nutrition/domain/nutrition";
import { parseDecimal } from "@/lib/format";
import { TACO_CREDIT, type OwnFoodInsert } from "../api";
import { useCreateFood, useFoods } from "../hooks";

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

type FoodSearchProps = {
  /** Texto inicial da busca. */
  initialQuery?: string;
  selectedId?: string | null;
  onSelect: (food: Food) => void;
  /** Permite criar um alimento próprio (nome + valores por 100 g) a partir da busca. */
  allowCreate?: boolean;
  /** Ações extras no rodapé, ao lado da fonte. */
  footer?: ReactNode;
};

/**
 * Busca na TACO e nos alimentos próprios, em memória e sem acento. Valores por 100 g.
 * Usada no vínculo do plano (`FoodPicker`) e no fora do plano (`OffPlanSheet`).
 */
export function FoodSearch({ initialQuery = "", selectedId, onSelect, allowCreate = false, footer }: FoodSearchProps) {
  const { data, isPending, isError, refetch } = useFoods();
  const [query, setQuery] = useState(initialQuery);
  const [creating, setCreating] = useState(false);
  const deferred = useDeferredValue(query);
  const results = data ? searchFoods(data, deferred) : [];
  const searchId = useId();

  if (creating) {
    return <CreateFoodForm initialName={query.trim()} onCancel={() => setCreating(false)} onCreated={onSelect} />;
  }

  return (
    <>
      <div className="px-5 pb-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor={searchId} className="sr-only">
            Buscar alimento
          </label>
          <Input
            id={searchId}
            type="search"
            value={query}
            autoComplete="off"
            placeholder="Ex.: arroz cozido"
            className="h-11 pl-9 text-base"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t p-2">
        {isPending ? (
          <div className="space-y-2 p-2" aria-label="Carregando alimentos">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-3 p-4 text-sm">
            <p>Não foi possível carregar os alimentos.</p>
            <Button variant="outline" className="h-11" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : deferred.trim() === "" ? (
          <p className="p-4 text-sm text-muted-foreground">Digite parte do nome do alimento.</p>
        ) : results.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum alimento encontrado. Tente outra palavra.</p>
        ) : (
          <ul aria-label="Alimentos">
            {results.map((food) => {
              const selected = food.id === selectedId;
              return (
                <li key={food.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(food)}
                    aria-current={selected ? "true" : undefined}
                    className="flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{food.name}</span>
                      <span className="num block text-xs text-muted-foreground">
                        {int.format(food.kcal)} kcal · P {one.format(food.protein_g)} · C {one.format(food.carbs_g)} · G{" "}
                        {one.format(food.fat_g)}
                        {food.taco_id === null || food.taco_id === undefined ? " · próprio" : ""}
                      </span>
                    </span>
                    {selected && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-primary-text">
                        <Check aria-hidden className="size-3.5" />
                        Atual
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {allowCreate && data && (
          <Button type="button" variant="ghost" className="mt-1 h-11 w-full justify-start" onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Criar alimento próprio
          </Button>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2">
        <p className="text-xs text-muted-foreground">Fonte: {TACO_CREDIT}</p>
        {footer}
      </footer>
    </>
  );
}

const FIELDS = [
  { key: "kcal", label: "kcal" },
  { key: "protein_g", label: "Proteína (g)" },
  { key: "carbs_g", label: "Carboidrato (g)" },
  { key: "fat_g", label: "Gordura (g)" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

/** Alimento próprio: nome, valores por 100 g e, opcional, o peso de 1 unidade. */
function CreateFoodForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (food: Food) => void;
}) {
  const create = useCreateFood();
  const baseId = useId();
  const [name, setName] = useState(initialName);
  const [values, setValues] = useState<Record<FieldKey, string>>({ kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 200) return setError("Dê um nome ao alimento (até 200 caracteres).");
    const parsed = Object.fromEntries(FIELDS.map((f) => [f.key, parseDecimal(values[f.key] || "0")])) as Record<FieldKey, number | null>;
    if (FIELDS.some((f) => parsed[f.key] === null || parsed[f.key]! < 0 || parsed[f.key]! > (f.key === "kcal" ? 900 : 100))) {
      return setError("Informe valores válidos por 100 g (kcal até 900, macros até 100 g).");
    }
    const unitGrams = unit.trim() === "" ? null : parseDecimal(unit);
    if (unitGrams !== null && (unitGrams <= 0 || unitGrams > 5000)) return setError("Peso da unidade entre 0 e 5000 g.");
    const food: OwnFoodInsert = {
      id: crypto.randomUUID(),
      name: trimmed,
      kcal: parsed.kcal!,
      protein_g: parsed.protein_g!,
      carbs_g: parsed.carbs_g!,
      fat_g: parsed.fat_g!,
      unit_grams: unitGrams ? { un: unitGrams } : {},
    };
    create.mutate(food);
    onCreated({ ...food, taco_id: null, category: null });
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Criar alimento" className="min-h-0 flex-1 space-y-3 overflow-y-auto border-t p-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${baseId}-name`}>Nome</Label>
        <Input id={`${baseId}-name`} value={name} maxLength={200} className="h-11 text-base" onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Valores por 100 g</legend>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`${baseId}-${f.key}`} className="text-xs">
                {f.label}
              </Label>
              <Input
                id={`${baseId}-${f.key}`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={values[f.key]}
                className="num h-11 text-base"
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`${baseId}-unit`}>Peso de 1 unidade (g, opcional)</Label>
        <Input
          id={`${baseId}-unit`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ex.: 50"
          value={unit}
          className="num h-11 text-base"
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          Voltar
        </Button>
        <Button type="submit" className="h-11 flex-1 font-semibold">
          <Plus aria-hidden />
          Criar e usar
        </Button>
      </div>
    </form>
  );
}

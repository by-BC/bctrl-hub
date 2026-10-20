"use client";

import { Check, Search, Unlink } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchFoods, type Food } from "@/lib/domain/nutrition";
import { TACO_CREDIT } from "../api";
import { useFoods } from "../hooks";

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

type FoodPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texto inicial da busca (ex.: o nome do item do plano). */
  initialQuery?: string;
  selectedId?: string | null;
  onSelect: (food: Food) => void;
  /** Quando presente, mostra "Remover vínculo". */
  onClear?: () => void;
  itemLabel?: string;
};

/** Busca na TACO (e nos alimentos próprios), sem acento. Valores por 100 g. */
export function FoodPicker({ open, onOpenChange, ...props }: FoodPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-0 p-0">
        {/* Montado só aberto: a busca sempre começa do nome do item. */}
        {open && <PickerBody {...props} close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  initialQuery = "",
  selectedId,
  onSelect,
  onClear,
  itemLabel,
  close,
}: Omit<FoodPickerProps, "open" | "onOpenChange"> & { close: () => void }) {
  const { data, isPending, isError, refetch } = useFoods();
  const [query, setQuery] = useState(initialQuery);
  const deferred = useDeferredValue(query);
  const results = data ? searchFoods(data, deferred) : [];
  const searchId = useId();

  return (
    <>
      <DialogHeader className="min-w-0 space-y-3 border-b p-5 pr-14 pb-3 text-left">
        <DialogTitle>Alimento</DialogTitle>
        <DialogDescription>
          {itemLabel ? `Para "${itemLabel}". ` : ""}Valores por 100 g.
        </DialogDescription>
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
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
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
                    onClick={() => {
                      onSelect(food);
                      close();
                    }}
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
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2">
        <p className="text-xs text-muted-foreground">Fonte: {TACO_CREDIT}</p>
        {onClear && selectedId && (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => {
              onClear();
              close();
            }}
          >
            <Unlink aria-hidden />
            Remover vínculo
          </Button>
        )}
      </footer>
    </>
  );
}

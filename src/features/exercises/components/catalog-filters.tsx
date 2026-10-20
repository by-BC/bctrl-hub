"use client";

import { Check, Search, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import {
  hasActiveFilters,
  toggleValue,
  type CatalogFilters as Filters,
  type FacetOption,
} from "@/lib/domain/catalog";

type CatalogFiltersProps = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  facets: { muscles: FacetOption[]; equipment: FacetOption[] };
  /** Botões extras ao lado da busca (ex.: "Novo exercício"). */
  actions?: ReactNode;
  autoFocus?: boolean;
};

/** Busca + chips de músculo principal e equipamento (combináveis). */
export function CatalogFilters({ filters, onChange, facets, actions, autoFocus }: CatalogFiltersProps) {
  const searchId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const active = hasActiveFilters(filters);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <label htmlFor={searchId} className="sr-only">
            Buscar exercício
          </label>
          <Input
            ref={inputRef}
            id={searchId}
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Buscar por nome, músculo ou equipamento"
            autoComplete="off"
            className="h-11 pl-9 text-base"
          />
        </div>
        {actions}
      </div>

      <ChipRow
        label="Músculo principal"
        options={facets.muscles}
        selected={filters.muscles}
        onToggle={(value) => onChange({ ...filters, muscles: toggleValue(filters.muscles, value) })}
      />
      <ChipRow
        label="Equipamento"
        options={facets.equipment}
        selected={filters.equipment}
        onToggle={(value) => onChange({ ...filters, equipment: toggleValue(filters.equipment, value) })}
      />

      {active && (
        <button
          type="button"
          onClick={() => onChange({ query: "", muscles: [], equipment: [] })}
          className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary-text outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-4" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: FacetOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div role="group" aria-label={`Filtrar por ${label.toLowerCase()}`} className="min-w-0">
      <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase" aria-hidden>
        {label}
      </p>
      {/* Rola na horizontal dentro da faixa: a página não ganha rolagem lateral em 375 px. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                on
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent"
              }`}
            >
              {on && <Check aria-hidden className="size-3.5" />}
              {o.label}
              <span className={`num text-xs ${on ? "" : "text-muted-foreground"}`} aria-hidden>
                {o.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

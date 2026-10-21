"use client";

import { Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ChartCardProps = {
  title: string;
  /** Linha abaixo do título (período, unidade). */
  subtitle?: ReactNode;
  /** Legenda (2+ séries). Uma série só dispensa: o título já diz o que é. */
  legend?: { label: string; color: string; kind: "line" | "dots" }[];
  /** Resumo em texto para leitores de tela. */
  summary: string;
  chart: ReactNode;
  /** Tabela com os mesmos dados ("ver dados"). */
  table: ReactNode;
  /** Mantém o quadro durante o refetch, só esmaecido. */
  refreshing?: boolean;
};

/** Moldura dos gráficos: título, legenda, gráfico e a alternativa em tabela. */
export function ChartCard({ title, subtitle, legend, summary, chart, table, refreshing }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const tableId = useId();

  return (
    <figure aria-labelledby={titleId} className="rounded-xl border bg-card p-4 lg:p-5">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p id={titleId} className="font-semibold">
            {title}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          <p className="sr-only">{summary}</p>
        </div>
        {legend && legend.length > 1 && (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                {item.kind === "line" ? (
                  <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: item.color }} />
                ) : (
                  <span aria-hidden className="size-2 rounded-full" style={{ background: item.color }} />
                )}
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>

      <div className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>{chart}</div>

      <div className="mt-2 border-t pt-2">
        <Button
          variant="ghost"
          className="h-11 px-2 text-sm"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
        >
          <Table2 aria-hidden />
          {showTable ? "Ocultar dados" : "Ver dados"}
        </Button>
        <div id={tableId} hidden={!showTable} className="mt-2 max-h-80 overflow-auto">
          {showTable && table}
        </div>
      </div>
    </figure>
  );
}

/** Tabela simples e acessível para o "ver dados". */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: { label: string; numeric?: boolean }[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-card">
        <tr className="border-b text-xs text-muted-foreground">
          {columns.map((c, i) => (
            <th key={i} scope="col" className={`py-2 font-medium ${c.numeric ? "text-right" : "text-left"}`}>
              {c.label || <span className="sr-only">Ações</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b last:border-0">
            {row.cells.map((cell, i) => {
              const numeric = columns[i]?.numeric;
              const Cell = i === 0 ? "th" : "td";
              return (
                <Cell
                  key={i}
                  scope={i === 0 ? "row" : undefined}
                  className={`py-2 font-normal ${numeric ? "num text-right" : "text-left"}`}
                >
                  {cell}
                </Cell>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Grupo de opções exclusivas (métrica, período), com alvo de toque ≥ 44 px.
 * `stretch` ocupa a largura toda e divide entre as opções (muitas opções em 375 px).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  stretch = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  stretch?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={`${stretch ? "flex w-full" : "inline-flex"} rounded-lg bg-muted p-1`}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-md text-sm ${stretch ? "min-w-0 flex-1 px-1" : "px-3"} font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
              selected ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

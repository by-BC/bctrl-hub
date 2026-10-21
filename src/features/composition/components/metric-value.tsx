import { ArrowDown, ArrowUp, Equal, Minus } from "lucide-react";
import { NumUnit } from "@/components/num-unit";
import type { MetricDef } from "@/lib/domain/composition";
import { cn } from "@/lib/utils";
import { formatMetricNumber, TONE_TEXT, type DeltaView } from "../view";

/** Valor da métrica: `<NumUnit>` com unidade; "%" colado ao número; índices sem unidade. */
export function MetricValue({ value, def, className }: { value: number; def: MetricDef; className?: string }) {
  const n = formatMetricNumber(value, def);
  if (!def.unit) return <span className={cn("num", className)}>{n}</span>;
  if (def.unit === "%") return <span className={cn("num whitespace-nowrap", className)}>{n}%</span>;
  return <NumUnit value={n} unit={def.unit} className={className} />;
}

const ICON = { up: ArrowUp, down: ArrowDown, same: Equal, none: Minus } as const;

/**
 * Variação: seta + texto (direção e valor com sinal). A cor segue a direção desejada da métrica
 * (azul = melhora, laranja = piora, neutra sem julgamento) e o tom vai também em texto para
 * leitores de tela; a cor nunca é o único sinal.
 */
export function DeltaText({ delta }: { delta: DeltaView }) {
  const Icon = ICON[delta.direction];
  return (
    <span
      data-direction={delta.direction}
      data-tone={delta.tone}
      className={cn(
        "inline-flex items-start gap-1 text-xs",
        delta.tone === "good" && "text-primary-text",
        delta.tone === "bad" && "text-highlight-text",
        delta.tone === "neutral" && "text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
      {delta.value ? (
        <span>
          {/* Só o número em mono: o espaço da Plex Mono antes da unidade parece duplo. */}
          <span className="num">{delta.value}</span>
          {delta.text.slice(delta.value.length)}
        </span>
      ) : (
        <span>{delta.text}</span>
      )}
      {TONE_TEXT[delta.tone] && <span className="sr-only">({TONE_TEXT[delta.tone]})</span>}
    </span>
  );
}

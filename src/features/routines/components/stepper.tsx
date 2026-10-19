"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Como o valor aparece (ex.: segundos → "2:00"). */
  format?: (value: number) => string;
  /** Texto curto sob o valor (ex.: "padrão"). */
  hint?: string;
  className?: string;
};

/** − valor +, com alvos de 44 px. O valor é anunciado a cada mudança. */
export function Stepper({ label, value, min, max, step = 1, onChange, format, hint, className }: StepperProps) {
  const labelId = useId();
  const shown = format ? format(value) : String(value);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className={cn("min-w-0", className)}>
      <p id={labelId} className="mb-1 text-xs text-muted-foreground">
        {label}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex items-center rounded-lg border bg-background/40">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-r-none"
          aria-label={`Diminuir ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          <Minus aria-hidden />
        </Button>
        <output
          aria-live="polite"
          aria-label={`${label}: ${shown}${hint ? ` (${hint})` : ""}`}
          className="flex min-w-12 flex-1 flex-col items-center justify-center leading-none"
        >
          <span className="num text-base font-semibold">{shown}</span>
          {hint && <span className="mt-0.5 text-[10px] text-muted-foreground">{hint}</span>}
        </output>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-l-none"
          aria-label={`Aumentar ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          <Plus aria-hidden />
        </Button>
      </div>
    </div>
  );
}

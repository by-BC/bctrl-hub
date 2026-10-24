"use client";

import { ChevronDown, Save } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { measurementErrors, METRICS, type MetricDef, type MetricKey } from "@/features/composition/domain/composition";
import { dayInSaoPaulo, saoPauloLocal, saoPauloLocalToInstant } from "@/lib/domain/day";
import type { Measurement, MeasurementSave } from "../api";
import { useSaveMeasurement } from "../hooks";
import { fieldLabel, metricInputValue, parseMetricInput } from "../view";

const MAIN = METRICS.filter((m) => m.principal);
const MORE = METRICS.filter((m) => !m.principal);

type MeasurementSheetProps = {
  open: boolean;
  /** `null` cria uma medição nova. */
  measurement: Measurement | null;
  onOpenChange: (open: boolean) => void;
};

/** Nova medição ou edição: data e hora, peso obrigatório, 4 principais em destaque e "Mais métricas". */
export function MeasurementSheet({ open, measurement, onOpenChange }: MeasurementSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl">
        {open && <MeasurementForm key={measurement?.id ?? "nova"} measurement={measurement} close={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

type Texts = Record<MetricKey, string>;

const initialTexts = (m: Measurement | null) =>
  Object.fromEntries(METRICS.map((d) => [d.key, metricInputValue(m?.[d.key])])) as Texts;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function MeasurementForm({ measurement, close }: { measurement: Measurement | null; close: () => void }) {
  const save = useSaveMeasurement();
  const ids = { when: useId(), error: useId() };
  const [when, setWhen] = useState(() => saoPauloLocal(measurement?.measured_at ?? new Date()));
  const [texts, setTexts] = useState<Texts>(() => initialTexts(measurement));
  const [errors, setErrors] = useState<{ key: MetricKey | "when"; message: string }[]>([]);
  // Edição com alguma métrica secundária preenchida já abre "Mais métricas".
  const [moreOpen, setMoreOpen] = useState(() => MORE.some((d) => measurement?.[d.key] != null));
  const invalid = new Set(errors.map((e) => e.key));

  function submit(e: FormEvent) {
    e.preventDefault();
    const values = Object.fromEntries(METRICS.map((d) => [d.key, parseMetricInput(texts[d.key])])) as Record<MetricKey, number | null>;
    const found: { key: MetricKey | "when"; message: string }[] = [];
    const instant = saoPauloLocalToInstant(when);
    if (!instant) found.push({ key: "when", message: "Informe a data e a hora." });
    else if (Date.parse(instant) > Date.now() + 60_000) found.push({ key: "when", message: "A data e a hora não podem estar no futuro." });
    found.push(...measurementErrors(values));
    setErrors(found);
    if (found.length > 0) {
      if (found.some((f) => MORE.some((d) => d.key === f.key))) setMoreOpen(true);
      return;
    }

    const metrics = Object.fromEntries(
      METRICS.map((d) => [d.key, values[d.key] === null ? null : round2(values[d.key]!)]),
    ) as Record<MetricKey, number | null>;
    const row: MeasurementSave = {
      ...metrics,
      weight_kg: metrics.weight_kg!,
      id: measurement?.id ?? crypto.randomUUID(),
      measured_at: instant!,
      day: dayInSaoPaulo(instant!),
      source: measurement?.source ?? "manual",
      note: measurement?.note ?? null,
    };
    save.mutate(row);
    close();
  }

  const field = (def: MetricDef) => (
    <MetricField
      key={def.key}
      def={def}
      value={texts[def.key]}
      invalid={invalid.has(def.key)}
      errorId={ids.error}
      onChange={(v) => setTexts((t) => ({ ...t, [def.key]: v }))}
    />
  );

  return (
    <>
      <SheetHeader className="pr-12 text-left">
        <SheetTitle>{measurement ? "Editar medição" : "Nova medição"}</SheetTitle>
        <SheetDescription>Copie os números da balança. Só o peso é obrigatório.</SheetDescription>
      </SheetHeader>

      <form aria-label={measurement ? "Editar medição" : "Nova medição"} noValidate onSubmit={submit} className="space-y-4 px-4 pb-6">
        <div className="space-y-1.5">
          <Label htmlFor={ids.when}>Data e hora</Label>
          <Input
            id={ids.when}
            type="datetime-local"
            value={when}
            max={saoPauloLocal(new Date())}
            onChange={(e) => setWhen(e.target.value)}
            aria-invalid={invalid.has("when") || undefined}
            aria-describedby={invalid.has("when") ? ids.error : undefined}
            className="num h-11 text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">{MAIN.map(field)}</div>

        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="h-11 w-full justify-between">
              Mais métricas
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {MORE.length} opcionais
                <ChevronDown aria-hidden className={`size-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-2 gap-3">{MORE.map(field)}</div>
          </CollapsibleContent>
        </Collapsible>

        {errors.length > 0 && (
          <div id={ids.error} role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm text-destructive">
            <p className="font-medium">Confira os valores:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errors.map((e) => (
                <li key={e.key}>{e.message}</li>
              ))}
            </ul>
          </div>
        )}

        <Button type="submit" className="h-11 w-full font-semibold">
          <Save aria-hidden />
          {measurement ? "Salvar alterações" : "Salvar medição"}
        </Button>
      </form>
    </>
  );
}

function MetricField({
  def,
  value,
  invalid,
  errorId,
  onChange,
}: {
  def: MetricDef;
  value: string;
  invalid: boolean;
  errorId: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col justify-end gap-1.5">
      <Label htmlFor={id} className="text-xs leading-tight">
        {fieldLabel(def)}
        {def.key === "weight_kg" && <span className="sr-only"> (obrigatório)</span>}
        {def.key === "weight_kg" && <span aria-hidden> *</span>}
      </Label>
      <Input
        id={id}
        // Grau de obesidade pode ser negativo: o teclado decimal do iPhone não tem o sinal de menos.
        inputMode={def.min < 0 ? "text" : def.integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        aria-required={def.key === "weight_kg" || undefined}
        className="num h-11 text-base"
      />
    </div>
  );
}

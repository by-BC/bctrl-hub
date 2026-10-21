import { METRIC, type MeasurementLike, type MetricDef, type MetricKey } from "@/lib/domain/composition";
import { dayToTime } from "@/lib/domain/stats";
import { APP_TIME_ZONE, dayInSaoPaulo } from "@/lib/domain/day";

/**
 * Formatação da tela de composição (sem I/O): valores, variações e séries dos gráficos.
 * As contas ficam em `src/lib/domain/composition.ts`; aqui só o que a tela mostra.
 */

const twoDecimals = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const noDecimals = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Número da métrica sem unidade: kcal e inteiros sem casas; o resto até 2 casas. */
export function formatMetricNumber(value: number, def: MetricDef): string {
  return (def.integer || def.unit === "kcal" ? noDecimals : twoDecimals).format(value);
}

/** Número com unidade ("82,4 kg", "18,5%", "9"), para texto, tooltip e tabela. */
export function metricText(value: number, def: MetricDef): string {
  const n = formatMetricNumber(value, def);
  if (!def.unit) return n;
  return def.unit === "%" ? `${n}%` : `${n} ${def.unit}`;
}

/** Rótulo do campo com a unidade: "Peso (kg)", "Gordura visceral". */
export function fieldLabel(def: MetricDef): string {
  return def.unit ? `${def.label} (${def.unit})` : def.label;
}

export type DeltaDirection = "up" | "down" | "same" | "none";
/** Se a direção é a desejada para a métrica (`better`); `neutral` não julga. */
export type DeltaTone = "good" | "bad" | "neutral";
/**
 * `value` é o número com sinal e `unit` a unidade (`null`/"" sem número); `rest` é o que vem depois
 * ("desde a 1ª"); `text` é a frase toda.
 */
export type DeltaView = { direction: DeltaDirection; tone: DeltaTone; value: string | null; unit: string; text: string };

/**
 * Variação para a tela: seta (direção) + texto com sinal e unidade + tom pela direção desejada.
 * `against` completa o texto ("desde a 1ª", "vs anterior"). Sem base (`null`), "sem base".
 */
export function deltaView(delta: number | null, key: MetricKey, against: string): DeltaView {
  const def = METRIC[key];
  if (delta === null) return { direction: "none", tone: "neutral", value: null, unit: "", text: `sem base ${against}` };
  const abs = Math.abs(delta);
  const shown = formatMetricNumber(abs, def);
  if (shown === formatMetricNumber(0, def)) return { direction: "same", tone: "neutral", value: null, unit: "", text: `igual ${against}` };
  const direction = delta > 0 ? "up" : "down";
  const tone: DeltaTone = def.better === "neutral" ? "neutral" : def.better === direction ? "good" : "bad";
  const unit = def.unit === "%" ? "p.p." : def.unit;
  const value = `${delta > 0 ? "+" : "−"}${shown}`;
  return { direction, tone, value, unit, text: `${value}${unit ? ` ${unit}` : ""} ${against}` };
}

/** Texto para leitor de tela sobre o tom (a cor não é o único sinal: a seta e o sinal vêm no texto). */
export const TONE_TEXT: Record<DeltaTone, string> = { good: "melhora", bad: "piora", neutral: "" };

// ── Séries dos gráficos ───────────────────────────────────────────────────

export type MetricPoint = { id: string; day: string; t: number; value: number };

const sorted = <T extends MeasurementLike>(ms: readonly T[]) =>
  [...ms].sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Pontos de uma métrica (dia de São Paulo, `t` para o eixo), pulando medições sem ela. */
export function metricPoints<T extends MeasurementLike & { id: string }>(ms: readonly T[], key: MetricKey): MetricPoint[] {
  return sorted(ms).flatMap((m) => {
    const value = num(m[key]);
    if (value === null) return [];
    const day = m.day ?? dayInSaoPaulo(m.measured_at);
    return [{ id: m.id, day, t: dayToTime(day), value }];
  });
}

export type FatMusclePoint = { id: string; day: string; t: number; fat: number; muscle: number };

/** Gordura (kg) × músculo esquelético (kg): só as medições que têm as duas. */
export function fatMusclePoints<T extends MeasurementLike & { id: string }>(ms: readonly T[]): FatMusclePoint[] {
  return sorted(ms).flatMap((m) => {
    const fat = num(m.fat_mass_kg);
    const muscle = num(m.skeletal_muscle_kg);
    if (fat === null || muscle === null) return [];
    const day = m.day ?? dayInSaoPaulo(m.measured_at);
    return [{ id: m.id, day, t: dayToTime(day), fat, muscle }];
  });
}

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Hora da medição em São Paulo ("07:05"). */
export const formatTime = (instant: string) => timeFormatter.format(new Date(instant));

// ── Formulário ────────────────────────────────────────────────────────────

/** Texto do campo → número (vírgula ou ponto; aceita negativo). Vazio → `null`; inválido → `NaN`. */
export function parseMetricInput(text: string): number | null {
  const clean = text.trim().replace(",", ".").replace("−", "-");
  if (clean === "") return null;
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

/** Número → texto do campo ("82,4"); `null` → vazio. */
export const metricInputValue = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value).replace(".", ",");

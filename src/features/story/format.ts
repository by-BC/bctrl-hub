import type { PrKind } from "@/lib/domain/workout";
import { formatInt, formatKg } from "@/lib/format";

/** Formatação própria do story (caixa alta, datas de prancha/cupom). Sem I/O. */

const at = (day: string) => new Date(`${day}T12:00:00Z`);
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts });
const weekdayFmt = fmt({ weekday: "long" });
const monthFmt = fmt({ month: "short" });

export type StoryDate = {
  /** "quarta-feira" */
  weekday: string;
  /** "14 OUT 2026" */
  long: string;
  /** "14.10.2026" */
  dotted: string;
  /** "20261014" (código de barras) */
  digits: string;
};

export function storyDate(day: string): StoryDate {
  const [y, m, d] = day.split("-");
  const month = monthFmt.format(at(day)).replace(".", "").toUpperCase();
  return {
    weekday: weekdayFmt.format(at(day)),
    long: `${Number(d)} ${month} ${y}`,
    dotted: `${d}.${m}.${y}`,
    digits: `${y}${m}${d}`,
  };
}

export const STORY_PR_LABELS: Record<PrKind, string> = {
  weight: "Carga",
  volume: "Volume",
  e1rm: "1RM est.",
  duration: "Duração",
  distance: "Distância",
};

/** Número do recorde (a unidade é sempre kg): "72,5", "1.000", "96,7". */
export const prValue = (kind: PrKind, value: number) => (kind === "volume" ? formatInt(value) : formatKg(value));

/** Valor do recorde com unidade: "72,5 kg", "1.000 kg", "96,7 kg". */
export const prValueText = (kind: PrKind, value: number) => `${prValue(kind, value)} kg`;

/** "70 × 8" (carga × reps); sem carga, só as reps: "12 reps". */
export const setText = (kg: number, reps: number) => (kg > 0 ? `${formatKg(kg)} × ${reps}` : `${reps} reps`);

export const volumeText = (kg: number) => formatInt(kg);

/** "1h12" / "48 min" em forma curta para números grandes. */
export function durationShort(min: number) {
  if (min < 60) return { value: String(min), unit: "min" };
  return { value: `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`, unit: "" };
}

/**
 * Barras decorativas do código de barras a partir de um texto (a data): cada dígito vira
 * um par barra/vão de larguras 1–4, com guardas nas pontas. Determinístico.
 */
export function barcodeBars(text: string): { bar: number; gap: number }[] {
  const digits = text.replace(/\D/g, "").split("").map(Number);
  const guard = [
    { bar: 1, gap: 1 },
    { bar: 1, gap: 1 },
  ];
  const body = digits.flatMap((n, i) => [
    { bar: (n % 4) + 1, gap: ((n + i) % 3) + 1 },
    { bar: ((n * 7 + i) % 3) + 1, gap: (n % 2) + 1 },
  ]);
  return [...guard, ...body, ...guard];
}

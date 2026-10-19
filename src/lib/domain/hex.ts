/**
 * Hex Week: o símbolo do Bctrl Hub como anel de progresso da semana. Sem I/O.
 *
 * Geometria igual à de `assets/brand/bctrl-hub-symbol.svg` (viewBox 200, traço 22):
 * 3 polylines (treino em azul, alimentação em laranja, hábitos em neutro) + o núcleo.
 * Cada segmento é preenchido a partir do seu primeiro ponto, no sentido horário.
 */

export const HEX_VIEWBOX = 200;
export const HEX_STROKE = 22;

export type HexSegmentKey = "workouts" | "meals" | "habits";

/** Ordem de desenho e de leitura (legenda): treino → alimentação → hábitos. */
export const HEX_SEGMENT_KEYS: readonly HexSegmentKey[] = ["workouts", "meals", "habits"];

export const HEX_SEGMENT_POINTS: Record<HexSegmentKey, string> = {
  workouts: "108.7,25 169.3,60 169.3,130",
  meals: "160.6,145 100,180 39.4,145",
  habits: "30.7,130 30.7,60 91.3,25",
};

export const HEX_CORE_POINTS = "100,78 119,89 119,111 100,122 81,111 81,89";

/** Comprimento de uma polyline "x,y x,y …". */
export function polylineLength(points: string): number {
  const xy = points
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number) as [number, number]);
  let length = 0;
  for (let i = 1; i < xy.length; i++) {
    length += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
  }
  return length;
}

/** Comprimento de cada segmento (≈ 140 no viewBox 200; variam só no arredondamento dos pontos). */
export const HEX_SEGMENT_LENGTHS: Record<HexSegmentKey, number> = {
  workouts: polylineLength(HEX_SEGMENT_POINTS.workouts),
  meals: polylineLength(HEX_SEGMENT_POINTS.meals),
  habits: polylineLength(HEX_SEGMENT_POINTS.habits),
};

/** Comprimento padrão (o do segmento de treino). */
export const HEX_SEGMENT_LENGTH = HEX_SEGMENT_LENGTHS.workouts;

/** Progresso em 0–1: abaixo de 0 (ou inválido) vira 0, acima de 1 vira 1. */
export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  return progress >= 1 ? 1 : progress;
}

export type SegmentFill = {
  /** Progresso já limitado a 0–1. */
  progress: number;
  /** Trecho preenchido do segmento (unidades do viewBox). */
  filled: number;
  /** `stroke-dasharray`: um traço do tamanho do segmento e um vão igual. */
  dashArray: string;
  /** `stroke-dashoffset`: desloca o traço para mostrar só `filled`. */
  dashOffset: number;
};

/**
 * Converte o progresso (0–1) no traço do segmento. Com `dasharray = L L` e
 * `dashoffset = L − filled`, só os primeiros `filled` do segmento aparecem.
 */
export function segmentFill(progress: number, length: number = HEX_SEGMENT_LENGTH): SegmentFill {
  const p = clampProgress(progress);
  const filled = length * p;
  return { progress: p, filled, dashArray: `${length} ${length}`, dashOffset: length - filled };
}

// ── Números da semana → os 3 segmentos ────────────────────────────────────

/** Metas padrão dos hábitos do sistema na semana (quando o hábito não traz a sua). */
export const HABIT_WEEK_TARGETS = { cardio: 150, abs: 3, supplements: 7 } as const;
export type SystemHabitKey = keyof typeof HABIT_WEEK_TARGETS;

type Count = { done: number; target: number | null } | null | undefined;

export type WeekHexInput = {
  workouts: { done: number; target: number };
  meals: { pct: number };
  cardio: { minutes: number; target: number | null } | null | undefined;
  abs: Count;
  supplements: Count;
};

export type HabitPart = { key: SystemHabitKey; done: number; target: number; ratio: number };

const ratio = (done: number, target: number) => (target > 0 ? clampProgress(done / target) : 0);

/**
 * Segmento de hábitos: média simples de cardio (min/150), abdominal (x/3) e suplementos
 * (dias/7), cada um limitado a 1 (passar da meta num hábito não compensa outro).
 * A meta vem do hábito (`week_target` do banco) e, sem ela, das metas padrão.
 * Hábito do sistema ausente (arquivado) sai da média; sem nenhum, o segmento fica em 0.
 */
export function habitsProgress(input: Pick<WeekHexInput, "cardio" | "abs" | "supplements">): {
  progress: number;
  parts: HabitPart[];
} {
  const raw: [SystemHabitKey, { done: number; target: number | null } | null | undefined][] = [
    ["cardio", input.cardio ? { done: input.cardio.minutes, target: input.cardio.target } : null],
    ["abs", input.abs],
    ["supplements", input.supplements],
  ];
  const parts: HabitPart[] = [];
  for (const [key, count] of raw) {
    if (!count) continue;
    const target = count.target && count.target > 0 ? count.target : HABIT_WEEK_TARGETS[key];
    parts.push({ key, done: count.done, target, ratio: ratio(count.done, target) });
  }
  const progress = parts.length === 0 ? 0 : parts.reduce((sum, p) => sum + p.ratio, 0) / parts.length;
  return { progress, parts };
}

export type WeekHex = Record<HexSegmentKey, number> & { habitParts: HabitPart[] };

/** Os 3 progressos (0–1) do Hex Week a partir do `week_summary`. */
export function weekHex(summary: WeekHexInput): WeekHex {
  const habits = habitsProgress(summary);
  return {
    workouts: ratio(summary.workouts.done, summary.workouts.target),
    meals: clampProgress(summary.meals.pct / 100),
    habits: habits.progress,
    habitParts: habits.parts,
  };
}

/** 0,456 → 46 (percentual inteiro para rótulos). */
export const toPct = (progress: number) => Math.round(clampProgress(progress) * 100);

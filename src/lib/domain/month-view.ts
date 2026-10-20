/**
 * O que a tela de Perfil mostra a partir da pontuação e do resumo do mês: os dias do heatmap,
 * o resumo por mês (alternativa textual) e a variação contra o mês anterior. Sem I/O.
 */

import { CONTROL_MIN_SCORE, heatmapLevel, metCriteria, type DayScore, type ScoreValue } from "./score";
import { addDays } from "./stats";
import { addMonths, monthStart } from "./week";

// ── Heatmap ───────────────────────────────────────────────────────────────

/** Um dia do heatmap: `count` é a pontuação (0–4), `level` o nível de cor. */
export type HeatDay = { date: string; count: number; level: ScoreValue; criteria: string[] };

/** Janela do heatmap: do 1º dia do mês de 11 meses atrás até hoje (12 meses de calendário). */
export function heatmapRange(today: string): { from: string; to: string } {
  return { from: addMonths(today, -11), to: today };
}

/**
 * Um item por dia, de `from` a `to` (hoje). Dia sem linha vale 0; dias depois de `to` não
 * entram, então o futuro nunca aparece preenchido (nem aparece).
 */
export function heatmapDays(scores: readonly DayScore[], from: string, to: string): HeatDay[] {
  const byDay = new Map(scores.map((s) => [s.day, s]));
  const days: HeatDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = byDay.get(d);
    const level = heatmapLevel(s?.score ?? 0);
    days.push({ date: d, count: level, level, criteria: s ? metCriteria(s) : [] });
  }
  return days;
}

/** Cor de cada nível (tokens `--heat-0` a `--heat-4`, um conjunto por tema). */
export const heatColor = (level: number) => `var(--heat-${heatmapLevel(level)})`;

export type HeatMonth = {
  /** 1º dia do mês. */
  month: string;
  /** Dias do mês dentro da janela (até hoje). */
  days: number;
  /** Dias no controle (pontuação ≥ 3). */
  control: number;
  /** Dias com pelo menos 1 ponto. */
  scored: number;
};

/** Resumo por mês dos dias do heatmap, do mais antigo ao mais recente. */
export function heatmapMonths(days: readonly HeatDay[]): HeatMonth[] {
  const months = new Map<string, HeatMonth>();
  for (const d of days) {
    const m = monthStart(d.date);
    const acc = months.get(m) ?? { month: m, days: 0, control: 0, scored: 0 };
    acc.days += 1;
    if (d.count >= CONTROL_MIN_SCORE) acc.control += 1;
    if (d.count > 0) acc.scored += 1;
    months.set(m, acc);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "18 de 31 dias no controle" (1 dia: "1 de 1 dia no controle"). */
export function controlText(control: number, days: number): string {
  return `${control} de ${days} ${plural(days, "dia", "dias")} no controle`;
}

/** "2 de 4 pontos" (a pontuação sempre com o máximo, para não depender da cor). */
export const scoreText = (score: number) => `${score} de 4 pontos`;

// ── Mês ───────────────────────────────────────────────────────────────────

const at = (day: string) => new Date(`${day}T12:00:00Z`);
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOnly = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthShortFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

/** "outubro de 2026". */
export const monthLabel = (month: string) => monthLong.format(at(month));
/** "outubro". */
export const monthName = (month: string) => monthOnly.format(at(month));
/** "out" (sem o ponto). */
export const monthShort = (month: string) => monthShortFmt.format(at(month)).replace(".", "");

/** O mês pode avançar? Nunca passa do mês de hoje. */
export const canGoNextMonth = (month: string, today: string) => monthStart(month) < monthStart(today);

// ── Variação contra o mês anterior ────────────────────────────────────────

export type MonthDelta = {
  /** `none`: sem base (algum dos dois meses não tem o número). */
  direction: "up" | "down" | "same" | "none";
  /** Texto completo, sem depender da seta: "+3 vs set", "igual a set", "sem base em set". */
  text: string;
};

/**
 * Variação de `current` contra `previous` (mês anterior, `prevShort` = "set"). `null` = o mês
 * não tem o número (ex.: nenhum registro de refeição): não há o que comparar.
 * A diferença é formatada por `format` (com unidade, se houver); se ela arredonda para zero,
 * é "igual".
 */
export function monthDelta(
  current: number | null,
  previous: number | null,
  prevShort: string,
  format: (n: number) => string,
): MonthDelta {
  if (current === null) return { direction: "none", text: "sem comparação" };
  if (previous === null) return { direction: "none", text: `sem base em ${prevShort}` };
  const diff = current - previous;
  const abs = format(Math.abs(diff));
  if (diff === 0 || abs === format(0)) return { direction: "same", text: `igual a ${prevShort}` };
  return diff > 0
    ? { direction: "up", text: `+${abs} vs ${prevShort}` }
    : { direction: "down", text: `−${abs} vs ${prevShort}` };
}

/**
 * Dia, semana e mês do app: semana de segunda a domingo em America/Sao_Paulo.
 * Toda conta de "dia" e "semana" (hábitos, refeições, resumo) passa por aqui. Sem I/O.
 */

import { dayInSaoPaulo } from "./day";

const DAY_MS = 86_400_000;

// Dia é data pura: meio-dia UTC não escorrega de fuso.
const toTime = (day: string) => Date.parse(`${day}T12:00:00Z`);
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * Dia (AAAA-MM-DD) do instante em America/Sao_Paulo. Domingo 23h30 em São Paulo
 * (segunda 02h30 em UTC) ainda é domingo.
 */
export function dayKey(instant: Date | string): string {
  return dayInSaoPaulo(instant);
}

/** Segunda-feira da semana do dia (o próprio dia, se já for segunda). */
export function weekStart(day: string): string {
  const time = toTime(day);
  const isoWeekday = ((new Date(time).getUTCDay() + 6) % 7) + 1; // 1 = segunda … 7 = domingo
  return toDay(time - (isoWeekday - 1) * DAY_MS);
}

/** Os 7 dias da semana que começa em `start` (segunda → domingo). */
export function weekDays(start: string): string[] {
  const monday = toTime(weekStart(start));
  return Array.from({ length: 7 }, (_, i) => toDay(monday + i * DAY_MS));
}

/** Segunda-feira `delta` semanas antes (negativo) ou depois (positivo). */
export function addWeeks(start: string, delta: number): string {
  return toDay(toTime(weekStart(start)) + delta * 7 * DAY_MS);
}

// ── Mês ───────────────────────────────────────────────────────────────────
// Mês identificado pelo 1º dia ("AAAA-MM-01"), como o `month` do `month_summary`.

/** 1º dia do mês do dia. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Último dia do mês do dia. */
export function monthEnd(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return toDay(Date.UTC(y, m, 0, 12)); // dia 0 do mês seguinte = último dia deste
}

/** 1º dia do mês `delta` meses antes (negativo) ou depois (positivo). */
export function addMonths(day: string, delta: number): string {
  const [y, m] = day.split("-").map(Number);
  return toDay(Date.UTC(y, m - 1 + delta, 1, 12));
}

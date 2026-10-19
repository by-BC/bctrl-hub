/** Formatação pt-BR de números e datas (sem I/O). */

const kgFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const intFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** 52.5 → "52,5"; 1234 → "1.234". */
export const formatKg = (kg: number) => kgFormatter.format(kg);
export const formatInt = (n: number) => intFormatter.format(n);

/** Segundos → "1:05". Negativo vira 0. */
export function formatClock(totalSec: number) {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Duração longa (ms) → "1:02:05" ou "12:05". */
export function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Minutos → "45 min" ou "1 h 05 min". */
export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

// Dia "AAAA-MM-DD" é data pura: formata ao meio-dia UTC para não escorregar de fuso.
const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-13" → "ter., 13 de out. de 2026". */
export function formatDay(day: string) {
  return dayFormatter.format(new Date(`${day}T12:00:00Z`));
}

/** Texto do campo numérico → número (aceita vírgula). Vazio ou inválido → null. */
export function parseDecimal(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Reps: só inteiros ≥ 1. */
export function parseReps(text: string): number | null {
  const n = parseDecimal(text);
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null;
}

/** Número para o campo de carga ("52,5"). */
export const kgInputValue = (kg: number | null) => (kg === null ? "" : String(kg).replace(".", ","));

const shortDayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDayYearFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** Dia curto para eixos e tabelas: "2026-10-13" → "13 out" (com `year`: "13 out 26"). */
export function formatShortDay(day: string, { year = false } = {}) {
  const parts = (year ? shortDayYearFormatter : shortDayFormatter).formatToParts(new Date(`${day}T12:00:00Z`));
  return parts
    .filter((p) => p.type === "day" || p.type === "month" || p.type === "year")
    .map((p) => p.value.replace(".", ""))
    .join(" ");
}

const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Números de eixo: 1200 → "1,2 mil"; abaixo de mil, o número normal. */
export const formatCompact = (n: number) => (Math.abs(n) >= 1000 ? compactFormatter.format(n) : formatKg(n));

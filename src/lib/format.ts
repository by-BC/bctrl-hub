/** Formatação pt-BR de números e datas (sem I/O). */

import { FIELDS, type ExerciseType } from "@/lib/domain/exercise-types";

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

// ── Séries por tipo de exercício (duração, distância) ─────────────────────

/** Segundos → "0:45", "12:00" ou "1:02:05". */
export const formatSeconds = (s: number) => formatElapsed(s * 1000);

/** Metros → "800 m" (abaixo de 1 km) ou "2,5 km". */
export function formatDistance(m: number) {
  if (m < 1000) return `${formatKg(Math.round(m * 10) / 10)} m`;
  return `${formatKg(Math.round(m / 10) / 100)} km`;
}

/**
 * Duração digitada → segundos inteiros ≥ 1. Aceita "45" (segundos), "1:30" (mm:ss)
 * e "1:02:05" (h:mm:ss). Vazio ou inválido → null.
 */
export function parseDuration(text: string): number | null {
  const clean = text.trim();
  if (clean === "") return null;
  const parts = clean.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  // Depois do primeiro bloco, minutos e segundos vão até 59.
  if (nums.slice(1).some((n) => n > 59)) return null;
  const total = nums.reduce((acc, n) => acc * 60 + n, 0);
  return total >= 1 ? total : null;
}

/** Segundos → texto do campo de duração ("1:30"). */
export const durationInputValue = (s: number | null) => (s === null ? "" : formatSeconds(s));

/** Distância digitada em km ("2,5") → metros (1 casa). Vazio, zero ou inválido → null. */
export function parseKm(text: string): number | null {
  const km = parseDecimal(text);
  if (km === null || km <= 0) return null;
  return Math.round(km * 10_000) / 10;
}

/** Metros → texto do campo em km ("2,5"). */
export const kmInputValue = (m: number | null) => (m === null ? "" : String(Math.round(m) / 1000).replace(".", ","));

export type SetValues = {
  weightKg: number | null;
  reps: number | null;
  distanceM?: number | null;
  durationS?: number | null;
};

/**
 * Texto da série conforme o tipo do exercício: "60 kg × 10", "12 reps", "+10 kg × 8"
 * (carga extra), "−20 kg × 8" (assistência), "1:00", "2 km · 12:00", "32 kg · 40 m".
 * Com `unit: false`, a carga sai sem "kg" (coluna "anterior": "40 × 10").
 */
export function formatSet(set: SetValues, type: ExerciseType, { unit = true } = {}): string {
  const kg = (w: number) => (unit ? `${formatKg(w)} kg` : formatKg(w));
  const { weightKg: w, reps: r } = set;
  if (FIELDS[type].includes("reps")) {
    if (r === null) return w === null ? "—" : kg(w);
    if (type === "weight_reps") return w === null ? `${r} reps` : `${kg(w)} × ${r}`;
    if (w === null || w === 0) return `${r} reps`;
    return `${type === "bodyweight_assisted_reps" ? "−" : "+"}${kg(w)} × ${r}`;
  }
  const parts: string[] = [];
  for (const field of FIELDS[type]) {
    if (field === "weight" && w !== null) parts.push(kg(w));
    if (field === "distance" && set.distanceM != null) parts.push(formatDistance(Number(set.distanceM)));
    if (field === "duration" && set.durationS != null) parts.push(formatSeconds(set.durationS));
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

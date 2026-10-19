/**
 * Semana do app: segunda a domingo, sobre dias "AAAA-MM-DD" já calculados em
 * America/Sao_Paulo (ver `day.ts`). Sem I/O.
 */

const DAY_MS = 86_400_000;

// Dia é data pura: meio-dia UTC não escorrega de fuso.
const toTime = (day: string) => Date.parse(`${day}T12:00:00Z`);
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Segunda-feira da semana do dia (o próprio dia, se já for segunda). */
export function weekStart(day: string): string {
  const time = toTime(day);
  const isoWeekday = ((new Date(time).getUTCDay() + 6) % 7) + 1; // 1 = segunda … 7 = domingo
  return toDay(time - (isoWeekday - 1) * DAY_MS);
}

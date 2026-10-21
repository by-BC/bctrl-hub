/** Fuso de todas as datas de "dia" do app (colunas `date`). */
export const APP_TIME_ZONE = "America/Sao_Paulo";

// en-CA formata como AAAA-MM-DD.
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia (AAAA-MM-DD) do instante em America/Sao_Paulo. */
export function dayInSaoPaulo(instant: Date | string): string {
  return dayFormatter.format(typeof instant === "string" ? new Date(instant) : instant);
}

const localFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Instante → data e hora locais de São Paulo no formato do `datetime-local` ("AAAA-MM-DDTHH:mm"). */
export function saoPauloLocal(instant: Date | string): string {
  const parts = Object.fromEntries(
    localFormatter.formatToParts(typeof instant === "string" ? new Date(instant) : instant).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Data e hora locais de São Paulo ("AAAA-MM-DDTHH:mm") → instante ISO (UTC). Usa o fuso real da
 * data (inclusive o horário de verão de anos anteriores a 2019). Texto inválido → `null`.
 */
export function saoPauloLocalToInstant(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const asUtc = Date.parse(`${local}:00Z`);
  if (Number.isNaN(asUtc)) return null;
  // Desvio do fuso no instante estimado; repete uma vez para cobrir a virada do horário de verão.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const shown = Date.parse(`${saoPauloLocal(new Date(guess))}:00Z`);
    guess += asUtc - shown;
  }
  return new Date(guess).toISOString();
}

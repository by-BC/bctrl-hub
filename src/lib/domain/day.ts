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

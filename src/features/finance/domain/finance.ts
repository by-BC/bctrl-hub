export const BUCKET_LABELS = {
  fixed: "Custos fixos",
  freedom: "Liberdade financeira",
  variable: "Gastos eventuais",
} as const;

export const SUB_BUCKET_LABELS = {
  comfort: "Conforto",
  pleasures: "Prazeres",
  knowledge: "Conhecimento",
  goals: "Metas",
} as const;

export const ACCOUNT_KIND_LABELS = {
  cash: "Dinheiro",
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
} as const;

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function monthEnd(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  return `${year + (month === 12 ? 1 : 0)}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;
}

function dateInMonth(year: number, monthIndex: number, day: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function recurringDate(monthStart: string, day: number) {
  const [year, month] = monthStart.split("-").map(Number);
  return dateInMonth(year, month - 1, day);
}

export function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Data de vencimento da primeira fatura e dos próximos meses, respeitando fechamento/vencimento. */
export function cardInstallmentDueDates(purchaseDate: string, closingDay: number, dueDay: number, count: number) {
  const [year, month, day] = purchaseDate.split("-").map(Number);
  const closingMonth = day <= closingDay ? month - 1 : month;
  const dueMonth = closingMonth + 1;
  return Array.from({ length: count }, (_, index) => dateInMonth(year, dueMonth + index, dueDay));
}

export function splitInstallments(total: number, count: number) {
  const cents = Math.round(total * 100);
  const each = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) => (each + (index < remainder ? 1 : 0)) / 100);
}

export function percentage(value: number, base: number) {
  return base > 0 ? Math.min(100, (value / base) * 100) : 0;
}

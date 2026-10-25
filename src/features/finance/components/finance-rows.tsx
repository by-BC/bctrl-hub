"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarClock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDay } from "@/lib/format";
import type { FinanceAccount, FinanceCategory, FinanceRecurringRule, FinanceTransaction } from "../api";
import { useDeleteFinanceTransaction, useSaveFinanceTransactions, useSetFinanceInvoicePaid, useSetFinancePaid, useSetFinanceRecurring } from "../hooks";
import { ACCOUNT_KIND_LABELS, BRL, cardInstallmentDueDates, recurringDate } from "../domain/finance";

export type FinanceInvoice = { account: FinanceAccount; dueOn: string; total: number; paid: boolean; count: number };
export function InvoiceCard({ invoice }: { invoice: FinanceInvoice }) {
  const setPaid = useSetFinanceInvoicePaid();
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text"><CreditCard aria-hidden className="size-5" /></span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{invoice.account.name}</h3>
            <p className="text-sm text-muted-foreground">Vence em {formatShortDay(invoice.dueOn)}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${invoice.paid ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-500"}`}>{invoice.paid ? "Paga" : "Em aberto"}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="num text-xl font-semibold">{BRL.format(invoice.total)}</p><p className="text-xs text-muted-foreground">{invoice.count} {invoice.count === 1 ? "lançamento" : "lançamentos"}</p></div>
        <Button variant="outline" className="h-10" disabled={setPaid.isPending} onClick={() => setPaid.mutate({ accountId: invoice.account.id, dueOn: invoice.dueOn, isPaid: !invoice.paid })}>{invoice.paid ? "Reabrir fatura" : "Marcar fatura paga"}</Button>
      </div>
    </article>
  );
}

export function RecurringRow({ rule, month, category, account, alreadyRecorded }: {
  rule: FinanceRecurringRule;
  month: string;
  category?: FinanceCategory;
  account?: FinanceAccount;
  alreadyRecorded: boolean;
}) {
  const setActive = useSetFinanceRecurring();
  const saveRows = useSaveFinanceTransactions();
  const date = recurringDate(month, rule.day_of_month);
  const isInRange = date >= rule.starts_on && (!rule.ends_on || date <= rule.ends_on);

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${rule.kind === "income" ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-500"}`}>
        {rule.kind === "income" ? <ArrowDownLeft aria-hidden className="size-4" /> : <CalendarClock aria-hidden className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{rule.title}</p>
        <p className="text-xs text-muted-foreground">Dia {rule.day_of_month} · {category?.name ?? "Categoria"}{account ? ` · ${account.name}` : ""}</p>
      </div>
      <p className={`num text-sm font-semibold ${rule.kind === "income" ? "text-emerald-600" : ""}`}>{rule.kind === "income" ? "+" : "−"}{BRL.format(Number(rule.amount))}</p>
      {rule.active && isInRange ? (
        <Button variant={alreadyRecorded ? "ghost" : "outline"} className="h-10" disabled={alreadyRecorded || saveRows.isPending} onClick={() => {
          const dueOn = account?.kind === "credit_card" && account.closing_day && account.due_day
            ? cardInstallmentDueDates(date, account.closing_day, account.due_day, 1)[0]
            : date;
          saveRows.mutate([{
            id: crypto.randomUUID(), kind: rule.kind, category_id: rule.category_id, account_id: rule.account_id,
            title: rule.title, amount: rule.amount, occurred_on: date, due_on: dueOn,
            is_paid: rule.kind === "income" || account?.kind !== "credit_card", notes: null,
            recurring_rule_id: rule.id, recurrence_occurrence: date,
          }]);
        }}>{alreadyRecorded ? "Registrado" : "Registrar"}</Button>
      ) : (
        <Button variant="ghost" className="h-10" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: rule.id, active: !rule.active })}>{rule.active ? "Pausar" : "Ativar"}</Button>
      )}
    </li>
  );
}

export function TransactionRow({ row, category, account }: { row: FinanceTransaction; category?: FinanceCategory; account?: FinanceAccount }) {
  const setPaid = useSetFinancePaid();
  const remove = useDeleteFinanceTransaction();
  const isCard = account?.kind === "credit_card";
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${row.kind === "income" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
        {row.kind === "income" ? <ArrowDownLeft aria-hidden className="size-4" /> : <ArrowUpRight aria-hidden className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.title}{row.installment_count ? <span className="ml-1 text-xs text-muted-foreground">{row.installment_number}/{row.installment_count}</span> : null}</p>
        <p className="truncate text-xs text-muted-foreground">{formatShortDay(row.due_on)} · {category?.name ?? "Categoria"}{account ? ` · ${account.name}` : ""}</p>
      </div>
      <p className={`num text-sm font-semibold ${row.kind === "income" ? "text-emerald-600" : ""}`}>{row.kind === "income" ? "+" : "−"}{BRL.format(Number(row.amount))}</p>
      {row.kind === "expense" && !isCard && (
        <Button variant="ghost" className="h-10 px-3 text-xs" disabled={setPaid.isPending} onClick={() => setPaid.mutate({ id: row.id, isPaid: !row.is_paid })}>{row.is_paid ? "Pago" : "Marcar pago"}</Button>
      )}
      <Button variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${row.title}`} disabled={remove.isPending} onClick={() => {
        if (window.confirm(`Excluir “${row.title}” deste lançamento?`)) remove.mutate(row.id);
      }}>×</Button>
    </li>
  );
}

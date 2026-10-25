"use client";

import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, CalendarClock, CreditCard, Plus, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { dayInSaoPaulo } from "@/lib/domain/day";
import { ACCOUNT_KIND_LABELS, BRL, recurringDate } from "../domain/finance";
import type { FinanceAccount, FinanceCategory, FinanceMonthData, FinanceTransaction } from "../api";
import { useFinanceMonth } from "../hooks";
import { FinanceBudget } from "./finance-budget";
import { FinanceAccountDialog, FinanceRecurringDialog, FinanceTransactionDialog } from "./finance-dialogs";
import { InvoiceCard, RecurringRow, TransactionRow } from "./finance-rows";
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthOf = (day: string) => `${day.slice(0, 7)}-01`;

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return next.toISOString().slice(0, 10);
}

const titleMonth = (month: string) => monthFormatter.format(new Date(`${month}T12:00:00Z`));

export function FinanceDashboard() {
  const [month, setMonth] = useState("");
  const [todayDate, setTodayDate] = useState("");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const { data, isPending, isError, refetch } = useFinanceMonth(month);

  useEffect(() => {
    const day = dayInSaoPaulo(new Date());
    setTodayDate(day);
    setMonth(monthOf(day));
  }, []);

  return (
    <>
      <PageHeader title="FinanÃ§as" eyebrow="Controle financeiro">
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" className="size-10" aria-label="MÃªs anterior" onClick={() => setMonth((v) => shiftMonth(v, -1))}>
            <ArrowLeft aria-hidden className="size-4" />
          </Button>
          <label className="sr-only" htmlFor="finance-month">MÃªs</label>
          <input
            id="finance-month"
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)}
            className="h-10 w-[8.75rem] bg-transparent text-center text-sm font-medium outline-none"
          />
          <Button variant="ghost" size="icon" className="size-10" aria-label="PrÃ³ximo mÃªs" onClick={() => setMonth((v) => shiftMonth(v, 1))}>
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        </div>
      </PageHeader>

      {isError ? (
        <section role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>NÃ£o foi possÃ­vel carregar seus dados financeiros.</p>
          <Button variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
        </section>
      ) : isPending || !data ? (
        <div aria-busy="true" aria-label="Carregando finanÃ§as" className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <FinanceContent
          month={month}
          data={data}
          onNewTransaction={() => setTransactionOpen(true)}
          onNewAccount={() => setAccountOpen(true)}
          onNewRecurring={() => setRecurringOpen(true)}
        />
      )}

      {data && (
        <>
          <FinanceTransactionDialog open={transactionOpen} onOpenChange={setTransactionOpen} today={todayDate} categories={data.categories} accounts={data.accounts} />
          <FinanceAccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
          <FinanceRecurringDialog open={recurringOpen} onOpenChange={setRecurringOpen} month={month} categories={data.categories} accounts={data.accounts} />
        </>
      )}
    </>
  );
}

function FinanceContent({
  month,
  data,
  onNewTransaction,
  onNewAccount,
  onNewRecurring,
}: {
  month: string;
  data: NonNullable<ReturnType<typeof useFinanceMonth>["data"]>;
  onNewTransaction: () => void;
  onNewAccount: () => void;
  onNewRecurring: () => void;
}) {
  const income = data.transactions.filter((row) => row.kind === "income").reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = data.transactions.filter((row) => row.kind === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
  const pending = data.transactions.filter((row) => !row.is_paid && row.kind === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
  const categories = useMemo(() => new Map(data.categories.map((item) => [item.id, item])), [data.categories]);
  const accounts = useMemo(() => new Map(data.accounts.map((item) => [item.id, item])), [data.accounts]);
  const invoices = useMemo(() => groupInvoices(data.transactions, accounts), [data.transactions, accounts]);
  const occurrences = useMemo(() => new Set(data.recurringOccurrences.map((row) => `${row.recurring_rule_id}:${row.recurrence_occurrence}`)), [data.recurringOccurrences]);
  const spending = useMemo(() => bucketTotals(data.transactions, categories), [data.transactions, categories]);

  return (
    <div className="space-y-6">
      <section aria-label={`Resumo de ${titleMonth(month)}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Entradas" value={income} icon={ArrowDownLeft} tone="green" />
        <MetricCard label="SaÃ­das" value={expenses} icon={ArrowUpRight} tone="orange" />
        <MetricCard label="Saldo do mÃªs" value={income - expenses} icon={Wallet} tone={income - expenses >= 0 ? "green" : "orange"} />
        <MetricCard label="A pagar" value={pending} icon={CalendarClock} tone="orange" />
      </section>

      <FinanceBudget key={month} month={month} budget={data.budget} actualIncome={income} spent={spending.buckets} subSpent={spending.subBuckets} />

      <section aria-label="AÃ§Ãµes financeiras" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button className="h-12" onClick={onNewTransaction}><Plus aria-hidden className="size-4" />Novo lanÃ§amento</Button>
        <Button variant="outline" className="h-12" onClick={onNewAccount}><CreditCard aria-hidden className="size-4" />Adicionar conta ou cartÃ£o</Button>
        <Button variant="outline" className="h-12" onClick={onNewRecurring}><CalendarClock aria-hidden className="size-4" />Nova recorrÃªncia</Button>
      </section>

      <section aria-labelledby="finance-accounts-title" className="space-y-3">
        <header>
          <h2 id="finance-accounts-title" className="text-lg font-semibold">Contas e cartÃµes</h2>
          <p className="text-sm text-muted-foreground">Identificadores e vencimentos, sem armazenar dados do cartÃ£o.</p>
        </header>
        {data.accounts.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Adicione uma conta ou cartÃ£o para vinculÃ¡-lo aos lanÃ§amentos.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.accounts.map((account) => (
              <li key={account.id} className="min-w-0 rounded-xl border bg-card p-3">
                <p className="truncate font-medium">{account.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{ACCOUNT_KIND_LABELS[account.kind as keyof typeof ACCOUNT_KIND_LABELS]}{account.kind === "credit_card" ? ` Â· fecha dia ${account.closing_day} Â· vence dia ${account.due_day}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="finance-invoices-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="finance-invoices-title" className="text-lg font-semibold">Faturas e vencimentos</h2>
            <p className="text-sm text-muted-foreground">Compras no cartÃ£o agrupadas pela data prevista da fatura.</p>
          </div>
        </div>
        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Adicione um cartÃ£o e registre uma compra para acompanhar as faturas aqui.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {invoices.map((invoice) => <InvoiceCard key={`${invoice.account.id}:${invoice.dueOn}`} invoice={invoice} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="finance-recurring-title" className="space-y-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 id="finance-recurring-title" className="text-lg font-semibold">RecorrÃªncias de {titleMonth(month)}</h2>
            <p className="text-sm text-muted-foreground">Revise cada previsÃ£o e registre quando ela acontecer.</p>
          </div>
        </header>
        {data.recurringRules.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Cadastre salÃ¡rio, aluguel, assinaturas ou outras entradas e contas recorrentes.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {data.recurringRules.map((rule) => (
              <RecurringRow key={rule.id} rule={rule} month={month} category={categories.get(rule.category_id)} account={rule.account_id ? accounts.get(rule.account_id) : undefined} alreadyRecorded={occurrences.has(`${rule.id}:${recurringDate(month, rule.day_of_month)}`)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="finance-transactions-title" className="space-y-3">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 id="finance-transactions-title" className="text-lg font-semibold">LanÃ§amentos do mÃªs</h2>
            <p className="text-sm text-muted-foreground">Organizados pela data de pagamento ou vencimento.</p>
          </div>
          <span className="num text-sm text-muted-foreground">{data.transactions.length} itens</span>
        </header>
        {data.transactions.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhum lanÃ§amento neste mÃªs. Comece pelo planejamento ou registre uma entrada ou saÃ­da.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {data.transactions.map((row) => (
              <TransactionRow key={row.id} row={row} category={categories.get(row.category_id)} account={row.account_id ? accounts.get(row.account_id) : undefined} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Wallet; tone: "green" | "orange" }) {
  return (
    <article className="min-w-0 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon aria-hidden className={`size-4 ${tone === "green" ? "text-emerald-500" : "text-orange-400"}`} />{label}</div>
      <p className="num mt-3 break-words text-xl font-semibold sm:text-2xl">{BRL.format(value)}</p>
    </article>
  );
}

function groupInvoices(transactions: FinanceTransaction[], accounts: Map<string, FinanceAccount>) {
  const grouped = new Map<string, { account: FinanceAccount; dueOn: string; total: number; paid: boolean; count: number }>();
  for (const row of transactions) {
    if (!row.account_id || row.kind !== "expense") continue;
    const account = accounts.get(row.account_id);
    if (!account || account.kind !== "credit_card") continue;
    const key = `${account.id}:${row.due_on}`;
    const invoice = grouped.get(key) ?? { account, dueOn: row.due_on, total: 0, paid: true, count: 0 };
    invoice.total += Number(row.amount);
    invoice.paid &&= row.is_paid;
    invoice.count += 1;
    grouped.set(key, invoice);
  }
  return [...grouped.values()].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

function bucketTotals(transactions: FinanceTransaction[], categories: Map<string, FinanceCategory>) {
  const totals: Record<string, number> = { fixed: 0, freedom: 0, variable: 0 };
  const subTotals: Record<string, number> = { comfort: 0, pleasures: 0, knowledge: 0, goals: 0 };
  for (const row of transactions) {
    if (row.kind !== "expense") continue;
    const category = categories.get(row.category_id);
    if (category?.bucket) totals[category.bucket] += Number(row.amount);
    if (category?.sub_bucket) subTotals[category.sub_bucket] += Number(row.amount);
  }
  return { buckets: totals, subBuckets: subTotals };
}

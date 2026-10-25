"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import type { FinanceCategory, FinanceTransaction } from "../api";
import { BRL } from "../domain/finance";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function FinanceCharts({ month, transactions, categories }: {
  month: string;
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
}) {
  const [, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), monthNumber, 0)).getUTCDate();
  const daily = Array.from({ length: days }, (_, index) => ({ day: index + 1, entradas: 0, saídas: 0 }));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, number>();

  for (const row of transactions) {
    const date = Number(row.occurred_on.slice(8, 10));
    if (date >= 1 && date <= days) daily[date - 1][row.kind === "income" ? "entradas" : "saídas"] += Number(row.amount);
    if (row.kind === "expense") {
      const name = categoryNames.get(row.category_id) ?? "Sem categoria";
      totals.set(name, (totals.get(name) ?? 0) + Number(row.amount));
    }
  }

  const topCategories = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const pieData = topCategories.slice(0, 5).map(([name, value]) => ({ name, value }));
  if (topCategories.length > 5) pieData.push({ name: "Outras", value: topCategories.slice(5).reduce((sum, [, value]) => sum + value, 0) });
  const hasDailyData = daily.some((item) => item.entradas || item.saídas);

  return <section aria-label="Gráficos financeiros do mês" className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
    <article className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="mb-3"><h2 className="font-semibold">Entradas e saídas por dia</h2><p className="text-sm text-muted-foreground">Valores agrupados pela data da compra ou movimentação.</p></header>
      {hasDailyData ? <div className="[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-axis-tick-value]:text-xs [&_.recharts-surface]:outline-none">
        <BarChart responsive data={daily} margin={{ top: 6, right: 4, bottom: 0, left: -18 }} style={{ width: "100%", height: 240 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
          <YAxis tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toLocaleString("pt-BR")} mil` : String(value)} tickLine={false} axisLine={false} width={52} />
          <Tooltip formatter={(value) => BRL.format(Number(value))} labelFormatter={(label) => `Dia ${label}`} contentStyle={{ borderRadius: 12, borderColor: "var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} />
          <Bar dataKey="entradas" name="Entradas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="saídas" name="Saídas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </div> : <p className="grid h-60 place-items-center text-sm text-muted-foreground">Ainda não há lançamentos neste mês.</p>}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground"><span><i className="mr-2 inline-block size-2 rounded-full bg-[var(--chart-2)]" />Entradas</span><span><i className="mr-2 inline-block size-2 rounded-full bg-[var(--chart-1)]" />Saídas</span></div>
    </article>

    <article className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="mb-1"><h2 className="font-semibold">Despesas por categoria</h2><p className="text-sm text-muted-foreground">Distribuição das saídas do mês.</p></header>
      {pieData.length ? <>
        <div className="[&_.recharts-surface]:outline-none"><PieChart responsive style={{ width: "100%", height: 220 }}>
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
            {pieData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => BRL.format(Number(value))} contentStyle={{ borderRadius: 12, borderColor: "var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} />
        </PieChart></div>
        <ul className="space-y-2" aria-label="Valores por categoria">{pieData.map((item, index) => <li key={item.name} className="flex min-w-0 items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><i className="size-2.5 shrink-0 rounded-sm" style={{ background: COLORS[index % COLORS.length] }} /><span className="truncate">{item.name}</span></span><strong className="num shrink-0">{BRL.format(item.value)}</strong></li>)}</ul>
      </> : <p className="grid h-60 place-items-center text-sm text-muted-foreground">Sem despesas para categorizar neste mês.</p>}
    </article>
  </section>;
}

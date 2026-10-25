import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";
import type { FinanceAccountSave, FinanceBudgetSave, FinanceRecurringSave } from "./schemas/finance";

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const financeKeys = {
  all: ["finance"] as const,
  month: (month: string) => ["finance", month] as const,
};

export type FinanceCategory = Tables<"finance_categories">;
export type FinanceAccount = Tables<"finance_accounts">;
export type FinanceBudget = Tables<"finance_monthly_budgets">;
export type FinanceRecurringRule = Tables<"finance_recurring_rules">;
export type FinanceTransaction = Tables<"finance_transactions">;
export type FinanceTransactionSave = TablesInsert<"finance_transactions">;

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

export type FinanceMonthData = {
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
  budget: FinanceBudget | null;
  transactions: FinanceTransaction[];
  recurringOccurrences: FinanceTransaction[];
  recurringRules: FinanceRecurringRule[];
};

export async function fetchFinanceMonth(month: string, client: Client = db()): Promise<FinanceMonthData> {
  const end = monthEnd(month);
  const [categories, accounts, budget, transactions, recurringOccurrences, recurringRules] = await Promise.all([
    client.from("finance_categories").select("*").order("kind").order("name"),
    client.from("finance_accounts").select("*").order("created_at"),
    client.from("finance_monthly_budgets").select("*").eq("month_start", month).maybeSingle(),
    client.from("finance_transactions").select("*").gte("due_on", month).lt("due_on", end)
      .order("due_on", { ascending: false }).order("created_at", { ascending: false }),
    client.from("finance_transactions").select("*").gte("recurrence_occurrence", month).lt("recurrence_occurrence", end)
      .not("recurring_rule_id", "is", null),
    client.from("finance_recurring_rules").select("*").order("active", { ascending: false }).order("day_of_month"),
  ]);

  if (categories.error) fail(categories.error, "Não foi possível carregar as categorias financeiras.");
  if (accounts.error) fail(accounts.error, "Não foi possível carregar as contas financeiras.");
  if (budget.error) fail(budget.error, "Não foi possível carregar o orçamento do mês.");
  if (transactions.error) fail(transactions.error, "Não foi possível carregar os lançamentos.");
  if (recurringOccurrences.error) fail(recurringOccurrences.error, "Não foi possível carregar as ocorrências recorrentes.");
  if (recurringRules.error) fail(recurringRules.error, "Não foi possível carregar as recorrências.");

  return {
    categories: categories.data,
    accounts: accounts.data,
    budget: budget.data,
    transactions: transactions.data,
    recurringOccurrences: recurringOccurrences.data,
    recurringRules: recurringRules.data,
  };
}

export async function saveFinanceTransactions(rows: FinanceTransactionSave[], client: Client = db()) {
  if (rows.length === 0) return;
  const { error } = await client.from("finance_transactions").upsert(rows, {
    onConflict: "user_id,installment_group_id,installment_number",
    defaultToNull: false,
  });
  if (error) fail(error, "Não foi possível salvar o lançamento financeiro.");
}

export async function saveFinanceBudget(row: FinanceBudgetSave & { id: string }, client: Client = db()) {
  const { error } = await client.from("finance_monthly_budgets").upsert(row, {
    onConflict: "user_id,month_start",
    defaultToNull: false,
  });
  if (error) fail(error, "Não foi possível salvar o orçamento do mês.");
}

export async function saveFinanceAccount(row: FinanceAccountSave & { id: string }, client: Client = db()) {
  const { error } = await client.from("finance_accounts").upsert(row, { defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a conta financeira.");
}

export async function saveFinanceRecurringRule(row: FinanceRecurringSave & { id: string }, client: Client = db()) {
  const { error } = await client.from("finance_recurring_rules").upsert(row, { defaultToNull: false });
  if (error) fail(error, "Não foi possível salvar a recorrência.");
}

export async function setFinanceRecurringActive(id: string, active: boolean, client: Client = db()) {
  const { error } = await client.from("finance_recurring_rules").update({ active }).eq("id", id);
  if (error) fail(error, "Não foi possível atualizar a recorrência.");
}

export async function createFinanceCategory(
  row: Pick<FinanceCategory, "id" | "name" | "kind" | "bucket" | "sub_bucket">,
  client: Client = db(),
) {
  const { error } = await client.from("finance_categories").insert(row);
  if (error) fail(error, "Não foi possível criar a categoria.");
}

export async function setFinanceTransactionPaid(id: string, isPaid: boolean, client: Client = db()) {
  const { error } = await client.from("finance_transactions").update({ is_paid: isPaid }).eq("id", id);
  if (error) fail(error, "Não foi possível atualizar o status do lançamento.");
}

export async function setFinanceInvoicePaid(
  { accountId, dueOn, isPaid }: { accountId: string; dueOn: string; isPaid: boolean },
  client: Client = db(),
) {
  const { error } = await client.from("finance_transactions").update({ is_paid: isPaid })
    .eq("account_id", accountId).eq("due_on", dueOn).eq("kind", "expense");
  if (error) fail(error, "Não foi possível atualizar a fatura.");
}

export async function deleteFinanceTransaction(id: string, client: Client = db()) {
  const { data: transaction, error: lookupError } = await client.from("finance_transactions")
    .select("installment_group_id").eq("id", id).single();
  if (lookupError) fail(lookupError, "Não foi possível localizar o lançamento.");
  const query = client.from("finance_transactions").delete();
  const { error } = transaction.installment_group_id
    ? await query.eq("installment_group_id", transaction.installment_group_id)
    : await query.eq("id", id);
  if (error) fail(error, "Não foi possível excluir o lançamento.");
}

export function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year + (monthNumber === 12 ? 1 : 0)}-${String(monthNumber === 12 ? 1 : monthNumber + 1).padStart(2, "0")}-01`;
}

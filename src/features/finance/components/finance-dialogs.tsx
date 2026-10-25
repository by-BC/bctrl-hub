"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FinanceAccount, FinanceCategory } from "../api";
import { useCreateFinanceCategory, useSaveFinanceAccount, useSaveFinanceRecurring, useSaveFinanceTransactions } from "../hooks";
import { financeAccountSchema, financeRecurringSchema, financeTitleSchema, financeTransactionSchema } from "../schemas/finance";
import { ACCOUNT_KIND_LABELS, cardInstallmentDueDates, defaultFinanceCategoryColor, lastDayOfMonth, splitInstallments } from "../domain/finance";
export function FinanceTransactionDialog({ open, onOpenChange, today, categories, accounts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
}) {
  const save = useSaveFinanceTransactions();
  const createCategory = useCreateFinanceCategory();
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [bucket, setBucket] = useState<"fixed" | "freedom" | "variable">("variable");
  const [subBucket, setSubBucket] = useState<"comfort" | "pleasures" | "knowledge" | "goals">("comfort");
  const [error, setError] = useState<string | null>(null);
  const chosenAccount = accounts.find((item) => item.id === accountId);
  const availableCategories = categories.filter((item) => item.kind === kind && item.is_active);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = financeTransactionSchema.safeParse({
      kind,
      category_id: categoryId || String(form.get("category_id") ?? ""),
      account_id: String(form.get("account_id") ?? "") || null,
      title: String(form.get("title") ?? ""),
      amount: Number(String(form.get("amount") ?? "").replace(",", ".")),
      occurred_on: String(form.get("occurred_on") ?? ""),
      is_paid: chosenAccount?.kind === "credit_card" ? false : form.get("is_paid") === "on",
      installment_count: Number(form.get("installment_count") ?? 1),
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revise os dados do lançamento.");
    if (kind === "income" && parsed.data.installment_count > 1) return setError("Parcelamento só está disponível para despesas no cartão.");
    const category = categories.find((item) => item.id === parsed.data.category_id);
    if (!category) return setError("Escolha uma categoria válida.");
    const count = chosenAccount?.kind === "credit_card" && kind === "expense" ? parsed.data.installment_count : 1;
    const dueDates = chosenAccount?.kind === "credit_card" && chosenAccount.closing_day && chosenAccount.due_day
      ? cardInstallmentDueDates(parsed.data.occurred_on, chosenAccount.closing_day, chosenAccount.due_day, count)
      : Array.from({ length: count }, () => parsed.data.occurred_on);
    const amounts = splitInstallments(parsed.data.amount, count);
    const groupId = count > 1 ? crypto.randomUUID() : null;
    const rows = amounts.map((amount, index) => ({
      id: crypto.randomUUID(), kind, category_id: parsed.data.category_id, account_id: parsed.data.account_id,
      title: parsed.data.title, amount, occurred_on: parsed.data.occurred_on, due_on: dueDates[index],
      is_paid: chosenAccount?.kind === "credit_card" ? false : parsed.data.is_paid,
      notes: parsed.data.notes, installment_group_id: groupId,
      installment_number: groupId ? index + 1 : null, installment_count: groupId ? count : null,
    }));
    save.mutate(rows, { onSuccess: () => { toast.success("Lançamento salvo."); onOpenChange(false); } });
    setError(null);
  }

  async function submitCategory() {
    const parsed = financeTitleSchema.max(80).safeParse(categoryName);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Informe uma categoria válida.");
    const id = crypto.randomUUID();
    try {
      await createCategory.mutateAsync({ id, name: parsed.data, kind, bucket: kind === "income" ? null : bucket, sub_bucket: kind === "income" || bucket !== "variable" ? null : subBucket, color: defaultFinanceCategoryColor(parsed.data) });
      setCategoryId(id);
      setCategoryName("");
      setCategoryOpen(false);
      setError(null);
    } catch {
      setError("Não foi possível criar a categoria. Confira se ela já existe.");
    }
  }

  return (
    <FinanceDialog open={open} onOpenChange={onOpenChange} title="Novo lançamento" description="Registre uma entrada ou saída. Compras parceladas são distribuídas pelas faturas previstas.">
      <div className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((value) => <Button key={value} type="button" variant={kind === value ? "default" : "outline"} className="h-11" onClick={() => { setKind(value); setCategoryId(""); if (value === "income" && chosenAccount?.kind === "credit_card") setAccountId(""); setError(null); }}>{value === "expense" ? "Saída" : "Entrada"}</Button>)}
      </div>
      <form onSubmit={submit} className="max-h-[65dvh] space-y-3 overflow-y-auto px-0.5">
        <Field label="Descrição"><input name="title" required maxLength={140} autoFocus placeholder={kind === "expense" ? "Ex.: mercado, aluguel…" : "Ex.: salário, renda extra…"} className={fieldClass} /></Field>
        <Field label="Valor total"><input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" max="9999999999.99" required placeholder="0,00" className={fieldClass} /></Field>
        <Field label="Categoria">
          <select name="category_id" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
            <option value="">Selecione uma categoria</option>
            {availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        {!categoryOpen ? (
          <Button type="button" variant="ghost" className="h-9 px-2 text-xs" onClick={() => setCategoryOpen(true)}>+ Criar categoria</Button>
        ) : (
          <div className="space-y-2 rounded-xl border p-3">
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} maxLength={80} placeholder="Nome da categoria" className={fieldClass} />
            {kind === "expense" && <select value={bucket} onChange={(e) => setBucket(e.target.value as typeof bucket)} className={fieldClass}><option value="fixed">Custos fixos</option><option value="freedom">Liberdade financeira</option><option value="variable">Gastos eventuais</option></select>}
            {kind === "expense" && bucket === "variable" && <select value={subBucket} onChange={(e) => setSubBucket(e.target.value as typeof subBucket)} className={fieldClass}><option value="comfort">Conforto</option><option value="pleasures">Prazeres</option><option value="knowledge">Conhecimento</option><option value="goals">Metas</option></select>}
            <Button type="button" variant="outline" className="h-9" disabled={createCategory.isPending} onClick={submitCategory}>Salvar categoria</Button>
          </div>
        )}
        <Field label="Conta ou cartão">
          <select name="account_id" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldClass}>
            <option value="">Sem conta vinculada</option>
            {accounts.filter((item) => kind !== "income" || item.kind !== "credit_card").map((item) => <option key={item.id} value={item.id}>{item.name} · {ACCOUNT_KIND_LABELS[item.kind as keyof typeof ACCOUNT_KIND_LABELS]}</option>)}
          </select>
        </Field>
        <Field label="Data da compra ou recebimento"><input name="occurred_on" type="date" defaultValue={today} required className={fieldClass} /></Field>
        {chosenAccount?.kind === "credit_card" && kind === "expense" && (
          <Field label="Parcelas"><input name="installment_count" type="number" min="1" max="60" step="1" defaultValue="1" className={fieldClass} /><span className="mt-1 block text-xs text-muted-foreground">Até 60 parcelas. Cada parte será lançada na fatura correspondente.</span></Field>
        )}
        {chosenAccount?.kind !== "credit_card" && kind === "expense" && <label className="flex min-h-10 items-center gap-2 text-sm"><input name="is_paid" type="checkbox" defaultChecked /> Já foi pago</label>}
        <Field label="Observação (opcional)"><textarea name="notes" maxLength={500} rows={2} className={`${fieldClass} h-auto py-2`} /></Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar lançamento"}</Button>
      </form>
    </FinanceDialog>
  );
}

export function FinanceAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const save = useSaveFinanceAccount();
  const [kind, setKind] = useState<"cash" | "checking" | "savings" | "credit_card">("credit_card");
  const [error, setError] = useState<string | null>(null);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = financeAccountSchema.safeParse({
      name: String(form.get("name") ?? ""), kind,
      closing_day: kind === "credit_card" ? Number(form.get("closing_day")) : null,
      due_day: kind === "credit_card" ? Number(form.get("due_day")) : null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revise os dados da conta.");
    save.mutate({ id: crypto.randomUUID(), ...parsed.data }, { onSuccess: () => { toast.success("Conta adicionada."); onOpenChange(false); } });
    setError(null);
  }
  return (
    <FinanceDialog open={open} onOpenChange={onOpenChange} title="Adicionar conta ou cartão" description="Para proteger seus dados, não guardamos número do cartão, senha ou código de segurança.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nome para identificar"><input name="name" required maxLength={80} placeholder="Ex.: Cartão principal" className={fieldClass} /></Field>
        <Field label="Tipo"><select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={fieldClass}><option value="credit_card">Cartão de crédito</option><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="cash">Dinheiro</option></select></Field>
        {kind === "credit_card" && <div className="grid grid-cols-2 gap-3"><Field label="Dia de fechamento"><input name="closing_day" type="number" min="1" max="31" required placeholder="20" className={fieldClass} /></Field><Field label="Dia de vencimento"><input name="due_day" type="number" min="1" max="31" required placeholder="5" className={fieldClass} /></Field></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Adicionar"}</Button>
      </form>
    </FinanceDialog>
  );
}

export function FinanceRecurringDialog({ open, onOpenChange, month, categories, accounts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
}) {
  const save = useSaveFinanceRecurring();
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const monthDate = `${month.slice(0, 7)}-01`;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ends = String(form.get("ends_on") ?? "");
    const parsed = financeRecurringSchema.safeParse({
      title: String(form.get("title") ?? ""), kind,
      category_id: categoryId || String(form.get("category_id") ?? ""),
      account_id: accountId || null,
      amount: Number(String(form.get("amount") ?? "").replace(",", ".")),
      day_of_month: Number(form.get("day_of_month")), starts_on: monthDate, ends_on: ends ? lastDayOfMonth(`${ends}-01`) : null,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revise a recorrência.");
    save.mutate({ id: crypto.randomUUID(), ...parsed.data }, { onSuccess: () => { toast.success("Recorrência salva."); onOpenChange(false); } });
    setError(null);
  }
  return (
    <FinanceDialog open={open} onOpenChange={onOpenChange} title="Nova recorrência" description="A recorrência cria uma previsão mensal. Você confirma cada ocorrência antes de registrá-la.">
      <div className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((value) => <Button key={value} type="button" variant={kind === value ? "default" : "outline"} className="h-11" onClick={() => { setKind(value); setCategoryId(""); if (value === "income" && accounts.find((item) => item.id === accountId)?.kind === "credit_card") setAccountId(""); }}>{value === "expense" ? "Conta" : "Entrada"}</Button>)}
      </div>
      <form onSubmit={submit} className="max-h-[65dvh] space-y-3 overflow-y-auto">
        <Field label="Descrição"><input name="title" required maxLength={140} placeholder="Aluguel, salário…" className={fieldClass} /></Field>
        <Field label="Valor"><input name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" required className={fieldClass} /></Field>
        <Field label="Categoria"><select name="category_id" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}><option value="">Selecione</option>{categories.filter((item) => item.kind === kind && item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Conta ou cartão (opcional)"><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldClass}><option value="">Sem conta vinculada</option>{accounts.filter((item) => kind !== "income" || item.kind !== "credit_card").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Dia do mês"><input name="day_of_month" type="number" min="1" max="31" defaultValue="5" required className={fieldClass} /></Field><Field label="Último mês (opcional)"><input name="ends_on" type="month" className={fieldClass} /></Field></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar recorrência"}</Button>
      </form>
    </FinanceDialog>
  );
}

const fieldClass = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1.5"><span className="block text-sm font-medium">{label}</span>{children}</label>;
}

function FinanceDialog({ open, onOpenChange, title, description, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <Button type="button" variant="ghost" className="h-10 w-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}

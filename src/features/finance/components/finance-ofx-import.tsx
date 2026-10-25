"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FinanceAccount, FinanceCategory } from "../api";
import { fetchFinanceOfxImportReferences } from "../api";
import { useSaveFinanceAccount, useSaveFinanceTransactions } from "../hooks";
import type { FinanceTransactionSave } from "../api";
import { isCardBillPayment, ofxImportKey, parseOfx, type OfxStatement, type OfxTransaction } from "../domain/ofx";

const inputClass = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function findCategory(categories: FinanceCategory[], kind: "income" | "expense", description: string) {
  const value = normalize(description);
  const categoriesByDescription: Array<[RegExp, string]> = [
    [/aluguel|moradia|condominio/, "Moradia (aluguel/financiamento)"],
    [/energia|eletric|agua|gas|conta da casa/, "Contas da casa"],
    [/internet|celular|telefone|vivo|claro|tim|oi\b/, "Internet e celular"],
    [/supermercado|mercado|atacadao|assai|carrefour|hortifruti|mercearia/, "Supermercado"],
    [/uber|99\b|posto|combustivel|estacionamento|onibus|passagem/, "Transporte"],
    [/farmacia|drogaria|hospital|clinica|consulta|medico|exame|saude/, "Saúde"],
    [/netflix|spotify|streaming|prime video|disney|assinatura/, "Streaming e assinaturas"],
    [/restaurante|delivery|ifood|lanchonete|pizzaria|cafe\b/, "Restaurantes e delivery"],
    [/roupa|vestuario|renner|riachuelo|zara|c&a\b/, "Compras e vestuário"],
    [/cinema|show|teatro|lazer|entretenimento/, "Lazer e entretenimento"],
    [/curso|livro|udemy|faculdade|educacao/, "Cursos e livros"],
  ];
  const choices = kind === "income"
    ? value.includes("salario") ? ["Salário", "Renda extra"] : ["Renda extra", "Salário"]
    : [...categoriesByDescription.filter(([pattern]) => pattern.test(value)).map(([, name]) => name), "Outros eventuais"];
  const category = choices.map((name) => categories.find((item) => item.kind === kind && item.name === name)).find(Boolean);
  return category?.id;
}

function shiftMonth(day: string, monthDelta: number) {
  const [year, month, date] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + monthDelta, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(date, lastDay)).padStart(2, "0")}`;
}

function addDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function rowFor(transaction: OfxTransaction, statement: OfxStatement, accountId: string, categoryId: string, dueOn: string, note: string): FinanceTransactionSave {
  const kind = transaction.amount < 0 ? "expense" : "income";
  return {
    id: crypto.randomUUID(), kind, category_id: categoryId, account_id: accountId,
    title: transaction.title.slice(0, 140), amount: Math.round(Math.abs(transaction.amount) * 100) / 100,
    occurred_on: transaction.date, due_on: dueOn,
    is_paid: statement.accountKind === "checking", notes: note,
  };
}

export function FinanceOfxImport({ open, onOpenChange, categories, accounts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
}) {
  const saveAccount = useSaveFinanceAccount();
  const saveRows = useSaveFinanceTransactions();
  const [statements, setStatements] = useState<OfxStatement[]>([]);
  const [cardDueOn, setCardDueOn] = useState("");
  const [checkingAccountId, setCheckingAccountId] = useState("");
  const [cardAccountId, setCardAccountId] = useState("");
  const [closingDay, setClosingDay] = useState("5");
  const [dueDay, setDueDay] = useState("12");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkingAccounts = accounts.filter((item) => item.kind === "checking");
  const cards = accounts.filter((item) => item.kind === "credit_card");
  const transactionCount = statements.reduce((total, statement) => total + statement.transactions.length, 0);
  const installmentCount = statements.reduce((total, statement) => total + statement.transactions.filter((item) => item.installment).length, 0);
  const billPaymentCount = statements.filter((s) => s.accountKind === "checking").reduce((total, s) => total + s.transactions.filter(isCardBillPayment).length, 0);
  const cardStatement = statements.find((statement) => statement.accountKind === "credit_card");

  const sample = useMemo(() => statements.flatMap((statement) => statement.transactions.slice(0, 4).map((transaction) => ({ statement, transaction }))), [statements]);

  async function readFiles(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    try {
      const parsed = await Promise.all(files.map(async (file) => parseOfx(file.name, await file.text())));
      setStatements(parsed);
      const due = parsed.find((item) => item.accountKind === "credit_card")?.dueOn;
      setCardDueOn(due ?? "");
      const card = cards.find((item) => item.name.toLowerCase().includes("nubank")) ?? cards[0];
      if (card) {
        setCardAccountId(card.id);
      }
      setClosingDay("5");
      setDueDay("12");
      const checking = checkingAccounts.find((item) => item.name.toLowerCase().includes("nubank")) ?? checkingAccounts[0];
      if (checking) setCheckingAccountId(checking.id);
    } catch (cause) {
      setStatements([]);
      setError(cause instanceof Error ? cause.message : "Não foi possível ler o OFX.");
    } finally {
      input.value = "";
    }
  }

  async function importStatements() {
    if (!statements.length) return;
    if (cardStatement && !cardDueOn) return setError("Informe a data de vencimento da fatura do cartão.");
    setBusy(true);
    setError(null);
    try {
      const references = await fetchFinanceOfxImportReferences();
      const uniqueRows: FinanceTransactionSave[] = [];
      const seenKeys = new Set<string>();
      let skippedBillPayments = 0;
      let skippedDuplicates = 0;

      for (const statement of statements) {
        for (const transaction of statement.transactions) {
          if (statement.accountKind === "checking" && isCardBillPayment(transaction)) {
            skippedBillPayments++;
            continue;
          }
          const reference = ofxImportKey(statement.accountKind, transaction);
          const referencePrefix = `OFX_IMPORT:${reference}:`;
          if (references.some((note) => note.startsWith(referencePrefix)) || seenKeys.has(reference)) {
            skippedDuplicates++;
            continue;
          }
          seenKeys.add(reference);

          const transactionKind = transaction.amount < 0 ? "expense" : "income";
          const categoryId = findCategory(categories, transactionKind, transaction.detail);
          if (!categoryId) throw new Error(`Não encontrei uma categoria padrão para “${transaction.title}”.`);
          const noteBase = `${referencePrefix}${transaction.fitId || "fingerprint"}`;
          if (transaction.installment && statement.accountKind === "credit_card") {
            const accountId = cardAccountId || cards[0]?.id;
            const groupId = crypto.randomUUID();
            for (let number = 1; number <= transaction.installment.total; number++) {
              const dueOn = shiftMonth(cardDueOn, number - transaction.installment.current);
              const row = rowFor(transaction, statement, accountId ?? "", categoryId, dueOn, `${noteBase}|installment=${number}`);
              uniqueRows.push({ ...row, installment_group_id: groupId, installment_number: number, installment_count: transaction.installment.total, is_paid: number < transaction.installment.current });
            }
            continue;
          }
          const accountId = statement.accountKind === "credit_card" ? cardAccountId || cards[0]?.id : checkingAccountId || checkingAccounts[0]?.id;
          const dueOn = statement.accountKind === "credit_card" ? cardDueOn : transaction.date;
          uniqueRows.push(rowFor(transaction, statement, accountId ?? "", categoryId, dueOn, noteBase));
        }
      }

      if (uniqueRows.length === 0) {
        toast.info("Esses OFX já foram importados; não encontrei novos lançamentos.");
        return;
      }

      const bankStatement = statements.find((item) => item.accountKind === "checking");
      let bankAccountId = checkingAccountId || checkingAccounts[0]?.id;
      if (bankStatement && !bankAccountId && uniqueRows.some((row) => row.notes?.startsWith("OFX_IMPORT:checking:"))) {
        bankAccountId = crypto.randomUUID();
        await saveAccount.mutateAsync({ id: bankAccountId, name: "Conta Nubank", kind: "checking", closing_day: null, due_day: null });
      }

      let activeCardId = cardAccountId || cards[0]?.id;
      if (cardStatement && activeCardId) {
        const card = cards.find((item) => item.id === activeCardId);
        if (card) await saveAccount.mutateAsync({ id: card.id, name: card.name, kind: "credit_card", closing_day: Number(closingDay), due_day: Number(dueDay) });
      } else if (cardStatement) {
        activeCardId = crypto.randomUUID();
        await saveAccount.mutateAsync({ id: activeCardId, name: "Cartão Nubank", kind: "credit_card", closing_day: Number(closingDay), due_day: Number(dueDay) });
      }

      const resolvedRows = uniqueRows.map((row) => ({
        ...row,
        account_id: row.account_id || (row.notes?.startsWith("OFX_IMPORT:credit_card:") ? activeCardId : bankAccountId) || null,
      }));
      await saveRows.mutateAsync(resolvedRows);
      toast.success(`${resolvedRows.length} lançamentos importados. ${skippedBillPayments} pagamento(s) de fatura e ${skippedDuplicates} duplicado(s) ignorados.`);
      setStatements([]);
      setCardDueOn("");
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar os extratos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar extratos OFX</DialogTitle>
          <DialogDescription>O arquivo é lido neste navegador. Só os lançamentos são enviados ao seu perfil; números de conta e cartão não são salvos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">Selecione os arquivos da conta e do cartão
            <input type="file" accept=".ofx,application/x-ofx,text/plain" multiple onChange={readFiles} className={`${inputClass} h-auto py-2`} />
          </label>

          {statements.length > 0 && (
            <>
              <div className="space-y-2 rounded-xl border p-3 text-sm">
                {statements.map((statement) => <p key={statement.fileName} className="flex flex-wrap justify-between gap-x-3"><span className="min-w-0 truncate">{statement.accountKind === "credit_card" ? "Cartão de crédito" : "Conta corrente"} · {statement.startDate ?? ""}{statement.endDate ? ` a ${statement.endDate}` : ""}</span><strong>{statement.transactions.length} lançamentos</strong></p>)}
                <p>{installmentCount} compras parceladas encontradas. {billPaymentCount} pagamento(s) de fatura serão ignorados para evitar duplicidade.</p>
              </div>

              {cardStatement && (
                <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">Cartão
                    <select value={cardAccountId} onChange={(event) => setCardAccountId(event.target.value)} className={inputClass}>
                      {cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
                      {cards.length === 0 && <option value="">Criar Cartão Nubank</option>}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">Vencimento desta fatura
                    <input type="date" value={cardDueOn} onChange={(event) => setCardDueOn(event.target.value)} className={inputClass} required />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">Fechamento do cartão
                    <input type="number" min="1" max="31" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} className={inputClass} />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">Vencimento padrão
                    <input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} className={inputClass} />
                  </label>
                  <p className="text-xs text-muted-foreground sm:col-span-2">O cadastro selecionado será atualizado com os dias informados para calcular as próximas parcelas.</p>
                </div>
              )}

              {statements.some((statement) => statement.accountKind === "checking") && checkingAccounts.length > 0 && (
                <label className="block space-y-1.5 text-sm font-medium">Conta corrente
                  <select value={checkingAccountId} onChange={(event) => setCheckingAccountId(event.target.value)} className={inputClass}>{checkingAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
                </label>
              )}
              {statements.some((statement) => statement.accountKind === "checking") && checkingAccounts.length === 0 && <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Será criada uma conta chamada “Conta Nubank”, sem número de conta.</p>}

              <div className="space-y-1 rounded-xl border p-3">
                <p className="text-sm font-semibold">Prévia dos lançamentos</p>
                <ul className="divide-y text-sm">
                  {sample.slice(0, 6).map(({ statement, transaction }) => <li key={`${statement.fileName}:${transaction.fitId}`} className="flex min-w-0 justify-between gap-3 py-2"><span className="min-w-0 truncate">{transaction.title}{transaction.installment ? ` · ${transaction.installment.current}/${transaction.installment.total}` : ""}</span><span className="shrink-0">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(transaction.amount))}</span></li>)}
                </ul>
                {transactionCount > 6 && <p className="text-xs text-muted-foreground">Exibindo 6 de {transactionCount}; os demais serão importados na mesma operação.</p>}
              </div>
            </>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" className="h-11" disabled={!statements.length || busy || saveRows.isPending || saveAccount.isPending} onClick={importStatements}>{busy ? "Importando…" : "Importar lançamentos"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

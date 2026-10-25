"use client";

import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FinanceAccount, FinanceCategory } from "../api";
import { financeKeys } from "../api";

const inputClass = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm";
type Preview = {
  statements: Array<{ fileName: string; accountKind: "checking" | "credit_card"; startDate: string | null; endDate: string | null; count: number }>;
  transactionCount: number;
  installmentCount: number;
  billPaymentCount: number;
  dueOn: string | null;
  samples: Array<{ accountKind: string; title: string; category: string; amount: number; installment: { current: number; total: number } | null }>;
};

export function FinanceOfxImport({ open, onOpenChange, categories: _categories, accounts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  accounts: FinanceAccount[];
}) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cardDueOn, setCardDueOn] = useState("");
  const [checkingAccountId, setCheckingAccountId] = useState("");
  const [cardAccountId, setCardAccountId] = useState("");
  const [closingDay, setClosingDay] = useState("5");
  const [dueDay, setDueDay] = useState("12");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkingAccounts = accounts.filter((item) => item.kind === "checking");
  const cards = accounts.filter((item) => item.kind === "credit_card");
  const hasCard = preview?.statements.some((statement) => statement.accountKind === "credit_card") ?? false;
  const hasChecking = preview?.statements.some((statement) => statement.accountKind === "checking") ?? false;

  async function request(mode: "preview" | "import") {
    const form = new FormData();
    form.set("mode", mode);
    files.forEach((file) => form.append("files", file));
    if (mode === "import") {
      form.set("checkingAccountId", checkingAccountId);
      form.set("cardAccountId", cardAccountId);
      form.set("cardDueOn", cardDueOn);
      form.set("closingDay", closingDay);
      form.set("dueDay", dueDay);
    }
    const response = await fetch("/api/finance/ofx", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível processar o OFX.");
    return result;
  }

  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    setFiles(selected);
    setPreview(null);
    setError(null);
    if (!selected.length) return;
    setBusy(true);
    try {
      const result = await request("preview") as Preview;
      setPreview(result);
      setCardDueOn(result.dueOn ?? "");
      const card = cards.find((item) => item.name.toLowerCase().includes("nubank")) ?? cards[0];
      const checking = checkingAccounts.find((item) => item.name.toLowerCase().includes("nubank")) ?? checkingAccounts[0];
      setCardAccountId(card?.id ?? "");
      setCheckingAccountId(checking?.id ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível processar o OFX.");
      setFiles([]);
    } finally { setBusy(false); }
  }

  async function importStatements() {
    if (!preview || (hasCard && !cardDueOn)) return setError("Informe a data de vencimento da fatura do cartão.");
    setBusy(true);
    setError(null);
    try {
      const result = await request("import") as { imported: number; skippedBills: number; skippedDuplicates: number };
      if (result.imported) toast.success(`${result.imported} lançamentos importados. ${result.skippedBills} pagamento(s) de fatura e ${result.skippedDuplicates} duplicado(s) ignorados.`);
      else toast.info("Esses OFX já foram importados; não encontrei novos lançamentos.");
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      setFiles([]); setPreview(null); setCardDueOn(""); onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar os extratos.");
    } finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Importar extratos OFX</DialogTitle>
        <DialogDescription>Os arquivos são enviados com sua sessão ao servidor, onde os dados são tratados antes da gravação no Supabase. Números de conta e cartão não são armazenados.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium">Selecione os arquivos da conta e do cartão
          <input type="file" accept=".ofx,application/x-ofx,text/plain" multiple onChange={selectFiles} className={`${inputClass} h-auto py-2`} />
        </label>
        {busy && !preview && <p className="text-sm text-muted-foreground">Lendo e categorizando os arquivos no servidor…</p>}
        {preview && <>
          <div className="space-y-2 rounded-xl border p-3 text-sm">
            {preview.statements.map((statement) => <p key={statement.fileName} className="flex flex-wrap justify-between gap-x-3"><span>{statement.accountKind === "credit_card" ? "Cartão de crédito" : "Conta corrente"} · {statement.startDate ?? ""}{statement.endDate ? ` a ${statement.endDate}` : ""}</span><strong>{statement.count} lançamentos</strong></p>)}
            <p>{preview.installmentCount} compras parceladas. {preview.billPaymentCount} pagamento(s) de fatura serão ignorados para evitar duplicidade.</p>
          </div>
          {hasCard && <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">Cartão<select value={cardAccountId} onChange={(event) => setCardAccountId(event.target.value)} className={inputClass}><option value="">Criar Cartão Nubank</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium">Vencimento desta fatura<input type="date" value={cardDueOn} onChange={(event) => setCardDueOn(event.target.value)} className={inputClass} required /></label>
            <label className="space-y-1.5 text-sm font-medium">Fechamento do cartão<input type="number" min="1" max="31" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5 text-sm font-medium">Vencimento padrão<input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} className={inputClass} /></label>
            <p className="text-xs text-muted-foreground sm:col-span-2">O cartão escolhido será atualizado com esses dias de fechamento e vencimento.</p>
          </div>}
          {hasChecking && checkingAccounts.length > 0 && <label className="block space-y-1.5 text-sm font-medium">Conta corrente<select value={checkingAccountId} onChange={(event) => setCheckingAccountId(event.target.value)} className={inputClass}>{checkingAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
          {hasChecking && checkingAccounts.length === 0 && <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Será criada uma conta chamada “Conta Nubank”, sem número de conta.</p>}
          <div className="space-y-1 rounded-xl border p-3"><p className="text-sm font-semibold">Prévia categorizada pelo servidor</p><ul className="divide-y text-sm">{preview.samples.map((item, index) => <li key={`${item.title}:${index}`} className="flex min-w-0 justify-between gap-3 py-2"><span className="min-w-0 truncate">{item.title} <span className="text-muted-foreground">· {item.category}{item.installment ? ` · ${item.installment.current}/${item.installment.total}` : ""}</span></span><span className="shrink-0">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.amount)}</span></li>)}</ul>{preview.transactionCount > 6 && <p className="text-xs text-muted-foreground">Exibindo 6 de {preview.transactionCount}; os demais seguem a mesma classificação.</p>}</div>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" className="h-11" disabled={!preview || busy} onClick={importStatements}>{busy ? "Processando…" : "Importar lançamentos"}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}

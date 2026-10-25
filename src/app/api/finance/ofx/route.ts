import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCardBillPayment, ofxImportKey, parseOfx, type OfxStatement, type OfxTransaction } from "@/features/finance/domain/ofx";

export const maxDuration = 30;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 2;

function classify(text: string) {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bifd\s*\*|ifood/.test(value)) return { title: "iFood", category: "Restaurantes e delivery" };
  if (/uber/.test(value)) return { title: "Uber", category: "Transporte" };
  const rules: Array<[RegExp, string]> = [
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
  return { title: text.slice(0, 140), category: rules.find(([pattern]) => pattern.test(value))?.[1] ?? "Outros eventuais" };
}

function shiftMonth(day: string, delta: number) {
  const [year, month, date] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + delta, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(date, last)).padStart(2, "0")}`;
}

async function readStatements(form: FormData): Promise<OfxStatement[]> {
  const files = form.getAll("files");
  if (!files.length || files.length > MAX_FILES || files.some((file) => !(file instanceof File) || file.size > MAX_FILE_BYTES || !file.name.toLowerCase().endsWith(".ofx"))) {
    throw new Error("Selecione até 2 arquivos OFX válidos, com no máximo 2 MB cada.");
  }
  return Promise.all((files as File[]).map(async (file) => parseOfx(file.name.slice(0, 120), await file.text())));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES * MAX_FILES + 64_000) return NextResponse.json({ error: "Arquivos OFX acima do limite permitido." }, { status: 413 });

  try {
    const form = await request.formData();
    const mode = form.get("mode");
    if (mode !== "preview" && mode !== "import") return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
    const statements = await readStatements(form);
    const rows = statements.flatMap((statement) => statement.transactions.map((transaction) => ({ statement, transaction, normalized: classify(transaction.title), detail: classify(transaction.detail) })));

    if (mode === "preview") {
      return NextResponse.json({
        statements: statements.map(({ fileName, accountKind, startDate, endDate, transactions }) => ({ fileName, accountKind, startDate, endDate, count: transactions.length })),
        transactionCount: rows.length,
        installmentCount: rows.filter(({ transaction }) => transaction.installment).length,
        billPaymentCount: rows.filter(({ statement, transaction }) => statement.accountKind === "checking" && isCardBillPayment(transaction)).length,
        samples: rows.slice(0, 6).map(({ statement, transaction, normalized, detail }) => ({ accountKind: statement.accountKind, title: normalized.title, category: detail.category, amount: Math.abs(transaction.amount), installment: transaction.installment })),
        dueOn: statements.find((statement) => statement.accountKind === "credit_card")?.dueOn ?? null,
      });
    }

    const checkingId = String(form.get("checkingAccountId") ?? "");
    const cardId = String(form.get("cardAccountId") ?? "");
    const cardDueOn = String(form.get("cardDueOn") ?? "");
    const closingDay = Number(form.get("closingDay") ?? 5);
    const dueDay = Number(form.get("dueDay") ?? 12);
    if (rows.some(({ statement }) => statement.accountKind === "credit_card") && (!/^\d{4}-\d{2}-\d{2}$/.test(cardDueOn) || closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31)) {
      return NextResponse.json({ error: "Confira vencimento e dias de fechamento do cartão." }, { status: 400 });
    }

    const [{ data: categories, error: categoryError }, { data: accounts, error: accountError }, { data: prior, error: priorError }] = await Promise.all([
      supabase.from("finance_categories").select("id,name,kind"),
      supabase.from("finance_accounts").select("id,name,kind,closing_day,due_day"),
      supabase.from("finance_transactions").select("notes").like("notes", "OFX_IMPORT:%"),
    ]);
    if (categoryError || accountError || priorError) throw new Error("Não foi possível carregar os dados financeiros.");

    const existingIds = new Set((accounts ?? []).map((account) => account.id));
    for (const accountId of [checkingId, cardId].filter(Boolean)) {
      if (!existingIds.has(accountId)) return NextResponse.json({ error: "Conta selecionada inválida." }, { status: 400 });
    }
    const notes = new Set((prior ?? []).flatMap((row) => row.notes ? [row.notes] : []));
    const seen = new Set<string>();
    const categoryFor = (name: string, kind: string) => categories?.find((item) => item.name === name && item.kind === kind)?.id;
    const inserts: Array<Record<string, unknown>> = [];
    let skippedBills = 0;
    let skippedDuplicates = 0;
    let bankAccountId = checkingId || null;
    let activeCardId = cardId || null;

    if (statements.some((statement) => statement.accountKind === "checking") && !bankAccountId) {
      const { data, error } = await supabase.from("finance_accounts").insert({ name: "Conta Nubank", kind: "checking", closing_day: null, due_day: null }).select("id").single();
      if (error) throw new Error("Não foi possível preparar a conta corrente.");
      bankAccountId = data.id;
    }
    if (statements.some((statement) => statement.accountKind === "credit_card")) {
      if (activeCardId) {
        const { error } = await supabase.from("finance_accounts").update({ closing_day: closingDay, due_day: dueDay }).eq("id", activeCardId);
        if (error) throw new Error("Não foi possível atualizar o cartão.");
      } else {
        const { data, error } = await supabase.from("finance_accounts").insert({ name: "Cartão Nubank", kind: "credit_card", closing_day: closingDay, due_day: dueDay }).select("id").single();
        if (error) throw new Error("Não foi possível criar o cartão.");
        activeCardId = data.id;
      }
    }

    for (const { statement, transaction, normalized, detail } of rows) {
      if (statement.accountKind === "checking" && isCardBillPayment(transaction)) { skippedBills++; continue; }
      const key = ofxImportKey(statement.accountKind, transaction);
      const prefix = `OFX_IMPORT:${key}:`;
      if (seen.has(key) || [...notes].some((note) => note.startsWith(prefix))) { skippedDuplicates++; continue; }
      seen.add(key);
      const kind = transaction.amount < 0 ? "expense" : "income";
      const categoryName = kind === "income" ? "Renda extra" : detail.category;
      const categoryId = categoryFor(categoryName, kind);
      if (!categoryId) return NextResponse.json({ error: `Categoria não encontrada: ${categoryName}.` }, { status: 422 });
      const accountId = statement.accountKind === "credit_card" ? activeCardId : bankAccountId;
      const note = `${prefix}${transaction.fitId || "fingerprint"}`;
      const base = { kind, category_id: categoryId, account_id: accountId, title: normalized.title.slice(0, 140), amount: Math.round(Math.abs(transaction.amount) * 100) / 100, occurred_on: transaction.date, due_on: statement.accountKind === "credit_card" ? cardDueOn : transaction.date, is_paid: statement.accountKind === "checking", notes: note };
      if (statement.accountKind === "credit_card" && transaction.installment) {
        const group = randomUUID();
        for (let number = 1; number <= transaction.installment.total; number++) inserts.push({ ...base, due_on: shiftMonth(cardDueOn, number - transaction.installment.current), is_paid: number < transaction.installment.current, installment_group_id: group, installment_number: number, installment_count: transaction.installment.total, notes: `${note}|installment=${number}` });
      } else inserts.push(base);
    }

    if (inserts.length) {
      const { error } = await supabase.from("finance_transactions").insert(inserts as never[]);
      if (error) throw new Error("Não foi possível gravar os lançamentos OFX.");
    }
    return NextResponse.json({ imported: inserts.length, skippedBills, skippedDuplicates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível processar o OFX.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Selecione") ? 400 : 422 });
  }
}

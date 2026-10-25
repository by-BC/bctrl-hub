export type OfxInstallment = { current: number; total: number };

export type OfxTransaction = {
  date: string;
  amount: number;
  type: string;
  fitId: string;
  title: string;
  detail: string;
  installment: OfxInstallment | null;
};

export type OfxStatement = {
  fileName: string;
  accountKind: "checking" | "credit_card";
  startDate: string | null;
  endDate: string | null;
  dueOn: string | null;
  transactions: OfxTransaction[];
};

function tagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)(?=<\\/?[A-Z0-9_]+>|$)`, "i"));
  return match?.[1]?.trim().replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">") ?? "";
}

function ofxDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function dateFromFileName(fileName: string) {
  const match = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function installmentFrom(text: string): OfxInstallment | null {
  const match = text.match(/\bparc(?:ela)?\s*(?:n[ºo.]?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i);
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  return current >= 1 && total >= current && total <= 60 ? { current, total } : null;
}

function cleanTitle(value: string) {
  const cleaned = value.replace(/\s*[-–|,]?\s*parc(?:ela)?\s*(?:n[ºo.]?\s*)?\d{1,2}\s*(?:\/|de)\s*\d{1,2}\b/i, "").replace(/\s+/g, " ").trim();
  const normalized = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bifd\s*\*/i.test(cleaned) || /ifood/.test(normalized)) return "iFood";
  if (/uber/.test(normalized)) return "Uber";
  return cleaned;
}

export function parseOfx(fileName: string, text: string): OfxStatement {
  const accountKind = /<CCSTMTRS>/i.test(text) ? "credit_card" : "checking";
  const startDate = ofxDate(tagValue(text, "DTSTART"));
  const endDate = ofxDate(tagValue(text, "DTEND"));
  const dueOn = accountKind === "credit_card" ? dateFromFileName(fileName) : null;
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi)];
  if (blocks.length === 0) throw new Error("Não encontrei lançamentos OFX nesse arquivo.");

  const transactions = blocks.map((entry, index): OfxTransaction => {
    const block = entry[1];
    const posted = ofxDate(tagValue(block, "DTPOSTED"));
    const amount = Number(tagValue(block, "TRNAMT").replace(",", "."));
    if (!posted || !Number.isFinite(amount) || amount === 0) {
      throw new Error(`O lançamento ${index + 1} tem data ou valor inválido.`);
    }
    const name = tagValue(block, "NAME");
    const memo = tagValue(block, "MEMO");
    const description = [name, memo].filter(Boolean).join(" · ");
    const title = cleanTitle(name || memo || tagValue(block, "TRNTYPE"));
    if (!title) throw new Error(`O lançamento ${index + 1} não tem descrição.`);
    return {
      date: posted,
      amount,
      type: tagValue(block, "TRNTYPE").toUpperCase(),
      fitId: tagValue(block, "FITID"),
      title,
      detail: description,
      installment: installmentFrom(description),
    };
  });

  return { fileName, accountKind, startDate, endDate, dueOn, transactions };
}

export function isCardBillPayment(transaction: OfxTransaction) {
  const value = transaction.detail.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /fatura/.test(value) && /(pagamento|pgto|cartao|credito)/.test(value);
}

export function ofxImportKey(accountKind: OfxStatement["accountKind"], transaction: OfxTransaction) {
  const sourceId = transaction.fitId || `${transaction.date}:${transaction.amount}:${transaction.title}`;
  return `${accountKind}:${sourceId.replace(/[|\s]/g, "_")}`;
}

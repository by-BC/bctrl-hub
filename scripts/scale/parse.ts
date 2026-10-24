/**
 * Importação da planilha da balança (task 2.0 v3): funções puras de leitura e de geração do SQL.
 *
 * Formato da exportação do app da balança (aba única):
 *   título · "Sexo：… Idade：… Altura：…" (dois-pontos de largura total) · período · cabeçalho · dados.
 * O cabeçalho é achado pelo texto "Data" e as colunas são mapeadas pelo NOME (não pela posição).
 * Os dados vêm em texto: "31/05/2026", "08:53", "80.00". Vazio ou "--" = métrica ausente (null).
 * Faixas e chaves: `METRICS` de src/lib/domain/composition.ts (as mesmas dos checks do banco).
 */

import ExcelJS from "exceljs";
import { METRIC, METRICS, type MetricKey } from "../../src/features/composition/domain/composition";
import { APP_TIME_ZONE } from "../../src/lib/domain/day";

export type ScaleProfile = { sex?: string; age?: number; heightCm?: number };

export type ParsedMeasurement = {
  /** Linha da planilha (1 = primeira linha). */
  row: number;
  /** Instante em ISO com o offset de São Paulo ("2026-03-01T08:00:00-03:00"). */
  measured_at: string;
  /** Dia (AAAA-MM-DD) em São Paulo: o `day` de `body_measurements`. */
  day: string;
  /** As 17 métricas; `null` = não medida. O peso é sempre um número válido. */
  values: Record<MetricKey, number | null>;
};

export type Skipped = { row: number; reason: string };
export type ValueWarning = { row: number; metric: MetricKey; value: string; reason: string };

export type ScaleSheet = {
  header: ScaleProfile;
  measurements: ParsedMeasurement[];
  skipped: Skipped[];
  warnings: ValueWarning[];
  /** Colunas do cabeçalho que o parser não conhece (ignoradas). */
  unknownColumns: string[];
  /** Métricas sem coluna na planilha (ficam null em todas as medições). */
  missingColumns: MetricKey[];
  /** Linhas de dados lidas (sem contar as totalmente vazias). */
  rowsRead: number;
};

// ── Leitura do .xlsx ─────────────────────────────────────────────────────

/** Valor de célula do exceljs reduzido a texto, número, data ou null. */
function plainCell(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof Date) return v;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return plainCell(v.result as ExcelJS.CellValue);
    if ("text" in v) return typeof v.text === "string" ? v.text : null;
  }
  return null;
}

/** Linhas da primeira aba (índice 0 = linha 1 da planilha), com as linhas vazias preservadas. */
export async function readSheetRows(data: Buffer | ArrayBuffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  // O tipo de `load` do exceljs pede o Buffer antigo do Node; o conteúdo é o mesmo.
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("A planilha não tem nenhuma aba.");
  const rows: unknown[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: unknown[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(plainCell(row.getCell(c).value));
    rows.push(cells);
  }
  return rows;
}

// ── Cabeçalho ────────────────────────────────────────────────────────────

const text = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
};

/** Nome de coluna comparável: minúsculas, sem acento, sem espaços. */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");

type Field = "date" | "time" | MetricKey;

/** Nomes da exportação (PT) → chave. Comparados por `norm`. */
const COLUMNS: Record<string, Field> = Object.fromEntries(
  (
    [
      ["Data", "date"],
      ["Tempo", "time"],
      ["Peso(Kg)", "weight_kg"],
      ["IMC", "bmi"],
      ["Gordura(%)", "body_fat_pct"],
      ["Peso da gordura(Kg)", "fat_mass_kg"],
      ["Percentual da massa muscular esquelética(%)", "skeletal_muscle_pct"],
      ["Peso da massa muscular esquelética(Kg)", "skeletal_muscle_kg"],
      ["Registro de massa muscular(%)", "muscle_rate_pct"],
      ["Peso da massa muscular(Kg)", "muscle_mass_kg"],
      ["Gordura visceral", "visceral_fat"],
      ["Água(%)", "water_pct"],
      ["peso da água(Kg)", "water_kg"],
      ["Metabolismo(kcal / dia)", "bmr_kcal"],
      ["Obesidade(%)", "obesity_pct"],
      ["Ossos(Kg)", "bone_kg"],
      ["Proteína(%)", "protein_pct"],
      ["LBM(Kg)", "lean_mass_kg"],
      ["Idade metabólica", "metabolic_age"],
    ] as const
  ).map(([name, key]) => [norm(name), key]),
);

/** "Sexo：Masculino", "Idade：40Anos", "Altura：175cm" (aceita também o dois-pontos comum). */
function parseProfile(rows: unknown[][]): ScaleProfile {
  const profile: ScaleProfile = {};
  for (const row of rows) {
    for (const cell of row) {
      const m = text(cell).match(/^([^：:]+)[：:]\s*(.+)$/);
      if (!m) continue;
      const key = norm(m[1]);
      const value = m[2].trim();
      const num = value.match(/\d+(?:[.,]\d+)?/);
      if (key === "sexo") profile.sex = value;
      else if (key === "idade" && num) profile.age = Number(num[0].replace(",", "."));
      else if (key === "altura" && num) profile.heightCm = Number(num[0].replace(",", "."));
    }
  }
  return profile;
}

// ── Datas (America/Sao_Paulo) ────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

type Ymd = { y: number; m: number; d: number };
type Hm = { h: number; min: number };

function parseDate(v: unknown): Ymd | null {
  if (v instanceof Date) {
    // O exceljs entrega datas como hora de parede em UTC.
    return Number.isNaN(v.getTime()) ? null : { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate() };
  }
  const m = text(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function parseTime(v: unknown): Hm | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { h: v.getUTCHours(), min: v.getUTCMinutes() };
  if (typeof v === "number" && v >= 0 && v < 1) {
    // Fração do dia (hora digitada como número no Excel).
    const total = Math.round(v * 24 * 60);
    return { h: Math.floor(total / 60), min: total % 60 };
  }
  const m = text(v).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? { h, min } : null;
}

const tzParts = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** Offset de São Paulo (minutos; -180 = UTC-3) no instante `t`. */
function offsetMinutes(t: number): number {
  const p = Object.fromEntries(tzParts.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - t) / 60_000);
}

/** Hora de parede de São Paulo → ISO com offset. Robusto a horário de verão (histórico). */
function zonedIso({ y, m, d }: Ymd, { h, min }: Hm): { iso: string; day: string } {
  const wall = Date.UTC(y, m - 1, d, h, min);
  let offset = offsetMinutes(wall);
  const second = offsetMinutes(wall - offset * 60_000);
  if (second !== offset) offset = second;
  const sign = offset <= 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const day = `${y}-${pad(m)}-${pad(d)}`;
  return { iso: `${day}T${pad(h)}:${pad(min)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`, day };
}

// ── Números ──────────────────────────────────────────────────────────────

type NumResult = { kind: "absent" } | { kind: "invalid"; raw: string } | { kind: "ok"; value: number; raw: string };

function parseNumber(v: unknown): NumResult {
  if (typeof v === "number") return Number.isFinite(v) ? { kind: "ok", value: v, raw: String(v) } : { kind: "invalid", raw: String(v) };
  const raw = text(v);
  if (raw === "" || raw === "--") return { kind: "absent" };
  // Ponto decimal (formato da exportação); vírgula aceita por segurança.
  const s = raw.includes(".") ? raw : raw.replace(",", ".");
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return { kind: "invalid", raw };
  return { kind: "ok", value: Number(s), raw };
}

const fmtRange = (key: MetricKey) => `${METRIC[key].min}–${METRIC[key].max}`;
const inRange = (key: MetricKey, n: number) => n >= METRIC[key].min && n <= METRIC[key].max;

// ── Parser ───────────────────────────────────────────────────────────────

export function parseScaleSheet(rows: unknown[][]): ScaleSheet {
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(text(c)) === "data"));
  if (headerIdx < 0) throw new Error('Linha de cabeçalho não encontrada (nenhuma célula "Data").');

  const columns = new Map<Field, number>();
  const unknownColumns: string[] = [];
  rows[headerIdx].forEach((cell, i) => {
    const name = text(cell);
    if (!name) return;
    const field = COLUMNS[norm(name)];
    if (field && !columns.has(field)) columns.set(field, i);
    else unknownColumns.push(name);
  });
  for (const required of ["date", "time", "weight_kg"] as const) {
    if (!columns.has(required)) throw new Error(`Coluna obrigatória ausente no cabeçalho: ${required}.`);
  }
  const missingColumns = METRICS.map((m) => m.key).filter((k) => !columns.has(k));

  const measurements: ParsedMeasurement[] = [];
  const skipped: Skipped[] = [];
  const warnings: ValueWarning[] = [];
  const seen = new Map<number, { row: number; signature: string }>();
  let rowsRead = 0;

  rows.slice(headerIdx + 1).forEach((cells, i) => {
    const row = headerIdx + 2 + i;
    if (cells.every((c) => text(c) === "")) return;
    rowsRead++;
    const at = (f: Field) => {
      const idx = columns.get(f);
      return idx === undefined ? null : cells[idx];
    };
    const skip = (reason: string) => skipped.push({ row, reason });

    const rawDate = at("date");
    const date = parseDate(rawDate);
    if (!date) return skip(text(rawDate) ? `data ausente ou inválida (${text(rawDate)})` : "data ausente ou inválida");
    const rawTime = at("time");
    const time = parseTime(rawTime);
    if (!time) return skip(text(rawTime) ? `hora ausente ou inválida (${text(rawTime)})` : "hora ausente ou inválida");

    const weight = parseNumber(at("weight_kg"));
    if (weight.kind === "absent") return skip("peso ausente");
    if (weight.kind === "invalid") return skip(`peso inválido (${weight.raw})`);
    if (!inRange("weight_kg", weight.value)) return skip(`peso fora da faixa ${fmtRange("weight_kg")} kg (${weight.raw})`);

    const { iso, day } = zonedIso(date, time);
    const instant = Date.parse(iso);
    // O banco identifica a medição por (user_id, measured_at), com precisão de minuto: fica a
    // primeira linha da planilha (a exportação vem da mais recente para a mais antiga).
    const signature = cells.map(text).join(" ");
    const first = seen.get(instant);
    if (first !== undefined) {
      const same = first.signature === signature ? "valores idênticos" : "valores diferentes";
      return skip(`data e hora repetidas (mesma medição da linha ${first.row}; ${same})`);
    }
    seen.set(instant, { row, signature });

    const values = {} as Record<MetricKey, number | null>;
    for (const def of METRICS) {
      if (def.key === "weight_kg") {
        values.weight_kg = weight.value;
        continue;
      }
      const n = parseNumber(at(def.key));
      values[def.key] = null;
      if (n.kind === "absent") continue;
      if (n.kind === "invalid") warnings.push({ row, metric: def.key, value: n.raw, reason: "não numérico" });
      else if (!inRange(def.key, n.value)) warnings.push({ row, metric: def.key, value: n.raw, reason: `fora da faixa ${fmtRange(def.key)}` });
      else if (def.integer && !Number.isInteger(n.value)) warnings.push({ row, metric: def.key, value: n.raw, reason: "deve ser inteiro" });
      else values[def.key] = n.value;
    }
    measurements.push({ row, measured_at: iso, day, values });
  });

  measurements.sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  return {
    header: parseProfile(rows.slice(0, headerIdx)),
    measurements,
    skipped,
    warnings,
    unknownColumns,
    missingColumns,
    rowsRead,
  };
}

// ── SQL privado ──────────────────────────────────────────────────────────

/** Colunas de `body_measurements`, na ordem da migration (e da planilha). */
const SQL_COLUMNS: readonly MetricKey[] = [
  "weight_kg",
  "bmi",
  "body_fat_pct",
  "fat_mass_kg",
  "skeletal_muscle_pct",
  "skeletal_muscle_kg",
  "muscle_rate_pct",
  "muscle_mass_kg",
  "visceral_fat",
  "water_pct",
  "water_kg",
  "bmr_kcal",
  "obesity_pct",
  "bone_kg",
  "protein_pct",
  "lean_mass_kg",
  "metabolic_age",
];

const EMAIL_RE = /^[^\s'"\\;]+@[^\s'"\\;]+\.[^\s'"\\;]+$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "null");

/**
 * SQL privado (`supabase/scale.private.sql`): um bloco com o dono resolvido por e-mail e um
 * upsert por `(user_id, measured_at)`. Mesmas medições → mesmo texto (ordem cronológica).
 * O trigger `sync_body_weight` grava o peso de cada dia em `body_weights` (`source = 'scale'`).
 */
export function toSql(ms: readonly ParsedMeasurement[], ownerEmail: string): string {
  if (!EMAIL_RE.test(ownerEmail)) throw new Error("E-mail do dono inválido.");
  if (ms.length === 0) throw new Error("Nenhuma medição para gerar o SQL.");
  const sorted = [...ms].sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  for (const m of sorted) {
    if (!ISO_RE.test(m.measured_at) || !DAY_RE.test(m.day)) throw new Error(`Data inválida na linha ${m.row}.`);
  }
  const first = sorted[0].day;
  const last = sorted[sorted.length - 1].day;

  const values = sorted.map((m, i) => {
    const sep = i === sorted.length - 1 ? "" : ",";
    const metrics = SQL_COLUMNS.map((k) => num(m.values[k])).join(", ");
    return `    (v_uid, '${m.measured_at}', '${m.day}', ${metrics}, 'import')${sep}`;
  });

  return [
    "-- Medições da balança (gerado por scripts/scale/run.ts --write). DADOS PESSOAIS: não versionar.",
    "-- Idempotente: upsert por (user_id, measured_at); rodar de novo não duplica.",
    "-- Aplicar: npx supabase db query --linked -f supabase/scale.private.sql",
    `-- ${sorted.length} medições, de ${first} a ${last}.`,
    "",
    "do $scale$",
    "declare",
    `  v_uid uuid := (select id from auth.users where email = '${ownerEmail}');`,
    "begin",
    "  if v_uid is null then",
    "    raise exception 'Usuário dono não encontrado em auth.users.';",
    "  end if;",
    "",
    `  insert into public.body_measurements (user_id, measured_at, day, ${SQL_COLUMNS.join(", ")}, source) values`,
    ...values,
    "  on conflict (user_id, measured_at) do update set",
    "    day = excluded.day,",
    ...SQL_COLUMNS.map((k) => `    ${k} = excluded.${k},`),
    "    source = excluded.source;",
    "end",
    "$scale$;",
    "",
  ].join("\n");
}

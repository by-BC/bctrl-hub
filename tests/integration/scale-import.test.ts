import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseScaleSheet, readSheetRows, toSql } from "../../scripts/scale/parse";
import { fakeRow, fakeSheetRows, fakeWorkbook } from "../fixtures/scale/workbook";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Importação da planilha da balança (task 2.0 v3): o SQL gerado a partir da planilha FICTÍCIA é
 * aplicado duas vezes no Supabase LOCAL, para um usuário descartável que já tem um peso manual.
 */

let owner: TestUser;
let dir: string;
let sqlFile: string;

/** Aplica o arquivo no banco local com a mesma CLI usada no remoto (sem --linked). */
function applySql(file: string) {
  // Caminho gerado por mkdtemp (sem entrada externa).
  execSync(`npx supabase db query --local -f "${file}"`, { stdio: ["ignore", "ignore", "pipe"] });
}

async function state(userId: string) {
  const db = adminClient();
  const { data: ms, error: e1 } = await db
    .from("body_measurements")
    .select("measured_at, day, weight_kg, body_fat_pct, metabolic_age, source")
    .eq("user_id", userId)
    .order("measured_at");
  if (e1) throw e1;
  const { data: ws, error: e2 } = await db
    .from("body_weights")
    .select("day, weight_kg, source")
    .eq("user_id", userId)
    .order("day");
  if (e2) throw e2;
  return { measurements: ms, weights: ws };
}

beforeAll(async () => {
  owner = await createTestUser("scale-import");
  // Peso manual num dia sem medição: precisa continuar intocado.
  const { error } = await owner.client
    .from("body_weights")
    .insert({ id: crypto.randomUUID(), day: "2026-02-20", weight_kg: 73.5, source: "manual" });
  if (error) throw error;

  const noFat = fakeRow("03/03/2026", "07:00", "72.30");
  noFat[4] = "--";
  const rows = fakeSheetRows([
    fakeRow("03/03/2026", "21:30", "72.00"), // mesmo dia, mais tarde: este peso vence
    noFat,
    fakeRow("02/03/2026", "23:45", "72.40"), // depois das 21h: já é dia 3 em UTC
    fakeRow("", "08:00", "72.80"), // ignorada
    fakeRow("01/03/2026", "08:00", "72.80"),
  ]);
  const sheet = parseScaleSheet(await readSheetRows(await fakeWorkbook(rows)));
  expect(sheet.skipped).toHaveLength(1);
  dir = mkdtempSync(join(tmpdir(), "bctrl-scale-"));
  sqlFile = join(dir, "scale.private.sql");
  writeFileSync(sqlFile, toSql(sheet.measurements, owner.email));
}, 60_000);

afterAll(async () => {
  await deleteTestUser(owner);
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("importação da planilha da balança no Supabase local", () => {
  it("aplica duas vezes sem duplicar, e o trigger grava o peso de cada dia", async () => {
    applySql(sqlFile);
    const first = await state(owner.id);

    expect(first.measurements).toEqual([
      { measured_at: "2026-03-01T11:00:00+00:00", day: "2026-03-01", weight_kg: 72.8, body_fat_pct: 18.5, metabolic_age: 30, source: "import" },
      { measured_at: "2026-03-03T02:45:00+00:00", day: "2026-03-02", weight_kg: 72.4, body_fat_pct: 18.5, metabolic_age: 30, source: "import" },
      { measured_at: "2026-03-03T10:00:00+00:00", day: "2026-03-03", weight_kg: 72.3, body_fat_pct: null, metabolic_age: 30, source: "import" },
      { measured_at: "2026-03-04T00:30:00+00:00", day: "2026-03-03", weight_kg: 72, body_fat_pct: 18.5, metabolic_age: 30, source: "import" },
    ]);
    expect(first.weights).toEqual([
      { day: "2026-02-20", weight_kg: 73.5, source: "manual" },
      { day: "2026-03-01", weight_kg: 72.8, source: "scale" },
      { day: "2026-03-02", weight_kg: 72.4, source: "scale" },
      { day: "2026-03-03", weight_kg: 72, source: "scale" },
    ]);

    applySql(sqlFile);
    expect(await state(owner.id)).toEqual(first);
  }, 120_000);

  it("e-mail sem usuário: o SQL falha sem gravar nada", async () => {
    const other = join(dir, "other.private.sql");
    const sheet = parseScaleSheet(fakeSheetRows());
    writeFileSync(other, toSql(sheet.measurements, `ninguem-${crypto.randomUUID()}@bctrl.test`));
    expect(() => applySql(other)).toThrow();
  }, 60_000);
});

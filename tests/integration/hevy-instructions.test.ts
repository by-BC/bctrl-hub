import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildInstructionsSql } from "../../scripts/hevy/instructions";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Instruções próprias (task 3.0 v2): o SQL privado é aplicado duas vezes no Supabase LOCAL
 * e só toca nos exercícios do dono, achados pelo `hevy_template_id`.
 */

let owner: TestUser;
let other: TestUser;
let dir: string;
let sqlFile: string;

const instructions = {
  "79D0BB3A": "Posição: deitado no banco.\nExecução: desça a barra até o peito.\nRespiração: solte o ar ao empurrar.",
  "0c268b35-f171-474a-bc97-e56260acdd90": "Antes: aqueça. Técnica: golpeie à frente do corpo; com 'aspas'.",
  FFFFFFFF: "Modelo que o dono não tem: não cria nada.",
};

function applySql(file: string) {
  // Caminho gerado por mkdtemp (sem entrada externa).
  execSync(`npx supabase db query --local -f "${file}"`, { stdio: ["ignore", "ignore", "pipe"] });
}

async function seed(user: TestUser) {
  const { error } = await adminClient()
    .from("exercises")
    .insert([
      { user_id: user.id, name: "Supino Reto (Barra)", hevy_template_id: "79D0BB3A", source: "hevy", instructions: null },
      { user_id: user.id, name: "Beach Tenis", hevy_template_id: "0c268b35-f171-474a-bc97-e56260acdd90", source: "hevy_custom", instructions: null },
      { user_id: user.id, name: "Exercício do app", hevy_template_id: null, source: "bctrl", instructions: "Texto escrito no app." },
    ]);
  if (error) throw error;
}

async function read(user: TestUser) {
  const { data, error } = await adminClient()
    .from("exercises")
    .select("name, instructions")
    .eq("user_id", user.id)
    .order("name");
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  [owner, other] = await Promise.all([createTestUser("instr-owner"), createTestUser("instr-other")]);
  await Promise.all([seed(owner), seed(other)]);
  dir = mkdtempSync(join(tmpdir(), "bctrl-instr-"));
  sqlFile = join(dir, "instructions.private.sql");
  writeFileSync(sqlFile, buildInstructionsSql({ ownerEmail: owner.email, instructions }));
}, 60_000);

afterAll(async () => {
  await Promise.all([deleteTestUser(owner), deleteTestUser(other)]);
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("instruções próprias no Supabase local", () => {
  it("grava por hevy_template_id só no dono, sem criar linhas, e é idempotente", async () => {
    applySql(sqlFile);
    const first = await read(owner);
    expect(first).toEqual([
      { name: "Beach Tenis", instructions: instructions["0c268b35-f171-474a-bc97-e56260acdd90"] },
      { name: "Exercício do app", instructions: "Texto escrito no app." },
      { name: "Supino Reto (Barra)", instructions: instructions["79D0BB3A"] },
    ]);

    applySql(sqlFile);
    expect(await read(owner)).toEqual(first);

    // O outro usuário (mesmos modelos) não é tocado.
    expect(await read(other)).toEqual([
      { name: "Beach Tenis", instructions: null },
      { name: "Exercício do app", instructions: "Texto escrito no app." },
      { name: "Supino Reto (Barra)", instructions: null },
    ]);
  }, 120_000);
});

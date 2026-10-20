import { describe, expect, it } from "vitest";
import {
  buildInstructionsSql,
  coverage,
  MAX_WORDS,
  mergeInstructions,
  parseCatalogIds,
  wordCount,
} from "../../scripts/hevy/instructions";

const CUSTOM = "0c268b35-f171-474a-bc97-e56260acdd90";

describe("mergeInstructions", () => {
  it("junta os arquivos e normaliza espaços, mantendo uma seção por linha", () => {
    const { instructions, errors } = mergeInstructions([
      { name: "01.json", data: { "79D0BB3A": "  Deite  no banco.\n\n  Desça a barra.  " } },
      { name: "02.json", data: { [CUSTOM]: "Jogue em dupla." } },
    ]);
    expect(errors).toEqual([]);
    expect(instructions).toEqual({ "79D0BB3A": "Deite no banco.\nDesça a barra.", [CUSTOM]: "Jogue em dupla." });
  });

  it("recusa id inválido, texto vazio, texto longo, repetido e arquivo que não é objeto", () => {
    const long = Array.from({ length: MAX_WORDS + 1 }, () => "palavra").join(" ");
    const { instructions, errors } = mergeInstructions([
      { name: "a.json", data: { abc: "x", "79D0BB3A": " ", F1E57334: long, "3601968B": "ok" } },
      { name: "b.json", data: { "3601968B": "de novo" } },
      { name: "c.json", data: ["lista"] },
    ]);
    expect(instructions).toEqual({ "3601968B": "ok" });
    expect(errors).toEqual([
      'a.json: id inválido "abc".',
      "a.json: 79D0BB3A sem texto.",
      `a.json: F1E57334 tem ${MAX_WORDS + 1} palavras (máx. ${MAX_WORDS}).`,
      "b.json: 3601968B repetido (já está em a.json).",
      "c.json: o arquivo precisa ser um objeto { id: texto }.",
    ]);
  });

  it("wordCount conta palavras separadas por qualquer espaço", () => {
    expect(wordCount(" um  dois\ntrês ")).toBe(3);
  });
});

describe("cobertura", () => {
  it("lê os ids do SQL da importação e aponta faltantes e desconhecidos", () => {
    const sql = [
      "    (md5(v_uid::text || ':hevy-template:' || '79D0BB3A')::uuid, v_uid, 'Supino', 'Peito', '79D0BB3A', …",
      `    (md5(v_uid::text || ':hevy-template:' || '${CUSTOM}')::uuid, v_uid, 'Beach Tenis', …`,
      "    insert into public.workout_exercises … md5(v_uid::text || ':hevy-template:' || '79D0BB3A')::uuid)",
    ].join("\n");
    const ids = parseCatalogIds(sql);
    expect(ids).toEqual([CUSTOM, "79D0BB3A"]);
    expect(coverage({ "79D0BB3A": "x", FFFFFFFF: "y" }, ids)).toEqual({
      covered: 1,
      missing: [CUSTOM],
      unknown: ["FFFFFFFF"],
    });
  });
});

describe("buildInstructionsSql", () => {
  const instructions = { F1E57334: "Apoie a mão no banco.", "3601968B": "Pés firmes; 'escápulas' juntas." };

  it("um update só do dono, por hevy_template_id, idempotente e com aspas escapadas", () => {
    const sql = buildInstructionsSql({ ownerEmail: "dono@example.com", instructions });
    expect(sql).toContain("v_uid uuid := (select id from auth.users where email = 'dono@example.com');");
    expect(sql).toContain("where e.user_id = v_uid");
    expect(sql).toContain("and e.hevy_template_id = v.hevy_template_id");
    expect(sql).toContain("and e.instructions is distinct from v.instructions;");
    expect(sql).toContain("('3601968B', 'Pés firmes; ''escápulas'' juntas.'),\n    ('F1E57334', 'Apoie a mão no banco.')\n");
    expect(sql).toContain("-- 2 instruções.");
  });

  it("mesma entrada gera o mesmo texto, em qualquer ordem", () => {
    const a = buildInstructionsSql({ ownerEmail: "dono@example.com", instructions });
    const b = buildInstructionsSql({
      ownerEmail: "dono@example.com",
      instructions: Object.fromEntries(Object.entries(instructions).reverse()),
    });
    expect(a).toBe(b);
  });

  it("recusa e-mail suspeito e lista vazia", () => {
    expect(() => buildInstructionsSql({ ownerEmail: "x'; drop table exercises; --@a.b", instructions })).toThrow(
      "E-mail do dono inválido.",
    );
    expect(() => buildInstructionsSql({ ownerEmail: "dono@example.com", instructions: {} })).toThrow();
  });
});

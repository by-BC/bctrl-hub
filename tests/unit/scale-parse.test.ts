// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseScaleSheet, readSheetRows, toSql, type ParsedMeasurement } from "../../scripts/scale/parse";
import { renderReport } from "../../scripts/scale/report";
import { SCALE_HEADER, fakeRow, fakeSheetRows, fakeWorkbook } from "../fixtures/scale/workbook";

/** Importação da planilha da balança (task 2.0 v3), sempre com a planilha fictícia. */

describe("readSheetRows", () => {
  it("lê o .xlsx gerado e devolve as linhas da primeira aba como texto", async () => {
    const rows = await readSheetRows(await fakeWorkbook());
    expect(rows[0][0]).toBe("Fulano Teste - Dados de Medição");
    expect(rows[3].slice(0, 3)).toEqual(["Data", "Tempo", "Peso(Kg)"]);
    expect(rows[4].slice(0, 3)).toEqual(["03/03/2026", "21:30", "72.00"]);
  });
});

describe("parseScaleSheet", () => {
  it("lê sexo, idade e altura da linha com dois-pontos de largura total", () => {
    const { header } = parseScaleSheet(fakeSheetRows());
    expect(header).toEqual({ sex: "Masculino", age: 40, heightCm: 175 });
  });

  it("converte data e hora de São Paulo e números em texto com ponto", () => {
    const { measurements, skipped, rowsRead } = parseScaleSheet(fakeSheetRows());
    expect(rowsRead).toBe(3);
    expect(skipped).toEqual([]);
    expect(measurements).toHaveLength(3);
    // Ordem cronológica, independente da ordem da planilha.
    expect(measurements.map((m) => m.measured_at)).toEqual([
      "2026-03-01T08:00:00-03:00",
      "2026-03-02T07:05:00-03:00",
      "2026-03-03T21:30:00-03:00",
    ]);
    const last = measurements[2];
    expect(last.day).toBe("2026-03-03");
    expect(last.row).toBe(5);
    expect(last.values).toEqual({
      weight_kg: 72,
      bmi: 22.1,
      body_fat_pct: 18.5,
      fat_mass_kg: 13.32,
      skeletal_muscle_pct: 48.2,
      skeletal_muscle_kg: 34.7,
      muscle_rate_pct: 76.3,
      muscle_mass_kg: 54.94,
      visceral_fat: 7,
      water_pct: 57.4,
      water_kg: 41.33,
      bmr_kcal: 1620,
      obesity_pct: 3.2,
      bone_kg: 2.9,
      protein_pct: 17.1,
      lean_mass_kg: 58.68,
      metabolic_age: 30,
    });
  });

  it("dia de São Paulo: 23:30 continua no mesmo dia (instante já é o dia seguinte em UTC)", () => {
    const { measurements } = parseScaleSheet(fakeSheetRows([fakeRow("15/04/2026", "23:30", "70.00")]));
    expect(measurements[0].measured_at).toBe("2026-04-15T23:30:00-03:00");
    expect(new Date(measurements[0].measured_at).toISOString()).toBe("2026-04-16T02:30:00.000Z");
    expect(measurements[0].day).toBe("2026-04-15");
  });

  it("mapeia as colunas pelo nome, não pela posição", () => {
    const order = [2, 0, 1, ...SCALE_HEADER.map((_, i) => i).slice(3)];
    const shuffle = (r: string[]) => order.map((i) => r[i]);
    const rows = fakeSheetRows([shuffle(fakeRow("01/03/2026", "08:00", "72.80"))]);
    rows[3] = shuffle(SCALE_HEADER);
    const { measurements } = parseScaleSheet(rows);
    expect(measurements[0].values.weight_kg).toBe(72.8);
    expect(measurements[0].measured_at).toBe("2026-03-01T08:00:00-03:00");
  });

  it("vazio e \"--\" viram null, nunca zero", () => {
    const row = fakeRow("01/03/2026", "08:00", "72.80");
    row[4] = "--"; // gordura
    row[18] = ""; // idade metabólica
    row[13] = " "; // metabolismo
    const { measurements, warnings } = parseScaleSheet(fakeSheetRows([row]));
    expect(measurements[0].values.body_fat_pct).toBeNull();
    expect(measurements[0].values.metabolic_age).toBeNull();
    expect(measurements[0].values.bmr_kcal).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("coluna desconhecida vai para o relatório; coluna esperada ausente também", () => {
    const rows = fakeSheetRows([[...fakeRow("01/03/2026", "08:00", "72.80").slice(0, 18), "9.9"]]);
    rows[3] = [...SCALE_HEADER.slice(0, 18), "Frequência cardíaca(bpm)", "", ""];
    const { unknownColumns, missingColumns, measurements } = parseScaleSheet(rows);
    expect(unknownColumns).toEqual(["Frequência cardíaca(bpm)"]);
    expect(missingColumns).toEqual(["metabolic_age"]);
    expect(measurements[0].values.metabolic_age).toBeNull();
  });

  it("linha sem data, hora ou peso válido é ignorada com o motivo", () => {
    const rows = fakeSheetRows([
      fakeRow("", "08:00", "72.00"),
      fakeRow("31/02/2026", "08:00", "72.00"),
      fakeRow("01/03/2026", "", "72.00"),
      fakeRow("01/03/2026", "25:10", "72.00"),
      fakeRow("01/03/2026", "08:00", "--"),
      fakeRow("01/03/2026", "08:00", "abc"),
      fakeRow("01/03/2026", "08:00", "5.00"),
      fakeRow("02/03/2026", "08:00", "72.00"),
      fakeRow("02/03/2026", "08:00", "72.10"),
    ]);
    const { measurements, skipped, rowsRead } = parseScaleSheet(rows);
    expect(rowsRead).toBe(9);
    expect(measurements).toHaveLength(1);
    expect(skipped).toEqual([
      { row: 5, reason: "data ausente ou inválida" },
      { row: 6, reason: "data ausente ou inválida (31/02/2026)" },
      { row: 7, reason: "hora ausente ou inválida" },
      { row: 8, reason: "hora ausente ou inválida (25:10)" },
      { row: 9, reason: "peso ausente" },
      { row: 10, reason: "peso inválido (abc)" },
      { row: 11, reason: "peso fora da faixa 20–300 kg (5.00)" },
      { row: 13, reason: "data e hora repetidas (mesma medição da linha 12; valores diferentes)" },
    ]);
  });

  it("linha repetida idêntica é apontada como tal", () => {
    const row = fakeRow("02/03/2026", "08:00", "72.00");
    const { measurements, skipped } = parseScaleSheet(fakeSheetRows([row, [...row]]));
    expect(measurements).toHaveLength(1);
    expect(skipped).toEqual([{ row: 6, reason: "data e hora repetidas (mesma medição da linha 5; valores idênticos)" }]);
  });

  it("linhas totalmente vazias depois dos dados não contam", () => {
    const rows = [...fakeSheetRows(), [], ["", "", ""]];
    const { rowsRead, skipped } = parseScaleSheet(rows);
    expect(rowsRead).toBe(3);
    expect(skipped).toEqual([]);
  });

  it("valor fora da faixa ou não numérico vira null, com aviso, e a medição continua", () => {
    const row = fakeRow("01/03/2026", "08:00", "72.80");
    row[4] = "95.00"; // gordura > 70
    row[18] = "30.5"; // idade metabólica não inteira
    row[11] = "x"; // água
    const { measurements, warnings } = parseScaleSheet(fakeSheetRows([row]));
    expect(measurements).toHaveLength(1);
    expect(measurements[0].values.body_fat_pct).toBeNull();
    expect(measurements[0].values.metabolic_age).toBeNull();
    expect(measurements[0].values.water_pct).toBeNull();
    expect(warnings).toEqual([
      { row: 5, metric: "body_fat_pct", value: "95.00", reason: "fora da faixa 2–70" },
      { row: 5, metric: "water_pct", value: "x", reason: "não numérico" },
      { row: 5, metric: "metabolic_age", value: "30.5", reason: "deve ser inteiro" },
    ]);
  });

  it("sem linha de cabeçalho com \"Data\": erro claro", () => {
    expect(() => parseScaleSheet([["qualquer"], ["coisa"]])).toThrow(/cabeçalho/i);
  });

  it("aceita células já tipadas (número e data) quando a planilha não vem em texto", () => {
    const row: unknown[] = [new Date(Date.UTC(2026, 2, 1)), "08:00", 72.8];
    const rows = fakeSheetRows([]);
    rows.push(row);
    const { measurements } = parseScaleSheet(rows);
    expect(measurements[0].measured_at).toBe("2026-03-01T08:00:00-03:00");
    expect(measurements[0].values.weight_kg).toBe(72.8);
  });
});

describe("toSql", () => {
  const { measurements } = parseScaleSheet(fakeSheetRows());

  it("é determinístico e faz upsert por (user_id, measured_at) com source import", () => {
    const sql = toSql(measurements, "dono@bctrl.test");
    expect(toSql([...measurements].reverse(), "dono@bctrl.test")).toBe(sql);
    expect(sql).toContain("v_uid uuid := (select id from auth.users where email = 'dono@bctrl.test');");
    expect(sql).toContain("on conflict (user_id, measured_at) do update");
    expect(sql).toContain("source = excluded.source");
    expect(sql).toMatch(/raise exception/);
    expect(sql.match(/'import'/g)).toHaveLength(3);
    expect(sql).toContain(
      "(v_uid, '2026-03-01T08:00:00-03:00', '2026-03-01', 72.8, 22.1, 18.5, 13.32, 48.2, 34.7, 76.3, 54.94, 7, 57.4, 41.33, 1620, 3.2, 2.9, 17.1, 58.68, 30, 'import')",
    );
  });

  it("métrica ausente vira null no SQL", () => {
    const m: ParsedMeasurement = {
      row: 5,
      measured_at: "2026-03-01T08:00:00-03:00",
      day: "2026-03-01",
      values: { ...measurements[0].values, body_fat_pct: null },
    };
    expect(toSql([m], "dono@bctrl.test")).toContain("72.8, 22.1, null, 13.32");
  });

  it("recusa e-mail inválido e lista vazia", () => {
    expect(() => toSql(measurements, "x'; drop table x; --")).toThrow(/e-mail/i);
    expect(() => toSql([], "dono@bctrl.test")).toThrow(/nenhuma medição/i);
  });
});

describe("renderReport", () => {
  it("traz contagens, período, métricas presentes, ignoradas e avisos", () => {
    const row = fakeRow("04/03/2026", "08:00", "72.00");
    row[4] = "95.00";
    const result = parseScaleSheet(fakeSheetRows([row, ...fakeSheetRows().slice(4) as string[][], fakeRow("", "08:00", "72")]));
    const md = renderReport(result, { file: "planilha.xlsx", generatedAt: "2026-10-20T12:00:00.000Z", mode: "dry-run" });
    expect(md).toContain("Linhas de dados lidas | 5");
    expect(md).toContain("Medições importadas | 4");
    expect(md).toContain("Linhas ignoradas | 1");
    expect(md).toContain("2026-03-01 a 2026-03-04");
    expect(md).toMatch(/Gordura corporal \| 3\/4/);
    expect(md).toMatch(/Peso \| 4\/4/);
    expect(md).toContain("data ausente ou inválida");
    expect(md).toContain("fora da faixa 2–70");
  });
});

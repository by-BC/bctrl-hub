import ExcelJS from "exceljs";

/**
 * Planilha FICTÍCIA no formato exportado pelo app da balança (task 2.0 v3). Nenhum valor real:
 * nome, idade, altura e medições são inventados. Gerada em memória pelos testes.
 */

export const SCALE_HEADER = [
  "Data",
  "Tempo",
  "Peso(Kg)",
  "IMC",
  "Gordura(%)",
  "Peso da gordura(Kg)",
  "Percentual da massa muscular esquelética(%)",
  "Peso da massa muscular esquelética(Kg)",
  "Registro de massa muscular(%)",
  "Peso da massa muscular(Kg)",
  "Gordura visceral",
  "Água(%)",
  "peso da água(Kg)",
  "Metabolismo(kcal / dia)",
  "Obesidade(%)",
  "Ossos(Kg)",
  "Proteína(%)",
  "LBM(Kg)",
  "Idade metabólica",
];

/** Linha completa e válida (texto, ponto decimal), na ordem de `SCALE_HEADER`. */
export function fakeRow(date: string, time: string, weight: string): string[] {
  return [
    date, time, weight, "22.10", "18.50", "13.32", "48.20", "34.70", "76.30", "54.94",
    "7.0", "57.40", "41.33", "1620.0", "3.20", "2.90", "17.10", "58.68", "30",
  ];
}

/** Linhas da planilha fictícia, na ordem da exportação (a mais recente primeiro). */
export function fakeSheetRows(data: string[][] = defaultData()): unknown[][] {
  return [
    ["Fulano Teste - Dados de Medição"],
    ["Sexo：Masculino", "", "", "", "", "", "", "Idade：40Anos", "", "", "", "", "", "", "Altura：175cm"],
    ["01/03/2026 - 03/03/2026 (Dados de 3 medições)"],
    [...SCALE_HEADER, "", ""],
    ...data,
  ];
}

export function defaultData(): string[][] {
  return [
    fakeRow("03/03/2026", "21:30", "72.00"),
    fakeRow("02/03/2026", "07:05", "72.40"),
    fakeRow("01/03/2026", "08:00", "72.80"),
  ];
}

/** `.xlsx` em memória com as linhas dadas, na aba `Sheet1`. */
export async function fakeWorkbook(rows: unknown[][] = fakeSheetRows()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  for (const row of rows) ws.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

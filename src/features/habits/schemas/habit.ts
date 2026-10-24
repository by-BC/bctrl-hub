import { z } from "zod";
import { CARDIO_TYPES } from "@/features/habits/domain/habits";

/**
 * Formulários de hábitos, registros e tarefas. O banco confere os limites básicos
 * (nome 1–120, meta > 0, valores ≥ 0); as regras de tela ficam aqui.
 */

/** Texto do campo numérico → número (aceita vírgula). Vazio vira `undefined`. */
const numberField = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const clean = v.trim().replace(",", ".");
  return clean === "" ? undefined : Number(clean);
}, z.number({ error: "Informe um número." }));

const optionalNumber = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const clean = v.trim().replace(",", ".");
  return clean === "" ? null : Number(clean);
}, z.number({ error: "Informe um número." }).nullable());

export const habitFormSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao hábito.").max(120, "Use até 120 caracteres."),
    kind: z.enum(["check", "quantity", "cardio"]),
    period: z.enum(["day", "week"]),
    target: numberField.pipe(z.number().positive("A meta precisa ser maior que zero.").max(100_000, "Meta alta demais.")),
    unit: z
      .string()
      .trim()
      .max(20, "Use até 20 caracteres na unidade.")
      .transform((v) => v || null),
  })
  .superRefine((h, ctx) => {
    // `check` conta dias: no máximo 1 por dia.
    if (h.kind === "check" && h.period === "day" && h.target !== 1) {
      ctx.addIssue({ code: "custom", path: ["target"], message: "Hábito diário de marcar tem meta 1 por dia." });
    }
    if (h.kind === "check" && h.period === "week" && (!Number.isInteger(h.target) || h.target > 7)) {
      ctx.addIssue({ code: "custom", path: ["target"], message: "Use de 1 a 7 dias por semana." });
    }
  })
  .transform((h) => ({
    ...h,
    // Cardio sempre conta minutos; check não tem unidade.
    unit: h.kind === "cardio" ? "min" : h.kind === "check" ? null : h.unit,
  }));

export type HabitForm = z.output<typeof habitFormSchema>;

const cardioTypes = CARDIO_TYPES.map((t) => t.value) as [string, ...string[]];

export const cardioLogFormSchema = z.object({
  cardio_type: z.enum(cardioTypes, { error: "Escolha o tipo de cardio." }),
  value: numberField.pipe(
    z.number().int("Use minutos inteiros.").min(1, "Informe os minutos.").max(1440, "No máximo 1440 minutos."),
  ),
  distance_km: optionalNumber.pipe(
    z.number().min(0, "Distância inválida.").max(9999, "Distância alta demais.").nullable(),
  ),
  kcal: optionalNumber.pipe(
    z.number().int("Use calorias inteiras.").min(0, "Calorias inválidas.").max(100_000, "Calorias altas demais.").nullable(),
  ),
});

export const quantityLogFormSchema = z.object({
  value: numberField.pipe(z.number().positive("Informe um valor maior que zero.").max(100_000, "Valor alto demais.")),
});

export const taskTitleSchema = z.string().trim().min(1, "Escreva a tarefa.").max(500, "Use até 500 caracteres.");

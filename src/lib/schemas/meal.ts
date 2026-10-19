import { z } from "zod";

/**
 * Plano alimentar: itens das opções (`meal_options.items`, jsonb) e formulários do editor.
 * O banco só garante que `items` é um array; o formato fica aqui.
 */

export const NOTE_MAX = 500;

/** Item como está gravado. Leitura tolerante: campos faltando viram vazio. */
export const storedMealItemSchema = z.object({
  name: z.string().catch(""),
  qty: z.string().catch(""),
  subs: z.array(z.string()).catch([]),
});
export const storedMealItemsSchema = z.array(storedMealItemSchema).catch([]);

export type MealItem = z.output<typeof storedMealItemSchema>;

/** Item ao salvar: nome obrigatório, quantidade opcional, substituições sem linhas vazias. */
export const mealItemFormSchema = z.object({
  name: z.string().trim().min(1, "Cada item precisa de um nome.").max(120, "Use até 120 caracteres no nome."),
  qty: z.string().trim().max(60, "Use até 60 caracteres na quantidade."),
  subs: z
    .array(z.string().trim().max(120, "Use até 120 caracteres por substituição."))
    .transform((subs) => subs.filter(Boolean)),
});

export const mealOptionFormSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à opção.").max(120, "Use até 120 caracteres."),
  items: z.array(mealItemFormSchema).max(40, "Use até 40 itens por opção."),
});

/** "" (sem horário) → null; "8:30" ou "08:30" → "08:30". */
const mealTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(v);
    if (!match) {
      ctx.addIssue({ code: "custom", message: "Use o formato HH:MM." });
      return z.NEVER;
    }
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  });

export const mealFormSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à refeição.").max(120, "Use até 120 caracteres."),
  time: z.union([z.null(), mealTime]),
  training_day_only: z.boolean(),
});

export const offPlanNoteSchema = z
  .string()
  .trim()
  .max(NOTE_MAX, `Use até ${NOTE_MAX} caracteres.`)
  .transform((v) => v || null);

export type MealOptionForm = z.output<typeof mealOptionFormSchema>;
export type MealForm = z.output<typeof mealFormSchema>;

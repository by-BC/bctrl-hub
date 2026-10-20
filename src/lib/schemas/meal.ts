import { z } from "zod";

/**
 * Plano alimentar: itens das opções (`meal_options.items`, jsonb) e formulários do editor.
 * O banco só garante que `items` é um array; o formato fica aqui.
 */

export const NOTE_MAX = 500;

/** Macros digitados para o item inteiro (sobrescrevem os calculados). */
const macroValue = z.number().min(0).max(10000);
export const macrosOverrideSchema = z
  .object({ kcal: macroValue, protein: macroValue, carbs: macroValue, fat: macroValue })
  .partial();

/** Id de `foods` (TACO usa md5 como uuid, então não exige a versão do uuid). */
const foodId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

/**
 * Item como está gravado. Leitura tolerante: campos faltando viram vazio.
 * v2 (nutrição): `food_id` (alimento da TACO ou próprio), `grams`, `macros_override` e
 * `free` ("à vontade", 0 kcal) são opcionais; itens da v1 continuam válidos sem eles.
 */
export const storedMealItemSchema = z.object({
  name: z.string().catch(""),
  qty: z.string().catch(""),
  subs: z.array(z.string()).catch([]),
  food_id: foodId.nullish().catch(undefined),
  grams: z.number().min(0).nullish().catch(undefined),
  macros_override: macrosOverrideSchema.nullish().catch(undefined),
  free: z.boolean().optional().catch(undefined),
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
  food_id: foodId.nullable().optional(),
  grams: z.number("Gramas inválidas.").min(0, "Gramas não podem ser negativas.").max(5000, "Use até 5000 g.").nullable().optional(),
  macros_override: z
    .object({
      kcal: z.number().min(0).max(10000, "Valor nutricional acima do limite."),
      protein: z.number().min(0).max(10000, "Valor nutricional acima do limite."),
      carbs: z.number().min(0).max(10000, "Valor nutricional acima do limite."),
      fat: z.number().min(0).max(10000, "Valor nutricional acima do limite."),
    })
    .partial()
    .nullable()
    .optional(),
  free: z.boolean().optional(),
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

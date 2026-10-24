import { z } from "zod";
import { ACTIVITY_LEVELS, BMR_SOURCES, GOALS, PROTEIN_BASES, SEXES } from "@/features/nutrition/domain/nutrition";

/**
 * Perfil (`profiles`): dados corporais e ajuste manual das metas. Os limites espelham os
 * checks do banco (altura 50–260 cm, proteína 0,5–4 g/kg, proteína por massa magra 0,5–5 g/kg com
 * 1 casa, nascimento a partir de 1900).
 */

const macroOverride = z.number().min(0).max(10000);
/** Ajuste de um dia: só os macros informados (os outros seguem o cálculo). */
export const macrosOverrideSchema = z
  .object({ kcal: macroOverride, protein: macroOverride, carbs: macroOverride, fat: macroOverride })
  .partial();

/** `goal_overrides` como está gravado. Leitura tolerante: o que não for válido vira vazio. */
export const goalOverridesSchema = z
  .object({
    rest: macrosOverrideSchema.nullish().catch(undefined),
    training: macrosOverrideSchema.nullish().catch(undefined),
  })
  .catch({});

export const profileFormSchema = z.object({
  sex: z.enum(SEXES, "Escolha o sexo."),
  birth_date: z.iso.date("Informe a data de nascimento.").refine((d) => d >= "1900-01-01", "Data de nascimento inválida."),
  height_cm: z.number("Informe a altura em cm.").min(50, "Altura entre 50 e 260 cm.").max(260, "Altura entre 50 e 260 cm."),
  activity_level: z.enum(ACTIVITY_LEVELS, "Escolha o nível de atividade."),
  goal: z.enum(GOALS, "Escolha o objetivo."),
  protein_g_per_kg: z
    .number("Informe a proteína em g por kg.")
    .min(0.5, "Proteína entre 0,5 e 4 g/kg.")
    .max(4, "Proteína entre 0,5 e 4 g/kg."),
  goal_overrides: z.object({ rest: macrosOverrideSchema.optional(), training: macrosOverrideSchema.optional() }),
  bmr_source: z.enum(BMR_SOURCES, "Escolha a fonte da TMB."),
  protein_basis: z.enum(PROTEIN_BASES, "Escolha a base da proteína."),
  protein_g_per_kg_lean: z
    .number("Informe a proteína em g por kg de massa magra.")
    .min(0.5, "Proteína por massa magra entre 0,5 e 5 g/kg.")
    .max(5, "Proteína por massa magra entre 0,5 e 5 g/kg.")
    .refine((n) => Math.abs(Math.round(n * 10) - n * 10) < 1e-9, "Proteína por massa magra com no máximo 1 casa decimal."),
});

export type ProfileForm = z.output<typeof profileFormSchema>;

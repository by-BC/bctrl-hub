import { z } from "zod";

/**
 * Formulários de rotina e exercício. O banco aceita faixas maiores
 * (descanso 0–3600 s, séries 1–20); a interface fica numa faixa útil.
 */

export const REST_MIN = 15;
export const REST_MAX = 600;
export const REST_STEP = 15;
export const REST_DEFAULT = 120;
export const SETS_MIN = 1;
export const SETS_MAX = 20;

const restSec = z
  .number({ error: "Informe o descanso em segundos." })
  .int("O descanso precisa ser em segundos inteiros.")
  .min(REST_MIN, `O descanso mínimo é de ${REST_MIN} s.`)
  .max(REST_MAX, `O descanso máximo é de ${REST_MAX / 60} min.`);

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Use até ${max} caracteres.`)
    .transform((v) => v.trim() || null)
    .nullish()
    .transform((v) => v ?? null);

export const routineFormSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à rotina.").max(120, "Use até 120 caracteres."),
  notes: optionalText(2000),
  rest_sec: restSec,
});

export const routineExerciseFormSchema = z.object({
  sets: z
    .number({ error: "Informe o número de séries." })
    .int("O número de séries precisa ser inteiro.")
    .min(SETS_MIN, "A rotina precisa de ao menos 1 série.")
    .max(SETS_MAX, `Use no máximo ${SETS_MAX} séries.`),
  /** `null` = usa o descanso padrão da rotina. */
  rest_sec: restSec.nullable(),
  notes: optionalText(2000),
});

export const exerciseFormSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao exercício.").max(120, "Use até 120 caracteres."),
  muscle_group: optionalText(60),
});

export type RoutineForm = z.output<typeof routineFormSchema>;
export type RoutineExerciseForm = z.output<typeof routineExerciseFormSchema>;
export type ExerciseForm = z.output<typeof exerciseFormSchema>;

/** Primeira mensagem de erro de um `safeParse`, para exibir no formulário. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

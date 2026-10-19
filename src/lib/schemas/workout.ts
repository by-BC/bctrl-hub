import { z } from "zod";

/**
 * Payload da RPC `finish_workout` (supabase/migrations/*_rpcs.sql).
 * Validado no cliente antes do envio; o banco revalida com constraints e desfaz tudo
 * se algo passar daqui. Os ids são gerados no aparelho (`crypto.randomUUID()`), o que
 * torna o reenvio idempotente. A ordem dos arrays vira a `position` no banco.
 */

export const prKindSchema = z.enum(["weight", "volume", "e1rm"]);

export const workoutSetSchema = z.object({
  id: z.uuid().optional(),
  weight_kg: z.number().min(0).max(9999.99), // numeric(6,2)
  reps: z.number().int().positive(),
  pr_kinds: z.array(prKindSchema).default([]),
});

export const workoutExerciseSchema = z.object({
  id: z.uuid().optional(),
  exercise_id: z.guid(), // ids do seed vêm de md5: formato de uuid sem versão RFC
  notes: z.string().nullish(),
  sets: z.array(workoutSetSchema).min(1, "O exercício precisa de ao menos uma série."),
});

export const finishWorkoutSchema = z
  .object({
    id: z.uuid(),
    routine_id: z.guid().nullable(),
    started_at: z.iso.datetime({ offset: true }),
    finished_at: z.iso.datetime({ offset: true }),
    day: z.iso.date(), // dia em America/Sao_Paulo, calculado no cliente
    notes: z.string().nullish(),
    exercises: z.array(workoutExerciseSchema).min(1, "O treino precisa de ao menos um exercício."),
  })
  .refine((w) => Date.parse(w.finished_at) >= Date.parse(w.started_at), {
    message: "O fim do treino não pode ser antes do início.",
    path: ["finished_at"],
  });

export type PrKind = z.infer<typeof prKindSchema>;
/** Payload já validado, pronto para `supabase.rpc("finish_workout", { payload })`. */
export type FinishWorkoutPayload = z.output<typeof finishWorkoutSchema>;
export type FinishWorkoutInput = z.input<typeof finishWorkoutSchema>;

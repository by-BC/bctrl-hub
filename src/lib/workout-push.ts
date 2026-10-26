/** Chave pública VAPID; a chave privada fica apenas no Vault do Supabase. */
export const WORKOUT_PUSH_VAPID_PUBLIC_KEY = "BCXOuJIV8KDJJ8_AZx-TXJb3w_T5Rscg1pzJ2lpyRTH3uFgWodFLS0aWXrzZB4NDQXuovklUsOvaU73eQexuHCo";

export function applicationServerKeyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function scheduleRestPush(
  workoutId: string,
  rest: { endsAt: string; exerciseName?: string; nextSetNumber?: number },
) {
  const response = await fetch("/api/workout-rest-notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workoutId,
      endsAt: rest.endsAt,
      exerciseName: rest.exerciseName ?? "Exercício",
      nextSetNumber: rest.nextSetNumber,
    }),
  });
  if (!response.ok) throw new Error("Não foi possível agendar o aviso do descanso.");
}

export async function cancelRestPush(workoutId: string) {
  const response = await fetch("/api/workout-rest-notifications", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workoutId }),
  });
  if (!response.ok) throw new Error("Não foi possível cancelar o aviso do descanso.");
}

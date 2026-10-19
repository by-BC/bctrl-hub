import { createClient } from "@supabase/supabase-js";
import { readLocalSupabaseEnv } from "../support/local-supabase";

/**
 * Usuário descartável no Supabase LOCAL, para E2E que gravam dados.
 * Assim o usuário do seed (`e2e@bctrl.test`) continua com as contagens que
 * `tests/integration/seed.test.ts` confere. Os dados somem com o usuário (cascata).
 */
export type DisposableUser = { id: string; email: string; password: string };

function admin() {
  const { url, secretKey } = readLocalSupabaseEnv();
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createDisposableUser(label: string): Promise<DisposableUser> {
  const email = `${label}-${crypto.randomUUID()}@bctrl.test`;
  const password = `senha-${crypto.randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("usuário não criado");
  return { id: data.user.id, email, password };
}

export async function deleteDisposableUser(user: DisposableUser | undefined) {
  if (!user) return;
  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) throw error;
}

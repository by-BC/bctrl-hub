import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";

// Clientes sem tipagem gerada: os testes de RLS percorrem tabelas por nome.
export type TestUser = { id: string; email: string; client: SupabaseClient };

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function adminClient(): SupabaseClient {
  const { url, secretKey } = inject("supabase");
  return createClient(url, secretKey, noSession);
}

export function anonClient(): SupabaseClient {
  const { url, publishableKey } = inject("supabase");
  return createClient(url, publishableKey, noSession);
}

export async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

/** Cria um usuário descartável no Supabase local e devolve um cliente logado como ele. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID()}@bctrl.test`;
  const password = `senha-${crypto.randomUUID()}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("usuário não criado");
  return { id: data.user.id, email, client: await signIn(email, password) };
}

/** Apaga o usuário; os dados dele somem por cascata (`on delete cascade`). */
export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (!user) return;
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) throw error;
}

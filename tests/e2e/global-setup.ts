import { createClient } from "@supabase/supabase-js";
import { readLocalSupabaseEnv } from "../support/local-supabase";
import { TEST_USER } from "./fixtures";

// Garante o usuário de teste no Supabase local (idempotente).
export default async function globalSetup() {
  const { url, secretKey } = readLocalSupabaseEnv();
  const admin = createClient(url, secretKey, { auth: { persistSession: false } });

  const { error } = await admin.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
  });
  if (error && error.code !== "email_exists") throw error;
}

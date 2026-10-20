import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

export type LocalSupabaseEnv = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

let cached: LocalSupabaseEnv | undefined;

/**
 * Lê URL e chaves do Supabase LOCAL via `supabase status`.
 * As chaves locais são fixas e públicas (só valem no Docker da máquina);
 * nunca use isto contra o projeto remoto.
 *
 * Uma vez por processo: cada `supabase status` leva ~4–5 s nesta máquina, e os seeds do E2E
 * criavam um cliente admin por operação (um usuário + 3 inserts passavam de 20 s).
 */
export function readLocalSupabaseEnv(): LocalSupabaseEnv {
  cached ??= readStatus();
  return cached;
}

function readStatus(): LocalSupabaseEnv {
  let raw: string;
  try {
    // Comando fixo, sem entrada externa.
    raw = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Supabase local não está rodando. Rode `npx supabase start` antes dos testes.");
  }

  const vars = Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );

  const url = vars.API_URL;
  const publishableKey = vars.PUBLISHABLE_KEY ?? vars.ANON_KEY;
  const secretKey = vars.SECRET_KEY ?? vars.SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error("Não foi possível ler API_URL/chaves de `supabase status -o env`.");
  }
  return { url, publishableKey, secretKey };
}

// globalSetup do Vitest: falha cedo e entrega as variáveis via inject("supabase").
export default function setup({ provide }: TestProject) {
  provide("supabase", readLocalSupabaseEnv());
}

declare module "vitest" {
  export interface ProvidedContext {
    supabase: LocalSupabaseEnv;
  }
}

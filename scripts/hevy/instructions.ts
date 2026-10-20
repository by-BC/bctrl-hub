/**
 * Instruções próprias de execução (RF02b): textos escritos para o Bctrl Hub, guardados em
 * `scripts/hevy/instructions/*.json` (`{ "<hevy_template_id>": "texto" }`), e o SQL privado
 * que as grava nos exercícios do dono. Funções puras; o CLI está em `instructions-run.ts`.
 *
 * Nada aqui vem do Hevy: o id do modelo só serve de chave para achar o exercício.
 */

export type Instructions = Record<string, string>;

/** Id de modelo do catálogo (8 caracteres) ou de exercício personalizado (UUID). */
const TEMPLATE_ID_RE = /^(?:[0-9A-Z]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Teto por texto. A meta é ~80 palavras; acima disto o texto deixa de caber recolhido na sessão. */
export const MAX_WORDS = 95;

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** Uma seção por linha (Posição, Execução, Respiração, Erros comuns), sem espaços sobrando. */
const normalize = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .filter(Boolean)
    .join("\n");

/** Junta os arquivos (em ordem) e recusa id inválido, id repetido entre arquivos e texto vazio ou longo. */
export function mergeInstructions(files: readonly { name: string; data: unknown }[]): {
  instructions: Instructions;
  errors: string[];
} {
  const instructions: Instructions = {};
  const origin: Record<string, string> = {};
  const errors: string[] = [];
  for (const { name, data } of files) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      errors.push(`${name}: o arquivo precisa ser um objeto { id: texto }.`);
      continue;
    }
    for (const [id, value] of Object.entries(data)) {
      if (!TEMPLATE_ID_RE.test(id)) errors.push(`${name}: id inválido "${id}".`);
      else if (typeof value !== "string" || value.trim() === "") errors.push(`${name}: ${id} sem texto.`);
      else if (wordCount(value) > MAX_WORDS) errors.push(`${name}: ${id} tem ${wordCount(value)} palavras (máx. ${MAX_WORDS}).`);
      else if (id in instructions) errors.push(`${name}: ${id} repetido (já está em ${origin[id]}).`);
      else {
        instructions[id] = normalize(value);
        origin[id] = name;
      }
    }
  }
  return { instructions, errors };
}

/** Cobertura em relação aos ids do catálogo do dono. */
export function coverage(instructions: Instructions, catalogIds: readonly string[]) {
  const ids = new Set(catalogIds);
  return {
    covered: catalogIds.filter((id) => id in instructions).length,
    missing: catalogIds.filter((id) => !(id in instructions)),
    unknown: Object.keys(instructions).filter((id) => !ids.has(id)),
  };
}

/** Ids do catálogo no SQL privado da importação (`supabase/import.private.sql`). */
export function parseCatalogIds(importSql: string): string[] {
  const ids = [...importSql.matchAll(/':hevy-template:' \|\| '([^']+)'\)::uuid, v_uid,/g)].map((m) => m[1]);
  return [...new Set(ids)].sort();
}

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const EMAIL_RE = /^[^\s'"\\;]+@[^\s'"\\;]+\.[^\s'"\\;]+$/;

/**
 * SQL privado e idempotente (`supabase/instructions.private.sql`): um único `update … from
 * (values …)` restrito ao dono (resolvido por e-mail) e ao `hevy_template_id`. Só toca nas
 * linhas cujo texto mudou. Mesma entrada → mesmo texto.
 */
export function buildInstructionsSql({ ownerEmail, instructions }: { ownerEmail: string; instructions: Instructions }) {
  if (!EMAIL_RE.test(ownerEmail)) throw new Error("E-mail do dono inválido.");
  const entries = Object.entries(instructions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (entries.length === 0) throw new Error("Nenhuma instrução para gravar.");
  return [
    "-- Instruções próprias dos exercícios (gerado por scripts/hevy/instructions-run.ts). DADOS PESSOAIS: não versionar.",
    "-- Textos escritos para o Bctrl Hub (nada copiado do Hevy). Idempotente: rodar de novo não muda nada.",
    "-- Aplicar: npx supabase db query --linked -f supabase/instructions.private.sql",
    `-- ${entries.length} instruções.`,
    "",
    "do $instructions$",
    "declare",
    `  v_uid uuid := (select id from auth.users where email = ${q(ownerEmail)});`,
    "  v_updated integer;",
    "begin",
    "  if v_uid is null then",
    "    raise exception 'Usuário dono não encontrado em auth.users.';",
    "  end if;",
    "",
    "  update public.exercises e",
    "  set instructions = v.instructions",
    "  from (values",
    ...entries.map(([id, text], i) => `    (${q(id)}, ${q(text)})${i === entries.length - 1 ? "" : ","}`),
    "  ) as v(hevy_template_id, instructions)",
    "  where e.user_id = v_uid",
    "    and e.hevy_template_id = v.hevy_template_id",
    "    and e.instructions is distinct from v.instructions;",
    "",
    "  get diagnostics v_updated = row_count;",
    "  raise notice 'Instruções gravadas: % exercício(s) atualizado(s).', v_updated;",
    "end",
    "$instructions$;",
    "",
  ].join("\n");
}

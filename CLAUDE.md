@AGENTS.md

# Bctrl Hub

App pessoal (usuário único) de treino, alimentação, hábitos e tarefas. Docs do produto em `tasks/prd-bctrl-hub/` (`prd.md`, `techspec.md`, `tasks.md`).

## Stack

- Next.js 16 (App Router, **Cache Components** e Partial Prefetching ligados), React 19, TypeScript `strict`
- Tailwind 4 + shadcn/ui (base Radix) · Supabase (Postgres + Auth) via `@supabase/ssr` · Vercel
- Testes: Vitest (unidade e integração), Playwright (E2E, viewports iPhone 14 e desktop 1440)

## Comandos

| Comando | O quê |
|---|---|
| `npm run db:start` | Sobe o Supabase local (Docker precisa estar aberto) |
| `npm run dev` | App em `localhost:3000` (usa `.env.local`) |
| `npm test` | Unidade (`tests/unit`) |
| `npm run test:integration` | Integração contra o Supabase local (`tests/integration`) |
| `npm run test:e2e` | Playwright; sobe o app na porta 3100 com o Supabase local |
| `npm run test:all` | typecheck + lint + unidade + integração + E2E (inclui axe e fila offline) |
| `npm run db:types` | Regenera `src/lib/database.types.ts` |
| `npm run import:hevy` | Importação única do Hevy: dry-run gera `scripts/hevy/out/report.md`; `-- --write` gera `supabase/import.private.sql` (ver `scripts/hevy/run.ts`) |

`.env.local` (ignorado) aponta para o Supabase **local**; valores em `npx supabase status -o env`. Modelo em `.env.example`.

## Padrões obrigatórios

- **Next 16 é diferente do que você conhece**: ler `node_modules/next/dist/docs/` antes de usar uma API. Com Cache Components, ler cookies/`headers()`/`usePathname()` em rota dinâmica exige `<Suspense>` (ver `src/components/shell/bottom-nav.tsx`).
- **Auth**: o controle de acesso é o `src/proxy.ts` → `updateSession` (`src/lib/supabase/proxy.ts`) com `getClaims()`. Nada de código entre `createServerClient` e `getClaims()`. Layouts não leem a sessão no topo (mantém o shell estático).
- **Cadastro público desativado**: `[auth] enable_signup = false`. Não mexer em `[auth.email] enable_signup`: em `false` ele desliga o *login* por e-mail.
- **Dados**: cliente fala direto com o Supabase; toda tabela tem `user_id` + RLS + teste de RLS. Migrations só por arquivo em `supabase/migrations`. Tipos gerados, nunca editados à mão.
- **Gravações idempotentes**: id gerado no cliente (`crypto.randomUUID()`) + `upsert`.
- **Domínio puro** em `src/lib/domain` (sem I/O, 100% testável); features em `src/features/<feature>`.
- **Cores e fontes só por tokens** (`src/styles/tokens.css` + `@theme` em `globals.css`). Nada de hex solto em componente.
  - Texto azul sobre o fundo: `text-primary-text` (o `#2448DB` puro some no tema escuro).
  - Texto laranja: `text-highlight-text`. O `#D96735` puro fica em 3.1:1 sobre o off-white: só em ícone, preenchimento ou texto grande.
  - Texto grafite sobre fundo laranja: 4.2:1, só em texto grande ou negrito. Superfície laranja com texto pequeno (timer de descanso): `bg-highlight-surface` (5.7:1).
  - Número + unidade ("42,5 kg"): `<NumUnit>` (`src/components/num-unit.tsx`). O espaço em mono ocupa um caractere inteiro e parece duplo.
  - Números (cargas, reps, timer, métricas): classe `num` (IBM Plex Mono tabular).
- **Acessibilidade**: alvos de toque ≥ 44 px, estados com ícone ou texto (não só cor), `prefers-reduced-motion` respeitado globalmente, atalho "Pular para o conteúdo" no layout. `tests/e2e/a11y.spec.ts` roda o axe (WCAG 2.1 A/AA) em todas as rotas, nos 2 temas e 2 viewports, mais sheet aberto e sessão ativa: 0 violações *serious*/*critical*. Rota nova entra na lista desse teste. `aria-label` de botão começa pelo texto visível (regra `label-content-name-mismatch`).
- **Fila offline** (`src/components/providers/query-provider.tsx` + `src/lib/query/mutation-defaults.ts`): toda gravação usa uma entrada de `WRITES` (chave `[grupo, ação]` + função de envio), espalhada no `useMutation` do hook; nunca `mutationFn` inline num hook (um teste de unidade barra). As variáveis levam tudo o que o envio usa (nada de closure: a mutação pode ser reenviada depois de reabrir o app, sem o hook). `networkMode: 'offlineFirst'`, erro de rede repete até 8 vezes; sem rede, pausa. As gravações pendentes (só elas, nenhuma leitura) ficam no `localStorage` (`bctrl.queryCache`, `buster` + `maxAge` de 7 dias) e são reenviadas no `onSuccess` do provider e no evento `online`. Mudou a forma das variáveis de alguma gravação? Suba o `CACHE_BUSTER`. Sair limpa a fila. `SyncStatus` (shell) mostra offline / sincronizando / N pendentes. O treino ativo tem fila própria (`pendingSync` no store), fora disso.
- **Nada pessoal no Git** (repo público): `supabase/seed.sql`, o anexo de dados iniciais, PDFs e `.env*` estão no `.gitignore`.
- **Seeds**: `supabase/seed.example.sql` (fictício, versionado) roda no `npx supabase db reset` local e cria o usuário de E2E (`e2e@bctrl.test`) com 4 rotinas, 6 refeições e os hábitos do sistema. O seed real fica em `supabase/seed.private.sql` (ignorado, idempotente) e vai ao remoto com `npx supabase db query --linked -f supabase/seed.private.sql`. Migrations no remoto: `npx supabase db push` (nunca `--include-seed` nem `db reset --linked`).
- **Banco**: FKs entre tabelas do app são compostas com `user_id` (nada aponta para linha de outro usuário). Em insert em lote pelo supabase-js, passe `{ defaultToNull: false }` ou envie todas as colunas (colunas ausentes viram `null`). Hábitos com `system_key` não podem ser excluídos (trigger). `finish_workout` recebe o payload validado por `finishWorkoutSchema` (`src/lib/schemas/workout.ts`).

## Story Studio (task 9.0)

`/treino/historico/[id]/story` (atalhos "Gerar story" no detalhe do histórico e no resumo depois de salvar o treino). Dados em `buildStoryData` (`src/lib/domain/story.ts`, puro); layouts em `src/features/story/layouts` (Recibo, Hex Week, Blueprint, Foto + overlay), cada um 1080×1920 dentro do `StoryFrame`.
- **Exportação** (`src/features/story/export.ts`): `document.fonts.ready` + captura de aquecimento descartada + `pixelRatio: 1`. Validado na POC 1.10 no Chromium e **no iPhone real (Safari) em 2026-10-19: fontes Sora e IBM Plex Mono corretas no PNG**. Não remover nenhum dos três.
- **Compartilhar**: `navigator.share({ files })` quando `canShare` aceita arquivos; senão download. Cancelar o menu (AbortError) não é erro; outra recusa cai no download.
- **Dentro do quadro**: cores pelas classes `.story-ink` / `.story-paper` / `.story-blue` (`tokens.css`), fixas e independentes do tema do app. Nada essencial nos 250 px do topo e da base (guias tracejadas aparecem só em `next dev` e ficam fora do PNG). Evitar CSS `filter` (blur, drop-shadow) no quadro: falha no Safari dentro do `foreignObject`; usar gradiente ou `box-shadow`. Em SVG, cor por atributo `fill="currentColor"` (a classe `fill-current` saiu preta na captura).
- **Foto**: lida no aparelho (`loadPhoto` → dataURL reduzido), nunca enviada; o E2E confere que nenhuma requisição leva a imagem.
- **Validado no iPhone real (9.10, 2026-10-19)**: os 4 layouts, o menu nativo de compartilhar com a opção Instagram e o PNG saíram corretos. Android ainda não testado.

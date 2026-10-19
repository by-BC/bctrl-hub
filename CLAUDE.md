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
| `npm run test:all` | typecheck + lint + todas as suítes |
| `npm run db:types` | Regenera `src/lib/database.types.ts` |

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
  - Texto grafite sobre fundo laranja: 4.2:1, só em texto grande ou negrito.
  - Números (cargas, reps, timer, métricas): classe `num` (IBM Plex Mono tabular).
- **Acessibilidade**: alvos de toque ≥ 44 px, estados com ícone ou texto (não só cor), `prefers-reduced-motion` respeitado globalmente.
- **Nada pessoal no Git** (repo público): `supabase/seed.sql`, o anexo de dados iniciais, PDFs e `.env*` estão no `.gitignore`.

## Story (POC 1.10)

`/dev/story-poc` exporta PNG 1080×1920 com `html-to-image` (captura de aquecimento + `document.fonts.ready`). Validado no Chromium (E2E). **Pendente: validar no iPhone real** (Safari) e anotar aqui o resultado antes da task 9.0.

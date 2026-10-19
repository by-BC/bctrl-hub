# Tech Spec — Bctrl Hub

## Resumo Executivo

Aplicação **Next.js 16 (App Router) + React 19** hospedada na Vercel, com **Supabase** (Postgres + Auth) como único backend. Não há API própria: o cliente lê e grava direto no Supabase via `supabase-js`, com segurança garantida por **RLS** (`user_id = auth.uid()`) em todas as tabelas. O servidor Next só cuida de sessão/cookies (`@supabase/ssr` + `proxy.ts`), proteção de rotas e renderização inicial.

Para o sinal fraco da academia, a **sessão de treino ativa vive no aparelho** (store Zustand persistido em `localStorage`) e só vai ao banco no fim, por uma única RPC transacional e idempotente (`finish_workout`). As demais gravações usam **mutações TanStack Query persistidas**, com IDs gerados no cliente (UUID): a mesma gravação pode ser reenviada sem duplicar. O card de story é renderizado **no navegador** como componente React 1080×1920 e exportado com `html-to-image`; a foto nunca sai do aparelho. Esquema versionado em `supabase/migrations`, com seed do treino e da dieta do anexo.

## Arquitetura do Sistema

### Visão Geral dos Componentes

Projeto novo; todos os itens abaixo serão **criados**.

- **Infra / config**
  - `supabase/migrations/*.sql`: tabelas, RLS, views e RPCs.
  - `supabase/seed.sql`: rotinas, exercícios, plano alimentar e hábitos do sistema (do `anexo-dados-iniciais.md`). **Fica fora do Git** (repo público, conteúdo licenciado): existe só localmente e é aplicado no banco via MCP/CLI. No repo vai apenas um `supabase/seed.example.sql` com dados fictícios para testes.
  - `src/lib/supabase/{client,server,proxy}.ts`: cliente browser (`createBrowserClient`), cliente server (`createServerClient` + `cookies()`) e `updateSession()` usado pelo proxy, conforme o guia oficial do Supabase para Next.js.
  - `src/proxy.ts`: `export async function proxy(request)` chama `updateSession`, que renova a sessão e redireciona para `/login` sem autenticação. No Next 16, `middleware.ts` passou a se chamar `proxy.ts`, e o `matcher` exclui `_next/static`, `_next/image` e imagens.
  - `src/lib/database.types.ts`: tipos gerados por `supabase gen types`.
- **Shell de UI**
  - `src/app/layout.tsx`: fontes Sora e IBM Plex Mono (`next/font`), tema (escuro padrão), `QueryProvider`.
  - `src/components/shell/`: `BottomNav` no celular e `SideNav` no desktop (≥1024 px), `HexProgress` (símbolo do logo como anel de progresso, SVG parametrizado).
  - `src/components/ui/`: primitivas shadcn/ui (Button, Sheet, Dialog, Input, Tabs, Checkbox, Sonner).
  - `src/styles/tokens.css`: tokens de cor Bctrl (`--brand-blue #2448DB`, `--brand-orange #D96735`, `--paper #F4F0E8`, `--ink #25272C`) via `@theme` do Tailwind 4.
- **Domínio puro (sem I/O, 100% testável)** em `src/lib/domain/`
  - `workout.ts`: e1RM (Epley), volume, detecção de PR, próxima rotina da sequência.
  - `week.ts`: semana segunda→domingo em `America/Sao_Paulo`, agregação de hábitos e adesão.
  - `meals.ts`: refeições visíveis no dia (pós-treino condicional), adesão.
  - `story.ts`: transforma um treino finalizado no `StoryData` consumido pelos layouts.
- **Features** em `src/features/<feature>/` (componentes + hooks de query/mutação)
  - `auth`: tela de login por e-mail e senha.
  - `routines`: CRUD de rotinas e exercícios, reordenação (`@dnd-kit/sortable`).
  - `workout-session`: `useActiveWorkout` (store Zustand persistido), `SetRow`, `RestTimer`, `FinishSheet`, recuperação da sessão ao reabrir.
  - `history`: lista e detalhe de sessões, edição e exclusão.
  - `progress`: gráficos por exercício (Recharts), PRs, peso corporal.
  - `story`: `StoryStudio` (carrossel de layouts, captura de foto, exportação e compartilhamento) e os layouts `Receipt`, `HexWeek`, `Blueprint`, `PhotoOverlay`.
  - `meals`: plano (CRUD) e registro do dia.
  - `habits`: hábitos (check, quantidade, cardio), logs, streak.
  - `tasks`: to-do.
  - `today`: painel inicial compondo as features acima.
- **Rotas** (`src/app`)
  - `/login`, `/` (Hoje), `/treino` (rotinas + próximo), `/treino/rotinas/[id]`, `/treino/sessao` (ativa), `/treino/historico`, `/treino/historico/[id]`, `/treino/historico/[id]/story`, `/evolucao`, `/evolucao/[exerciseId]`, `/comida`, `/comida/plano`, `/habitos`, `/tarefas`.

**Fluxo de dados**
- **Leitura:** Server Component faz o fetch inicial com o cliente server e hidrata o TanStack Query.
- **Gravação:** mutações no cliente com `supabase-js`, *optimistic update*, fila persistida e reenvio ao reconectar.
- **Treino ativo:** só no aparelho até `finish_workout`. Ao iniciar, busca e guarda no store os valores anteriores e os melhores de cada exercício, para funcionar sem rede.

## Design de Implementação

### Interfaces Principais

```ts
// src/lib/domain/workout.ts
export type SetEntry = { weightKg: number | null; reps: number | null; done: boolean };
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));
export type Bests = { maxWeight: number; maxSetVolume: number; maxE1rm: number };
export type PrKind = 'weight' | 'volume' | 'e1rm';
export function detectPrs(set: SetEntry, bests: Bests): PrKind[];
export function nextRoutineId(routines: { id: string; position: number }[], lastRoutineId: string | null): string;
```

```ts
// src/features/workout-session/store.ts (zustand + persist → localStorage "bctrl.activeWorkout")
type ActiveWorkout = {
  id: string; routineId: string | null; startedAt: string;
  exercises: { id: string; exerciseId: string; name: string; restSec: number; notes?: string;
               previous: SetEntry[]; bests: Bests; sets: (SetEntry & { prs: PrKind[] })[] }[];
  rest: { endsAt: string } | null;          // timer baseado em timestamp: sobrevive a reload/tela bloqueada
};
interface ActiveWorkoutActions {
  start(routineId: string | null): Promise<void>; updateSet(exIdx: number, setIdx: number, p: Partial<SetEntry>): void;
  completeSet(exIdx: number, setIdx: number): void; addSet(exIdx: number): void; addExercise(exerciseId: string): void;
  adjustRest(deltaSec: number): void; finish(): Promise<{ workoutId: string }>; discard(): void;
}
```

```ts
// src/features/story/types.ts
export type StoryData = { routineName: string; date: string; durationMin: number; volumeKg: number;
  exercises: { name: string; best: { kg: number; reps: number } ; sets: { kg: number; reps: number }[] }[];
  prs: { exercise: string; kind: PrKind; value: number }[]; week: { workouts: number; mealsPct: number; habitsPct: number } };
export type StoryLayout = React.FC<{ data: StoryData; photoUrl?: string }>;   // renderiza em 1080×1920
```

### Modelos de Dados

Todas as tabelas têm `id uuid pk default gen_random_uuid()` (o cliente pode enviar o próprio id), `user_id uuid not null default auth.uid() references auth.users`, `created_at timestamptz default now()`, e RLS `for all using (user_id = auth.uid()) with check (user_id = auth.uid())`. As datas de "dia" são `date` calculado no cliente no fuso `America/Sao_Paulo`.

| Tabela | Colunas principais |
|---|---|
| `exercises` | `name`, `muscle_group`, `notes` · unique(user_id, name) |
| `routines` | `name`, `position int`, `notes`, `rest_sec int default 120`, `archived_at` |
| `routine_exercises` | `routine_id fk cascade`, `exercise_id fk`, `position`, `sets int`, `rest_sec`, `notes` |
| `workouts` | `routine_id fk null`, `started_at`, `finished_at`, `day date`, `notes` |
| `workout_exercises` | `workout_id fk cascade`, `exercise_id fk`, `position`, `notes` |
| `workout_sets` | `workout_exercise_id fk cascade`, `position`, `weight_kg numeric(6,2)`, `reps int`, `pr_kinds text[]` |
| `body_weights` | `day date`, `weight_kg numeric(5,2)` · unique(user_id, day) |
| `meals` | `name`, `time time`, `position`, `training_day_only bool` |
| `meal_options` | `meal_id fk cascade`, `position`, `title`, `items jsonb` (`[{name, qty, subs: string[]}]`) |
| `meal_logs` | `day`, `meal_id fk`, `option_id fk null`, `off_plan bool`, `note` · unique(user_id, day, meal_id) |
| `habits` | `name`, `kind` (`check`\|`quantity`\|`cardio`), `period` (`day`\|`week`), `target numeric`, `unit`, `system_key text null`, `archived_at` |
| `habit_logs` | `habit_id fk cascade`, `day`, `value numeric`, `cardio_type text`, `distance_km numeric`, `kcal int` |
| `tasks` | `title`, `done_at timestamptz null` |

O hábito **Treino** não tem logs: é derivado da contagem de `workouts` finalizados na semana. Os hábitos do sistema (`system_key`: `cardio`, `abs`, `supplements`) vêm no seed e não podem ser excluídos, só editados.

**Views** (`security_invoker = true`, para herdar o RLS):
- `v_exercise_session_stats`: por `(workout, exercise)`, com `day`, `best_weight`, `best_e1rm`, `volume`. Alimenta os gráficos.
- `v_exercise_bests`: por exercício, `max_weight`, `max_set_volume`, `max_e1rm`. Alimenta a detecção de PR.
- `v_exercise_last_sets`: séries da última sessão de cada exercício. Alimenta a coluna "anterior".

### Endpoints de API

Não há rotas HTTP próprias. As interfaces com o backend são:

- **PostgREST (supabase-js)**: CRUD direto nas tabelas acima.
- **RPC `finish_workout(payload jsonb) returns uuid`**: insere `workouts`, `workout_exercises` e `workout_sets` numa transação. É idempotente: se `payload.id` já existe, retorna o id sem regravar. É `security invoker`, com `auth.uid()` aplicado. Payload validado no cliente com **Zod** (`finishWorkoutSchema`).
- **RPC `week_summary(p_week_start date) returns jsonb`**: treinos, minutos/km/kcal de cardio, abdominais, suplementos e adesão alimentar da semana. Uma ida ao banco para o Hoje e para o Hex Week.
- **Auth**: `signInWithPassword` (e-mail e senha). O cadastro público fica **desativado** no Supabase (`enable_signup = false`); o usuário único é criado uma vez pelo painel do Supabase.

## Pontos de Integração

- **Supabase Auth**: sessão em cookies via `@supabase/ssr`. O `updateSession` chama `supabase.auth.getClaims()` logo após criar o cliente: verifica a assinatura do JWT localmente, sem ida à rede, e renova os cookies. É o padrão oficial atual; remover essa chamada causa logouts aleatórios. Nenhum código entre `createServerClient` e `getClaims()`, e um cliente novo por request (Fluid compute). Sessão longa. A chave publicável fica no cliente; a chave secreta nunca vai para o repo nem para a Vercel.
- **Fila offline**: `PersistQueryClientProvider` (`@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister` sobre `localStorage`), `networkMode: 'offlineFirst'` e `setMutationDefaults` por chave, para que mutações pausadas sobrevivam ao reload e sejam retomadas com `queryClient.resumePausedMutations()` no `onSuccess` do provider (após reidratar) e no evento `online`. Gravações em `upsert` com id do cliente, idempotentes.
- **Falha no `finish_workout`**: o store mantém a sessão marcada como `pendingSync`, tenta de novo com backoff e mostra um toast. A sessão só é limpa do aparelho após confirmação.
- **Compartilhamento do story**: `navigator.share({ files })` quando `navigator.canShare` suportar arquivos (iOS e Android); se não, faz download do PNG. Antes da captura, aguarda `document.fonts.ready` para as fontes saírem certas.
- **Vercel**: deploy via Git, com o projeto criado e as variáveis configuradas pelo MCP da Vercel (conectado). As variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ficam nos ambientes Preview e Production.

## Abordagem de Testes

### Testes Unidade

**Vitest**, sobre o domínio puro em `src/lib/domain`, sem mocks:
- `e1rm`/`detectPrs`: primeiro registro do exercício (sem bests), empate (não é PR), PR só de volume e reps nulas.
- `nextRoutineId`: sem histórico (primeira rotina), volta de L2 para U1, rotina arquivada ignorada.
- `week.ts`: semana começando na segunda, virada de domingo para segunda em `America/Sao_Paulo` às 23h30 UTC−3, soma de cardio.
- `meals.ts`: pós-treino visível só com treino no dia, e adesão ignorando o pós-treino em dia sem treino.
- Store `useActiveWorkout`: reidratação após reload, timer por `endsAt` e geração do payload.
- `story.ts`: melhor série por exercício e arredondamentos.

### Testes de Integração

**Supabase local** (`supabase start`, Docker) com Vitest:
- **RLS:** usuário B não lê nem grava dados do usuário A em nenhuma tabela, e as views respeitam o RLS.
- **`finish_workout`:** atomicidade (payload inválido não grava nada) e idempotência (duas chamadas com o mesmo id geram um registro só).
- **`week_summary`** com dados semeados conhecidos.
- **Seed:** 4 rotinas, 28 exercícios nas rotinas (26 únicos) e 6 refeições.

### Testes de E2E

**`@playwright/test`** contra `next dev` + Supabase local. O Playwright MCP não está disponível nesta sessão; os testes ficam em `tests/e2e`. Viewports: iPhone 14 e desktop 1440.
1. Login e redirecionamento para o Hoje; rota protegida sem sessão redireciona para `/login`.
2. Treino completo: iniciar a próxima rotina, coluna "anterior" visível, concluir série, timer aparece, recarregar a página e a sessão continua, finalizar, ver resumo com PR.
3. **Offline:** `context.setOffline(true)` no meio do treino, finalizar, sessão fica pendente, `setOffline(false)` e o treino aparece no histórico.
4. Refeição: escolher opção, marcar e ver a adesão atualizar; pós-treino aparece após treinar.
5. Story: cada layout exporta um PNG de 1080×1920 (validar dimensões do download).
6. Cardio: registrar 30 min, 4 km e 250 kcal; a barra semanal sobe.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Fundação:** Next.js, Tailwind 4, tokens Bctrl, fontes, shadcn, projeto Supabase via MCP, auth e `proxy.ts`, projeto Vercel via MCP, shell de navegação, deploy inicial na Vercel. Tudo depende disso.
2. **Esquema + seed + tipos gerados**, com testes de RLS.
3. **Rotinas e exercícios** (CRUD): base da sessão.
4. **Sessão de treino** (store local, anterior, timer, PR, `finish_workout`) e histórico. É o núcleo do produto.
5. **Evolução** (views, gráficos, PRs) e **peso corporal**.
6. **Refeições** (plano e registro do dia).
7. **Hábitos** (check, quantidade, cardio, streak) e `week_summary`.
8. **Tarefas.**
9. **Hoje** + `HexProgress`/Hex Week. Compõe as features anteriores.
10. **Story Studio** e os 4 layouts. Depende do histórico e do `week_summary`.
11. **Fila offline geral**, ajustes de acessibilidade, E2E completo.

### Dependências Técnicas

- Projeto Supabase (free) criado via MCP, região `sa-east-1`. Usuário único criado manualmente e signup desativado.
- Conta Vercel (MCP conectado) ligada ao repositório GitHub `by-BC/bctrl-hub` (branch `main`).
- Docker local para o `supabase start` (já instalado).
- Logo em `assets/brand/`, a ser copiado para `public/brand/`. O favicon sai de `bctrl-hub-symbol-dark.svg`.

## Monitoramento e Observabilidade

Uso pessoal, sem stack Prometheus/Grafana (fora de proporção). Fica:
- **Vercel Runtime Logs** para erros do servidor (`proxy`, Server Components).
- **Supabase Logs** (API/Postgres/Auth) e **Advisors** de segurança e performance, rodados após cada migration via MCP (`get_advisors`).
- **Erros do cliente:** `error.tsx` por segmento de rota e `console.error` com prefixo `[bctrl]`. Falhas de sync aparecem como toast persistente com contagem de pendências.
- **Vercel Speed Insights** (free), para conferir a meta de ≤ 2 s no Hoje.

## Considerações Técnicas

### Decisões Principais
- **Documentação conferida no Context7** (out/2026): `proxy.ts` do Next 16, `@supabase/ssr` com `getClaims()` e chave publicável, mutações offline do TanStack Query, `toPng` do html-to-image.

- **Supabase direto do cliente + RLS** em vez de Server Actions: evita uma API intermediária e permite a fila offline. Trade-off: a regra de segurança fica no banco, e por isso há testes de RLS obrigatórios.
- **Sessão ativa só no aparelho, gravada no fim**: zero escrita durante o treino, imune ao sinal fraco. Trade-off: se perder o aparelho no meio do treino, perde a sessão (aceitável). Rejeitado: local-first com Dexie, complexidade de sync desproporcional.
- **Timer por timestamp (`endsAt`)**, não por contador: continua certo com a tela bloqueada ou após reload. Vibração (`navigator.vibrate`) no fim, quando disponível.
- **Story no cliente com `html-to-image`**: CSS completo para layouts inovadores e privacidade da foto. Rejeitado: `@vercel/og`/Satori, por CSS limitado e upload da foto.
- **Views com `security_invoker`** para estatísticas, em vez de tabelas agregadas: dados pequenos (um usuário), sem lógica de consistência.
- **Bibliotecas:** shadcn/ui + Radix (acessibilidade pronta), Recharts 3, Zustand, TanStack Query 5, Zod 4, date-fns 4 + `@date-fns/tz`, `@dnd-kit`, lucide-react, sonner. Nada de lógica sob medida onde exista biblioteca madura.

### Riscos Conhecidos

- **`html-to-image` no iOS Safari:** fontes ou imagens podem sair em branco na primeira captura. Mitigação: `fonts.ready`, pré-carregar a foto como `dataURL`, fazer uma captura de aquecimento descartada e testar em aparelho real cedo (passo 10 com prova de conceito no passo 1).
- **`localStorage` limpo pelo iOS** (Safari descarta dados de sites após ~7 dias sem uso). Mitigação: o uso é diário e a sessão ativa dura minutos; documentar o risco.
- **Pausa do Supabase free** após 7 dias sem atividade. Mitigação: o uso diário evita; se acontecer, reativar pelo painel.
- **Web Share com arquivos** indisponível em alguns navegadores de desktop: fallback para download.
- **Fuso e virada de semana:** toda data de "dia" é calculada num único helper (`week.ts`), coberto por testes.

### Conformidade com Padrões

Não existe `CLAUDE.md`/`AGENTS.md` no repositório; o `AGENTS.md` global só trata do OpenPets e não se aplica. Padrões adotados e a registrar num `CLAUDE.md` na fundação:
- TypeScript `strict`; domínio puro em `src/lib/domain` sem I/O; features isoladas em `src/features/*`.
- Todo acesso a dados tipado com `database.types.ts` gerado; nunca editar o arquivo à mão.
- Toda tabela nova com `user_id` + RLS + teste de RLS; migrations só por arquivo em `supabase/migrations`.
- Cores e fontes só por tokens, nada de hex solto em componente.
- Gravações idempotentes, com id gerado no cliente.

### Arquivos relevantes e dependentes

- `tasks/prd-bctrl-hub/prd.md`: requisitos RF01–RF41.
- `tasks/prd-bctrl-hub/anexo-dados-iniciais.md`: fonte do `supabase/seed.sql`.
- `assets/brand/*.svg`: logo, favicon e `HexProgress`.
- A criar: `src/proxy.ts`, `src/lib/supabase/*`, `src/lib/domain/*`, `src/features/*`, `src/app/**`, `supabase/migrations/*`, `supabase/seed.sql`, `tests/e2e/*`, `CLAUDE.md`.

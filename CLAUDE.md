@AGENTS.md

# Bctrl Hub

App pessoal (usuário único) de treino, alimentação, hábitos e tarefas. Docs do produto em `tasks/prd-bctrl-hub/` (v1) e `tasks/prd-bctrl-hub-v2/` (v2: Hevy, catálogo, TACO, metas, Perfil), cada uma com `prd.md`, `techspec.md` e `tasks.md`.

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
| `npm run test:all` | typecheck + lint + unidade + integração + E2E (inclui axe) |
| `npm run db:types` | Regenera `src/lib/database.types.ts` |
| `npm run instructions:hevy` | Valida `scripts/hevy/instructions/*.json` (fora do Git) e gera `supabase/instructions.private.sql` |
| `npm run import:hevy` | Importação única do Hevy: dry-run gera `scripts/hevy/out/report.md`; `-- --write` gera `supabase/import.private.sql` (ver `scripts/hevy/run.ts`) |
| `npm run import:scale -- <planilha.xlsx>` | Importação única da balança: dry-run gera `scripts/scale/out/report.md`; `--write` gera `supabase/scale.private.sql` |
| `npm run meals:link` | Vincula o plano alimentar (seed privado) à TACO: dry-run gera `scripts/meals/out/report.md`; `-- --write` gera `supabase/meal-items.private.sql` |
| `npm run taco:convert` | Regenera a migration pública `…_foods_taco.sql` (597 alimentos, NEPA/Unicamp) |

`.env.local` (ignorado) aponta para o Supabase **local**; valores em `npx supabase status -o env`. Modelo em `.env.example`.

## Padrões obrigatórios

- **Next 16 é diferente do que você conhece**: ler `node_modules/next/dist/docs/` antes de usar uma API. Com Cache Components, ler cookies/`headers()`/`usePathname()` em rota dinâmica exige `<Suspense>` (ver `src/components/shell/bottom-nav.tsx`).
- **Auth**: o controle de acesso é o `src/proxy.ts` → `updateSession` (`src/lib/supabase/proxy.ts`) com `getClaims()`. Nada de código entre `createServerClient` e `getClaims()`. Layouts não leem a sessão no topo (mantém o shell estático).
- **Cadastro público desativado**: `[auth] enable_signup = false`. Não mexer em `[auth.email] enable_signup`: em `false` ele desliga o *login* por e-mail.
- **Dados**: cliente fala direto com o Supabase; toda tabela tem `user_id` + RLS + teste de RLS. Migrations só por arquivo em `supabase/migrations`. Tipos gerados, nunca editados à mão.
- **Gravações idempotentes**: id gerado no cliente (`crypto.randomUUID()`) + `upsert`.
- **Organização por funcionalidade**: rotas em `src/app`; cada domínio em `src/features/<feature>` com `api.ts`, `hooks.ts`, `components/`, `domain/` (regras puras) e `schemas/` (validação de entrada). `src/lib/domain` fica reservado a regras puras compartilhadas por vários módulos; `src/lib` mantém infraestrutura comum (Supabase, query, formatação). Componentes genéricos vivem em `src/components/ui` e o shell em `src/components/shell`. Não crie pastas globais `services`, `hooks` ou `utils` para espalhar lógica de uma funcionalidade.
- **Cores e fontes só por tokens** (`src/styles/tokens.css` + `@theme` em `globals.css`). Nada de hex solto em componente.
  - Texto azul sobre o fundo: `text-primary-text` (o `#2448DB` puro some no tema escuro).
  - Texto laranja: `text-highlight-text`. O `#D96735` puro fica em 3.1:1 sobre o off-white: só em ícone, preenchimento ou texto grande.
  - Texto grafite sobre fundo laranja: 4.2:1, só em texto grande ou negrito. Superfície laranja com texto pequeno (timer de descanso): `bg-highlight-surface` (5.7:1).
  - Número + unidade ("42,5 kg"): `<NumUnit>` (`src/components/num-unit.tsx`). O espaço em mono ocupa um caractere inteiro e parece duplo.
  - Números (cargas, reps, timer, métricas): classe `num` (IBM Plex Mono tabular).
- **Acessibilidade**: alvos de toque ≥ 44 px, estados com ícone ou texto (não só cor), `prefers-reduced-motion` respeitado globalmente, atalho "Pular para o conteúdo" no layout. `tests/e2e/a11y.spec.ts` roda o axe (WCAG 2.1 A/AA) em todas as rotas, nos 2 temas e 2 viewports, mais sheet aberto e sessão ativa: 0 violações *serious*/*critical*. Rota nova entra na lista desse teste. `aria-label` de botão começa pelo texto visível (regra `label-content-name-mismatch`).
- **Offline não é requisito** (decisão do dono, 2026-10-20): o app é web e funciona com rede. Não criar testes nem funcionalidades de offline. A fila abaixo continua no código (não atrapalha), mas sem E2E de offline.
- **Fila de gravações** (`src/components/providers/query-provider.tsx` + `src/lib/query/mutation-defaults.ts`): toda gravação usa uma entrada de `WRITES` (chave `[grupo, ação]` + função de envio), espalhada no `useMutation` do hook; nunca `mutationFn` inline num hook (um teste de unidade barra). As variáveis levam tudo o que o envio usa (nada de closure: a mutação pode ser reenviada depois de reabrir o app, sem o hook). `networkMode: 'offlineFirst'`, erro de rede repete até 8 vezes; sem rede, pausa. As gravações pendentes (só elas, nenhuma leitura) ficam no `localStorage` (`bctrl.queryCache`, `buster` + `maxAge` de 7 dias) e são reenviadas no `onSuccess` do provider e no evento `online`. Mudou a forma das variáveis de alguma gravação? Suba o `CACHE_BUSTER`. Sair limpa a fila. `SyncStatus` (shell) mostra offline / sincronizando / N pendentes. O treino ativo tem fila própria (`pendingSync` no store), fora disso.
- **Nada pessoal no Git** (repo público): `supabase/seed.sql`, o anexo de dados iniciais, PDFs e `.env*` estão no `.gitignore`.
- **Arquivos privados** (ignorados): `supabase/*.private.sql` (seed real e saídas de `import:hevy`, `instructions:hevy`, `meals:link`), `scripts/hevy/{data,out,instructions}/` e `scripts/meals/{data,out}/`. Sempre dry-run + relatório; aplicar no remoto só depois da revisão do dono, com `npx supabase db query --linked -f supabase/<arquivo>.private.sql`. `HEVY_API_KEY` só no `.env.local`, nunca impressa.
- **Composição privada**: a planilha da balança e o relatório ficam em `scripts/scale/{data,out}/`; o SQL real fica em `supabase/scale.private.sql`. Nenhum deles entra no Git.
- **Seeds**: `supabase/seed.example.sql` (fictício, versionado) roda no `npx supabase db reset` local e cria o usuário de E2E (`e2e@bctrl.test`) com 4 rotinas, 6 refeições e os hábitos do sistema. O seed real fica em `supabase/seed.private.sql` (ignorado, idempotente) e vai ao remoto com `npx supabase db query --linked -f supabase/seed.private.sql`. Migrations no remoto: `npx supabase db push` (nunca `--include-seed` nem `db reset --linked`).
- **Banco**: FKs entre tabelas do app são compostas com `user_id` (nada aponta para linha de outro usuário). Em insert em lote pelo supabase-js, passe `{ defaultToNull: false }` ou envie todas as colunas (colunas ausentes viram `null`). Hábitos com `system_key` não podem ser excluídos (trigger). `finish_workout` recebe o payload validado por `finishWorkoutSchema` (`src/features/workout-session/schemas/workout.ts`).

## Story Studio (task 9.0)

Treino usa `/treino/historico/[id]/story` para dois modelos da sessão concluída; Perfil usa `/perfil/stories/[id]` para os quatro layouts gerais (Recibo, Hex Week, Blueprint, Foto + overlay) e `/perfil/story` para o resumo diário. Dados de treino em `buildStoryData` (`src/features/story/domain/story.ts`, puro); layouts gerais em `src/features/story/layouts`, cada um 1080×1920 dentro do `StoryFrame`.
- **Exportação** (`src/features/story/export.ts`): `document.fonts.ready` + captura de aquecimento descartada + `pixelRatio: 1`. Validado na POC 1.10 no Chromium e **no iPhone real (Safari) em 2026-10-19: fontes Sora e IBM Plex Mono corretas no PNG**. Não remover nenhum dos três.
- **Compartilhar**: `navigator.share({ files })` quando `canShare` aceita arquivos; senão download. Cancelar o menu (AbortError) não é erro; outra recusa cai no download.
- **Dentro do quadro**: cores pelas classes `.story-ink` / `.story-paper` / `.story-blue` (`tokens.css`), fixas e independentes do tema do app. Nada essencial nos 250 px do topo e da base (guias tracejadas aparecem só em `next dev` e ficam fora do PNG). Evitar CSS `filter` (blur, drop-shadow) no quadro: falha no Safari dentro do `foreignObject`; usar gradiente ou `box-shadow`. Em SVG, cor por atributo `fill="currentColor"` (a classe `fill-current` saiu preta na captura).
- **Foto**: lida no aparelho (`loadPhoto` → dataURL reduzido), nunca enviada; o E2E confere que nenhuma requisição leva a imagem.
- **Validado no iPhone real (9.10, 2026-10-19)**: os 4 layouts, o menu nativo de compartilhar com a opção Instagram e o PNG saíram corretos. Android ainda não testado.
- **Card do mês (v2, task 8.0)**: `/perfil/mes/[month]/story` (`month` = `AAAA-MM`; `params` dentro de `<Suspense>`), atalho "Compartilhar mês" no resumo do Perfil. Dados em `buildMonthCardData` (`src/features/profile/domain/month-card.ts`, puro) a partir do `month_summary`, do `daily_scores` do mês e das conquistas; layout `MonthCard` no tom `.story-ink`, mesma exportação e mesmo compartilhar. O calendário usa `--heat-0…4`, que dentro de `.story-ink` apontam para a escala fixa `--heat-ink-*` (a mesma do tema escuro). Mês futuro ou inválido: "Mês não encontrado". Ainda sem validação no iPhone real.

## Composição corporal (v3)

- **Fonte dos dados**: `body_measurements` guarda as 17 métricas e tem RLS de dono. O trigger `sync_body_weight` mantém um único peso por dia em `body_weights`; entre medições do mesmo dia, vence a mais recente. Registro manual posterior pode substituir o peso do dia.
- **Importação**: `npm run import:scale -- <planilha.xlsx>` sempre começa em dry-run. A planilha e o SQL derivado são privados; o dono revisa o relatório antes de aplicar `supabase/scale.private.sql`.
- **Resumo mensal**: `month_summary` devolve `composition` em `current` e `previous`, ou `null` sem medição. Cada bloco contém primeira e última medição do mês, contagem e variações de peso, gordura em pontos percentuais e músculo esquelético em kg.
- **Conquistas**: “−1 ponto de gordura” usa a primeira data em que a queda desde a primeira medição chega a 1 p.p.; “Meta de composição atingida” considera qualquer `achieved_on`, inclusive de meta arquivada.
- **Card do mês**: mostra gordura e músculo dentro da área segura do story; mantém exportação PNG em 1080×1920.

## Perfil, pontuação e metas (v2)

- **Pontuação do dia** (`daily_scores`, `src/lib/domain/score.ts`): 1 ponto por critério (treino ou cardio, dieta ≥ 80%, todos os hábitos diários ativos, ≥ 1 tarefa); "dia no controle" = 3 ou 4. Sem hábito diário ativo, o critério de hábitos não conta.
- **Itens consumidos da refeição**: `meal_logs.selected_item_indices` guarda os índices, a partir de zero, dos itens realmente consumidos. `null` significa opção inteira e mantém compatibilidade com os registros antigos. A refeição continua contando como feita quando há ao menos um item; macros diários, card e média mensal usam somente a seleção. Nunca grave array vazio.
- **Resumo do mês** (`month_summary`, `summary-stats.ts`): mês sem registro de refeição (`nutrition.logged_days = 0`, época do Hevy) mostra "Sem registros", nunca 0%.
- **Conquistas** (`src/features/profile/domain/achievements.ts`): derivadas do histórico inteiro (inclui o Hevy), sem tabela.
- **Metas** (`goalsFromProfile`, `src/features/nutrition/domain/nutrition.ts`): Mifflin-St Jeor × fator de atividade × ajuste do objetivo; proteína em g/kg; gordura máx(0,8 g/kg, 20% das kcal); carboidrato o restante. Peso = último registro até o dia. Ajuste manual em `goal_overrides`.
- **TACO**: `foods` com `user_id` nulo (597 itens, migration pública); alimentos próprios do dono têm `user_id`. Macros das opções calculados no cliente.

# Tech Spec — Bctrl Hub v2 (Hevy, Perfil e Nutrição)

## Resumo Executivo

A v2 estende a arquitetura da v1 (Next.js 16 + Supabase com RLS, leitura no cliente com TanStack Query, domínio puro em `src/lib/domain`) sem mudar o stack.

**Importação do Hevy.** Script **local e único** (`scripts/hevy/`), executado na máquina do dono. Ele lê a **API oficial do Hevy** (`/v1/exercise_templates` e `/v1/workouts`, com a chave em `.env.local`) e complementa nome em português e vídeo com um mapa extraído uma vez do catálogo do site, pelo Chrome do dono. A saída é um SQL idempotente e privado (`supabase/import.private.sql`), aplicado com `supabase db query --linked`, mais um relatório de revisão. O catálogo é gravado como exercícios do dono (tabela `exercises`, estendida), o que mantém o modelo e o RLS da v1.

**Perfil.** Rota `/perfil` com heatmap (`react-activity-calendar`), resumo mensal, recordes e conquistas. Os números vêm de duas RPCs novas (`daily_scores`, `month_summary`); as conquistas são derivadas por função pura, sem tabela.

**Nutrição.** Tabela `foods` com a TACO (597 alimentos, MIT) como dado de referência. Os itens do plano ganham `food_id` e `grams` no jsonb existente, o fora do plano ganha a tabela `meal_log_items` e as metas vêm do perfil (`profiles`) por Mifflin-St Jeor, com ajuste manual.

## Arquitetura do Sistema

### Visão Geral dos Componentes

**Banco (migration nova `…_v2.sql` + `…_v2_rpcs.sql`)**
- `exercises` **modificada**: colunas `hevy_template_id`, `exercise_type`, `equipment`, `secondary_muscles`, `thumbnail_url`, `media_url`, `instructions`, `source`.
- `workout_sets` **modificada**:
  - `weight_kg` e `reps` passam a aceitar nulo;
  - colunas novas `distance_m`, `duration_s` e `set_type`;
  - check "pelo menos uma métrica preenchida".
- `workouts` **modificada**: `hevy_workout_id` (idempotência da importação) e `source`.
- **Novas tabelas:**
  - `profiles`: 1 linha por usuário.
  - `foods`: TACO global e alimentos próprios.
  - `meal_log_items`: alimentos fora do plano.
- **Views modificadas** (`v_exercise_session_stats`, `v_exercise_bests`, `v_exercise_last_sets`): ignoram `set_type = 'warmup'`. Carga, 1RM e volume só consideram séries com `weight_kg` e `reps`.
- **RPCs:**
  - `finish_workout` **modificada**: payload com `set_type`, `distance_m` e `duration_s`; compatível com o payload antigo.
  - `week_summary` **modificada**: kcal e macros da semana.
  - `daily_scores` **nova**.
  - `month_summary` **nova**.

**Importação (`scripts/hevy/`, nunca roda no app)**
- `catalog-pt.ts`: snippet para o console do navegador que gera o mapa `id → { pt_br_title, media_url }` a partir do catálogo carregado em hevy.com. A saída vai para `scripts/hevy/data/catalog-pt.json`, que é ignorado pelo Git.
- `api.ts`: cliente da API oficial (paginação, backoff em 429/5xx, `api-key` lida de `.env.local`).
- `map.ts`: funções puras (template → linha de `exercises`; workout → `workouts` / `workout_exercises` / `workout_sets`; vínculo com os 26 exercícios existentes).
- `instructions/*.json`: textos próprios de execução por `hevy_template_id`, escritos para o projeto.
- `run.ts`: orquestra. Em `--dry-run` (padrão) só gera o relatório. Com `--write` gera `supabase/import.private.sql` e `scripts/hevy/out/report.md`.

**Domínio puro (`src/lib/domain`)**
- `exercise-types.ts`: quais campos cada `exercise_type` usa.
- `workout.ts` **modificado**: PR e volume só para séries "de trabalho" com carga e reps; recordes de duração e distância.
- `score.ts`: pontuação do dia (0–4) e nível do heatmap.
- `achievements.ts`: catálogo de conquistas e avaliação (desbloqueada, data, progresso).
- `nutrition.ts`: macros de item, opção, dia; metas (Mifflin-St Jeor); consumido × meta.

**Features**
- `exercises` **nova** (catálogo): busca e filtros por músculo e equipamento, detalhe com mídia por link e instruções. O `exercise-picker` da v1 passa a usar o catálogo.
- `workout-session` **modificada**: `SetRow` por tipo de exercício (carga×reps, reps, duração, distância) e marcação de aquecimento.
- `profile` **nova**: `/perfil` com `ProfileForm`, `ControlHeatmap`, `MonthSummary`, `MonthRecords` e `Achievements`.
- `story` **modificada**: layout `MonthCard` no Story Studio, com rota `/perfil/mes/[yyyy-mm]/story`.
- `nutrition` **nova**:
  - `NutritionBars` (consumido × meta), usado em `/comida` e no painel Hoje.
  - `FoodSearch` (TACO).
  - `OffPlanSheet`.
  - Editor de vínculo item ↔ alimento em `/comida/plano`.
- `meals` **modificada**: mostra kcal e macros por opção; "fora do plano" com itens.
- **Shell**: link para o Perfil no `MobileHeader` (avatar) e no `SideNav`.

**Fluxo de dados**
- **Importação:** API do Hevy + `catalog-pt.json` → `map.ts` → SQL privado → Supabase remoto. Relatório em Markdown para revisar os vínculos; correções vão para `scripts/hevy/data/overrides.json` e o script roda de novo (idempotente).
- **Perfil:** cliente → `daily_scores(from, to)` + `month_summary(month)` → `score.ts`/`achievements.ts` → componentes.
- **Nutrição:** cliente busca `foods` (filtro `ilike` e `unaccent`, cache em memória) e o plano; `nutrition.ts` calcula no cliente. `meal_log_items` grava com a fila offline da v1.

## Design de Implementação

### Interfaces Principais

```ts
// src/lib/domain/exercise-types.ts
export type ExerciseType = "weight_reps" | "reps_only" | "bodyweight_reps" | "bodyweight_assisted_reps"
  | "duration" | "weight_duration" | "distance_duration" | "short_distance_weight";
export type SetType = "normal" | "warmup" | "failure" | "dropset";
export const FIELDS: Record<ExerciseType, ("weight" | "reps" | "distance" | "duration")[]>;
export const countsForRecords = (s: { set_type: SetType }) => s.set_type !== "warmup";
```

```ts
// src/lib/domain/nutrition.ts
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export function itemMacros(food: Food | null, grams: number | null, override?: Partial<Macros>): Macros | null;
export function optionMacros(items: PlanItem[], foods: Map<string, Food>): { total: Macros; unresolved: number };
export function dayTotals(input: { options: Macros[]; offPlan: Macros[] }): Macros;
export function goalsFromProfile(p: Profile, weightKg: number, trainingDay: boolean): Macros; // Mifflin-St Jeor
```

```ts
// src/lib/domain/score.ts e achievements.ts
export type DayScore = { day: string; trained: boolean; diet: boolean; habits: boolean; tasks: boolean; score: 0|1|2|3|4 };
export type Achievement = { key: string; title: string; rule: string; evaluate(ctx: AchievementCtx): { unlockedOn: string | null; progress: number } };
```

```ts
// scripts/hevy/map.ts
export function templateToExercise(t: HevyTemplate, pt?: PtEntry, instructions?: string): ExerciseRow;
export function workoutToRows(w: HevyWorkout, exerciseIdByTemplate: Map<string, string>): ImportedWorkout;
export function linkExisting(existing: ExerciseRow[], catalog: ExerciseRow[], overrides: Record<string,string>): LinkResult; // exato > normalizado > pendente
```

### Modelos de Dados

Todas as tabelas novas com `user_id default auth.uid()` + RLS de dono, exceto a parte de referência de `foods`.

| Tabela | Mudança / colunas |
|---|---|
| `exercises` | + `hevy_template_id text` (unique por usuário, nulo para exercícios criados no app), `exercise_type text default 'weight_reps'` (check nos 8 tipos), `equipment text`, `secondary_muscles text[] default '{}'`, `thumbnail_url text`, `media_url text`, `instructions text`, `source text default 'bctrl'` (`bctrl`\|`hevy`\|`hevy_custom`) |
| `workout_sets` | `weight_kg` e `reps` nulos permitidos; + `distance_m numeric(8,1)`, `duration_s int`, `set_type text default 'normal'`; check `num_nonnulls(weight_kg, reps, distance_m, duration_s) >= 1` |
| `workouts` | + `hevy_workout_id text` (unique por usuário), `source text default 'bctrl'` |
| `profiles` | `user_id pk`, `display_name`, `sex` (`m`\|`f`), `birth_date`, `height_cm`, `activity_level` (5 níveis), `goal` (`lose`\|`maintain`\|`gain`), `protein_g_per_kg numeric default 2.0`, `goal_overrides jsonb` (`{ rest: Macros?, training: Macros? }`) |
| `foods` | `id`, `user_id uuid null` (nulo = TACO), `taco_id int`, `name`, `category`, `kcal/protein_g/carbs_g/fat_g` por 100 g, `unit_grams jsonb` (ex.: `{"un": 50}`). RLS: select `user_id is null or user_id = auth.uid()`; escrita só nas linhas próprias |
| `meal_options.items` (jsonb) | cada item ganha `food_id?`, `grams?`, `macros_override?`. Itens "à vontade" ficam com `grams: 0` e flag `free: true` |
| `meal_log_items` | `id`, `user_id`, `meal_log_id fk cascade`, `food_id`, `grams`, `kcal/protein_g/carbs_g/fat_g` (**snapshot** no momento do registro) |

**Pontuação do dia (`daily_scores`)**, em SQL `security invoker`. Para cada dia do intervalo, em `America/Sao_Paulo`:
- `trained`: treino finalizado ou log de cardio no dia.
- `diet`: adesão do dia ≥ 0,8. Mesma regra do `week_summary`; o pós-treino só conta em dia de treino.
- `habits`: todos os hábitos ativos com `period = 'day'` cumpridos.
- `tasks`: pelo menos 1 tarefa com `done_at` no dia.

**Nível do heatmap** = `score`. Dias futuros não são retornados.

**Metas padrão (decisões das questões em aberto do PRD):**
- **TMB:** Mifflin-St Jeor (`10·peso + 6,25·altura − 5·idade + 5`, com `−161` no lugar do `+5` para sexo feminino).
- **Gasto diário:** TMB × fator de atividade (1,2 / 1,375 / 1,55 / 1,725 / 1,9).
- **Ajuste por objetivo:** −20% para perder, 0 para manter, +10% para ganhar.
- **Macros:** proteína = `protein_g_per_kg × peso`; gordura = 0,8 g/kg (mínimo de 20% das kcal); carboidrato = o restante.
- **Dia de treino:** +10% de carboidrato quando não houver override.

### Endpoints de API

Sem rotas HTTP próprias (como na v1). Interfaces novas:
- **`daily_scores(p_from date, p_to date) returns table(day, trained, diet, habits, tasks, score)`**: até 400 dias.
- **`month_summary(p_month date) returns jsonb`**:
  - treinos, volume, PRs (contagem e lista), dias com score ≥ 3, adesão média, cardio (min e km), kcal e proteína médias × meta;
  - os mesmos números do mês anterior.
- **`finish_workout(payload jsonb)`**: aceita `set_type`, `distance_m` e `duration_s` por série. `weight_kg` e `reps` passam a ser opcionais conforme o tipo do exercício. O `finishWorkoutSchema` (Zod) acompanha a mudança.
- **API do Hevy**, consumida só pelo script:
  - `GET /v1/exercise_templates?page&pageSize` (todas as ~152 páginas);
  - `GET /v1/workouts?page&pageSize` (82 treinos).

## Pontos de Integração

- **API oficial do Hevy:** header `api-key`, com a chave só em `.env.local` (já configurada, ignorada pelo Git). O script falha cedo se ela faltar.
  - Paginação até o fim, com backoff exponencial em 429/5xx e limite de 5 tentativas.
  - Datas em ISO-8601 UTC, convertidas para `day` em `America/Sao_Paulo`.
  - `distance_meters` vai para `distance_m`; as séries do tipo `warmup` vão para `set_type`.
  - Exercícios personalizados têm `exercise_template_id` em formato UUID: vão para `source = 'hevy_custom'`, com o nome original.
  - Depois da importação, **recomendar que o dono gere uma nova chave no Hevy**, porque a atual foi compartilhada no chat.
- **Catálogo do site (nome PT e vídeo):** um snippet de leitura roda no console de hevy.com, com a sessão do dono, e salva só `{ id, pt_br_title, media_url }`. Sem `pt_br_title`, o nome fica o em inglês e o caso entra no relatório.
- **Mídia por link:** `thumbnail_url` (API) e `media_url` (mp4) são exibidos direto do CDN. Testado: carregam sem restrição de referer.
  - `<img loading="lazy">` e `<video muted loop playsInline preload="none">`, que só toca no detalhe.
  - `onError` → placeholder com o símbolo Bctrl.
  - Nada é copiado para o Storage nem para o repositório.
- **TACO:** JSON de `marcelosanto/tabela_taco` (licença MIT) convertido por script para `supabase/migrations/…_foods_taco.sql`. É dado público e pode ser versionado. A fonte é citada no rodapé da busca de alimentos.
- **Aplicação no remoto:** migrations com `supabase db push`; dados pessoais (importação e vínculos dos itens do plano) com `supabase db query --linked -f supabase/*.private.sql`. O `.gitignore` ganha `supabase/*.private.sql`, `scripts/hevy/data/` e `scripts/hevy/out/`.

## Abordagem de Testes

### Testes Unidade

Vitest, sem mocks além dos fixtures:
- **`scripts/hevy/map.ts`**, com fixtures no formato real da API (anonimizados, versionados):
  - template para exercício, com e sem nome em PT;
  - workout para linhas, incluindo aquecimento, distância, duração e exercício personalizado;
  - `linkExisting` (exato, normalizado sem acento e caixa, override, pendente);
  - idempotência: mesmo input gera o mesmo SQL.
- **`workout.ts`:** aquecimento não gera PR nem volume; recordes de duração e distância.
- **`exercise-types.ts`:** campos por tipo.
- **`nutrition.ts`:**
  - `itemMacros` com gramas e unidade;
  - override;
  - item "à vontade";
  - item não resolvido;
  - `goalsFromProfile` com valores calculados à mão para 2 perfis;
  - dia de treino.
- **`score.ts`:** combinações dos 4 critérios.
- **`achievements.ts`:** cada conquista com data de desbloqueio e progresso, considerando o histórico importado.

### Testes de Integração

Supabase local:
- **RLS:** tabelas novas (`profiles`, `meal_log_items`); `foods` (outro usuário lê a TACO mas não lê nem altera alimentos próprios alheios).
- **`finish_workout`:** payload novo (duração, distância, aquecimento) e payload antigo ainda aceito.
- **Views:** aquecimento fora dos recordes; séries sem carga fora de 1RM e volume.
- **`daily_scores` e `month_summary`:** com dados semeados conhecidos, incluindo virada de mês em `America/Sao_Paulo`.
- **Importação:** aplicar o SQL gerado a partir de fixtures duas vezes não duplica nada; exercício vinculado reaproveita o id existente.

### Testes de E2E

Playwright, 1 worker, usuário descartável. Atenção à memória da máquina: nada de Lighthouse, e servidores encerrados ao fim.
1. **Catálogo:** filtrar "Peito" + "Halter", abrir o detalhe (mídia ou placeholder, e instruções) e adicionar à rotina.
2. **Sessão** com exercício de duração (prancha) e série de aquecimento: o resumo não conta o aquecimento como PR.
3. **Perfil:** heatmap com dias semeados (níveis corretos via atributo); trocar de mês no resumo; conquista desbloqueada visível.
4. **Nutrição:**
   - salvar o perfil e ver as metas calculadas;
   - marcar uma opção e ver as barras avançarem;
   - adicionar "Arroz, integral, cozido" 150 g fora do plano e conferir o total do dia;
   - offline, adicionar alimento e sincronizar.
5. **Card do mês:** exporta um PNG de 1080×1920.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Migrations de esquema** (exercises, workout_sets, workouts, profiles, foods, meal_log_items, views, `finish_workout`) + tipos + testes de RLS e de views. É a base de tudo.
2. **Tipos de exercício na sessão e no histórico** (`SetRow` por tipo, aquecimento, PRs). Precisa vir antes da importação, para os dados importados aparecerem certos.
3. **Script de importação do Hevy:**
   - extração do mapa PT;
   - `map.ts` com TDD;
   - dry-run, revisão dos vínculos com o dono e aplicação no remoto.
4. **Catálogo de exercícios** (busca, filtros, detalhe, mídia por link) + **instruções próprias**, escritas em lotes para os ~456 exercícios, priorizando os usados nas rotinas e no histórico.
5. **TACO + vínculo dos itens do plano** (auto-match por nome normalizado, revisão no editor) + macros por opção.
6. **Perfil e metas** (`profiles`, `goalsFromProfile`, `NutritionBars` em Comida e Hoje) + fora do plano com `FoodSearch`.
7. **`daily_scores` / `month_summary`** + página `/perfil` (heatmap, resumo, recordes, conquistas).
8. **Card do mês** no Story Studio + acabamento, acessibilidade (axe) e E2E completo.

### Dependências Técnicas

- **Task 10.0 da v1 concluída** (fila offline e axe), porque a v2 se apoia nas duas.
- **Chave da API do Hevy** válida no `.env.local` (já está).
- **Sessão do dono no hevy.com** pelo Chrome, para extrair o mapa PT.
- **Revisão humana** dos vínculos pendentes (exercícios e alimentos) antes de aplicar no remoto.

## Monitoramento e Observabilidade

Mesmo esquema da v1 (logs da Vercel e do Supabase, advisors após cada migration). Para a importação:
- o `report.md` registra as contagens (templates, exercícios criados e vinculados, pendentes, treinos e séries importados, ignorados com motivo);
- uma consulta de verificação pós-importação compara a contagem de treinos importados com o `workout_count` da API (82).

## Considerações Técnicas

### Decisões Principais

- **Catálogo como linhas de `exercises` do dono**, e não uma tabela global. Mantém RLS por usuário, FKs, seletor e views da v1 sem mudança estrutural. Custa ~456 linhas por usuário, irrelevante para uso pessoal.
- **API oficial em vez de raspagem.** Dados estruturados, ids estáveis (o vínculo do histórico é por `exercise_template_id`, imune ao idioma) e sem ler a interface. O site só complementa o nome em PT e o vídeo.
- **Script local em vez de tela de importação** (decisão do dono). A importação é única; o "relatório + revisão" vira Markdown + `overrides.json`. Sem segredos no app.
- **Mídia por link, sem cópia**, por ser mídia licenciada do Hevy. **Instruções próprias**, sem copiar `localised_instructions`.
- **Snapshot de macros em `meal_log_items`.** Editar um alimento depois não reescreve dias passados.
- **Conquistas derivadas, sem tabela.** Sempre coerentes com os dados (inclusive após editar o histórico), sem job de recálculo.
- **`react-activity-calendar`** (MIT, React 19), com tema dos tokens Bctrl e `renderBlock` para `data-level` e tooltip acessível.
- **Exceção de RLS documentada:** `foods` com `user_id` nulo para a TACO, de leitura geral para usuários autenticados, porque é dado público de referência.

### Riscos Conhecidos

- **Mídia do Hevy pode deixar de carregar.** Mitigação: placeholder e mapa de URLs regenerável.
- **Formato do catálogo embutido no site muda.** Afeta só o nome PT. Mitigação: o snippet valida a estrutura e cai no nome em inglês.
- **Vínculos errados de exercícios ou alimentos poluem a evolução e os macros.** Mitigação: dry-run, relatório e overrides, com aplicação só após revisão.
- **Limites da API do Hevy:** backoff e execução única.
- **Mudança em `workout_sets` (nulos) afeta views e telas da v1.** Mitigação: views e domínio filtram por tipo; a suíte da v1 roda inteira na task 1 da v2.
- **Memória da máquina no E2E:** manter 1 worker, sem Lighthouse, e encerrar servidores.

### Conformidade com Padrões

Seguindo o `CLAUDE.md`:
- Next 16 com `<Suspense>` em rotas dinâmicas (`/perfil/mes/[yyyy-mm]/story`).
- Auth pelo proxy.
- Toda tabela com `user_id` + RLS + teste. **Desvio:** a parte TACO de `foods`, justificada acima.
- Migrations só por arquivo e tipos gerados.
- Gravações idempotentes: id do cliente + upsert; na importação, `on conflict` por `hevy_*_id`.
- Domínio puro testável e features isoladas.
- Cores e fontes por tokens: heatmap e barras usam `--chart-*` e `primary-text`.
- Acessibilidade: tabela alternativa no heatmap, ícone e texto para excedente.
- Nada pessoal no Git: `*.private.sql`, `scripts/hevy/data|out` e a chave no `.env.local`.

### Arquivos relevantes e dependentes

- `tasks/prd-bctrl-hub-v2/prd.md` (RF01–RF26).
- **v1 afetada:**
  - `supabase/migrations/2026101823*.sql`;
  - `src/lib/schemas/workout.ts`;
  - `src/lib/domain/workout.ts`;
  - `src/features/workout-session/*`, `history/*`, `routines/components/exercise-picker*`, `meals/*`, `today/*`, `story/*`;
  - `src/components/shell/{mobile-header,side-nav}.tsx`.
- **A criar:**
  - `scripts/hevy/*`;
  - `src/lib/domain/{exercise-types,score,achievements,nutrition}.ts`;
  - `src/features/{exercises,profile,nutrition}/*`;
  - `src/app/(app)/perfil/**`;
  - migrations `…_v2*.sql`, `…_foods_taco.sql`.
- **Fontes externas:** API do Hevy (`api.hevyapp.com/v1`), `marcelosanto/tabela_taco` (MIT), `react-activity-calendar` 3.2.

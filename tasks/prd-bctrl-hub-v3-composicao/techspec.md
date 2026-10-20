# Tech Spec — Bctrl Hub v3: Composição Corporal

## Resumo Executivo

A v3 acrescenta composição corporal à arquitetura existente: Next.js 16 + Supabase com RLS, leitura no cliente com TanStack Query, domínio puro em `src/lib/domain` e gravações pelo registro `WRITES`. Nenhuma biblioteca nova entra no app; o script de importação usa `exceljs` (MIT).

As medições ficam numa tabela nova, **`body_measurements`**, com as 17 métricas (só o peso é obrigatório). Para manter uma **fonte única de peso** sem alterar quem já consome peso (metas, gráfico, perfil), um **trigger** grava o peso da medição mais recente do dia em `body_weights`.

O histórico entra por **script local único** (`scripts/scale/`), no mesmo fluxo da v2 (Hevy e TACO):
1. o script lê o `.xlsx`;
2. gera um relatório e um SQL privado idempotente;
3. o dono revisa e aplica.

O resto da v3 se apoia em funções puras de domínio:
- **Telas:** `/evolucao/composicao` reaproveita o `TrendChart` da Evolução.
- **Metas nutricionais:** passam a usar a TMB da balança (válida por 30 dias) e, opcionalmente, a proteína por massa magra.
- **Metas de composição:** tabela `composition_goals` e projeção por regressão linear sobre todo o histórico.
- **Perfil e card do mês:** o `month_summary` ganha as variações do mês.

## Arquitetura do Sistema

### Visão Geral dos Componentes

**Banco** (migrations novas `…_v3_composition.sql` e `…_v3_rpcs.sql`)
- `body_measurements` **nova**: medições, RLS de dono e checks de faixa por métrica.
- `body_weights` **modificada**: coluna `source` (`manual` | `scale`).
- Trigger **novo** `sync_body_weight` em `body_measurements` (insert, update e delete): recalcula o peso do dia.
- `composition_goals` **nova**: metas de composição, RLS de dono, no máximo uma meta ativa por métrica.
- `profiles` **modificada**: `bmr_source` (`auto` | `scale` | `formula`), `protein_basis` (`weight` | `lean_mass`) e `protein_g_per_kg_lean` (padrão 2,5).
- `month_summary` **modificada** (`create or replace`): acrescenta o bloco `composition` do mês e do mês anterior.

**Importação** (`scripts/scale/`, nunca roda no app)
- `parse.ts`: funções puras. Lê o `.xlsx` com `exceljs`, acha a linha de cabeçalho ("Data"), mapeia as colunas em PT para as chaves, converte datas e números e marca as linhas inválidas.
- `run.ts`:
  - `npm run import:scale -- <arquivo.xlsx>` em dry-run gera `scripts/scale/out/report.md`;
  - `--write` gera `supabase/scale.private.sql`;
  - o dono é resolvido por e-mail, como nos outros SQLs privados.

**Domínio puro** (`src/lib/domain`)
- `composition.ts` **novo**:
  - catálogo das 17 métricas (chave, rótulo, unidade, faixa válida, direção desejada e se é principal);
  - validação;
  - variações (contra a primeira e contra a anterior);
  - série para o gráfico;
  - progresso de meta;
  - `projectGoal` (regressão linear).
- `nutrition.ts` **modificado**: `goalBreakdown` recebe a TMB medida e a massa magra, escolhe a fonte da TMB e a base da proteína, e devolve qual fonte usou.
- `achievements.ts` **modificado**: +2 conquistas ("−1 ponto de gordura" e "Meta de composição atingida").
- `month-card.ts` **modificado**: variação de gordura e músculo no mês.

**Features**
- `composition` **nova**:
  - `api.ts` e `hooks.ts` (`useMeasurements`, `useLatestMeasurement`, `useCompositionGoals`; gravações no `WRITES`);
  - componentes: `LatestMeasurementCard`, `CompositionCharts` (principais + gordura kg × músculo kg), `MeasurementSheet` (formulário: principais visíveis, "Mais métricas" recolhido), `MeasurementDetail` e `CompositionGoals`.
- Rota **nova** `src/app/(app)/evolucao/composicao/page.tsx`.
- `progress` **modificada**: atalho "Composição" na seção de peso; o gráfico de peso mostra a origem do ponto (balança ou manual) na tabela "ver dados".
- `profile` **modificada**:
  - `profile-form`: fonte da TMB (automática, balança ou fórmula), com a data da medição usada, e a base da proteína;
  - `month-summary`: cartões de variação de peso, gordura e músculo ("sem medições" quando não houver);
  - atalho "Nova medição".
- `story/layouts/MonthCard.tsx` **modificado**: linha de composição quando houver medição no mês.
- `tests/e2e/a11y.spec.ts` **modificado**: inclui `/evolucao/composicao`, com o sheet aberto.

**Fluxo de dados**
- **Medição manual:** sheet → `WRITES.addMeasurement` (id do cliente + upsert) → `body_measurements` → trigger → `body_weights`. As invalidações cobrem as chaves de composição, peso, metas e semana/perfil.
- **Importação:** `.xlsx` → `parse.ts` → relatório → SQL privado → remoto, aplicado pelo dono. O trigger também atualiza `body_weights` durante a importação.
- **Metas nutricionais:** `useLatestMeasurement` + perfil → `goalBreakdown` → `NutritionBars` e formulário.

## Design de Implementação

### Interfaces Principais

```ts
// src/lib/domain/composition.ts
export type MetricKey = "weight_kg" | "bmi" | "body_fat_pct" | "fat_mass_kg" | "skeletal_muscle_pct"
  | "skeletal_muscle_kg" | "muscle_rate_pct" | "muscle_mass_kg" | "visceral_fat" | "water_pct" | "water_kg"
  | "bmr_kcal" | "obesity_pct" | "bone_kg" | "protein_pct" | "lean_mass_kg" | "metabolic_age";
export type MetricDef = { key: MetricKey; label: string; unit: string; min: number; max: number;
  better: "up" | "down" | "neutral"; principal: boolean };
export const PRINCIPAL: MetricKey[]; // weight_kg, body_fat_pct, skeletal_muscle_kg, visceral_fat, lean_mass_kg
export function validateMeasurement(m: Partial<Record<MetricKey, number>>): string[];
export function deltas(series: Point[], key: MetricKey): { sinceFirst: number | null; sincePrev: number | null };
export function projectGoal(points: Point[], target: number): { date: string } | { none: "insufficient" | "away" | "flat" | "reached" };
```

```ts
// src/lib/domain/nutrition.ts (assinatura estendida)
export type BmrInput = { measuredKcal?: number; measuredOn?: string; leanMassKg?: number };
export function goalBreakdown(p: CompleteProfile, weightKg: number, onDay: string, m?: BmrInput):
  GoalBreakdown & { bmrSource: "scale" | "formula"; bmrDate?: string; proteinBasis: "weight" | "lean_mass" };
```

```ts
// scripts/scale/parse.ts
export function parseScaleSheet(rows: unknown[][]): { header: { sex?: string; age?: number; heightCm?: number };
  measurements: ParsedMeasurement[]; skipped: { row: number; reason: string }[] };
export function toSql(ms: ParsedMeasurement[], ownerEmail: string): string; // upsert por (user_id, measured_at)
```

### Modelos de Dados

| Tabela | Colunas / regras |
|---|---|
| `body_measurements` | `id uuid pk`, `user_id` (padrão do app), `measured_at timestamptz not null`, `day date not null` (calculado no cliente, America/Sao_Paulo), `weight_kg numeric(5,2) not null`, as outras 16 métricas como `numeric` **nuláveis** (`metabolic_age int`), `source text` (`import` \| `manual`), `note text`, `created_at`. `unique (user_id, measured_at)`; checks de faixa iguais aos de `composition.ts`; índice `(user_id, day)` |
| `body_weights` | + `source text not null default 'manual'` (`manual` \| `scale`) |
| `composition_goals` | `id`, `user_id`, `metric text` (check em `weight_kg`, `body_fat_pct`, `skeletal_muscle_kg`, `visceral_fat`), `target numeric not null`, `target_date date`, `start_value numeric not null`, `start_day date not null`, `achieved_on date`, `archived_at`; índice único parcial `(user_id, metric) where archived_at is null` |
| `profiles` | + `bmr_source text default 'auto'`, `protein_basis text default 'weight'`, `protein_g_per_kg_lean numeric default 2.5` |

**Trigger `sync_body_weight`** (`security invoker`, `search_path = ''`), após insert, update ou delete em `body_measurements`, para cada `day` afetado:
- se ainda existe medição no dia, faz upsert em `body_weights` com o peso da medição de maior `measured_at` e `source = 'scale'`;
- se não existe mais medição e a linha do dia tem `source = 'scale'`, apaga essa linha;
- linhas com `source = 'manual'` ficam intocadas nesse caso.

Um registro manual posterior no mesmo dia sobrescreve a linha com `source = 'manual'`: a última gravação vence. Essa regra é a que está documentada. O upsert manual da v1 passa a enviar `source: 'manual'`.

**Bloco `composition` do `month_summary`** (mês e mês anterior): primeira e última medição do mês para `weight_kg`, `body_fat_pct` e `skeletal_muscle_kg`, variação e número de medições. Fica `null` quando o mês não tem medição.

**Fonte da TMB** (`goalBreakdown`):
- `auto`: usa a balança se a última medição com `bmr_kcal` tiver ≤ 30 dias; senão, a fórmula.
- `scale`: usa a balança se houver medição com `bmr_kcal`; senão, a fórmula, sinalizando que a escolha caiu na reserva.
- `formula`: sempre Mifflin-St Jeor.

**Base da proteína:** com `lean_mass`, a proteína-alvo é `protein_g_per_kg_lean × lean_mass_kg` da última medição que tiver essa métrica; sem ela, volta para a base peso.

**Projeção:** regressão linear por mínimos quadrados de valor × dia sobre **todo o histórico** da métrica (≥ 3 medições). A data é aquela em que a reta cruza o alvo. Os casos sem projeção:
- `away`: a inclinação aponta para longe do alvo;
- `flat`: inclinação próxima de zero;
- `reached`: o valor atual já atingiu o alvo.

### Endpoints de API

Sem rotas HTTP próprias.
- **PostgREST:** CRUD em `body_measurements` e `composition_goals`; `profiles` com os campos novos.
- **RPC `month_summary(p_month date)`:** mesmo contrato, com o bloco `composition` a mais (campo novo e opcional, sem quebrar os consumidores atuais).

## Pontos de Integração

- **Planilha da balança** (formato da amostra):
  - linha de título;
  - linha "Sexo：… Idade：… Altura：…" com dois-pontos de largura total (`：`);
  - linha de período;
  - cabeçalho com 19 colunas ("Data", "Tempo", "Peso(Kg)", "IMC", "Gordura(%)", …, "Idade metabólica");
  - dados com números em texto e ponto decimal, datas `dd/mm/aaaa` e hora `HH:mm`.

  O parser procura o cabeçalho pelo texto "Data" e mapeia as colunas pelo nome, não pela posição. Coluna desconhecida é ignorada e citada no relatório. Célula vazia ou "--" vira `null`. Linha sem data, hora ou peso válido é ignorada, com o motivo.
- **Aplicação no remoto:** `npx supabase db query --linked -f supabase/scale.private.sql`, rodado **pelo dono**, porque as gravações remotas são bloqueadas para agentes. O SQL faz `insert … on conflict (user_id, measured_at) do update`.
- **Privacidade:**
  - a planilha nunca é copiada para o repositório;
  - o `.gitignore` ganha `scripts/scale/out/`;
  - `supabase/*.private.sql` já está coberto;
  - os testes usam uma planilha **fictícia** gerada no próprio teste com `exceljs`.

## Abordagem de Testes

### Testes Unidade

Vitest:
- **`parse.ts`:**
  - planilha fictícia gerada em memória: cabeçalho, mapeamento por nome, `：`, números em texto, vazios, linha inválida;
  - `toSql` determinístico.
- **`composition.ts`:**
  - validação de faixas;
  - `deltas`;
  - `projectGoal`: alvo abaixo e acima, `away`, `flat`, `reached`, `insufficient`, com datas calculadas à mão.
- **`nutrition.ts`:**
  - as 3 fontes de TMB;
  - validade de 30 dias;
  - proteína por massa magra e o fallback;
  - a conta conferida à mão para 1 perfil.
- **`achievements.ts`** e **`month-card.ts`:** composição presente e ausente.

### Testes de Integração

Supabase local:
- **RLS:** `body_measurements` e `composition_goals`.
- **Trigger:**
  - insert gera peso `scale`;
  - 2 medições no dia: a mais recente vence;
  - update de peso;
  - delete da última volta ao estado anterior;
  - manual depois da medição sobrescreve;
  - delete de medição não apaga manual.
- **Índice único da meta ativa.**
- **`month_summary.composition`:** mês com medições, sem medições e mês anterior.
- **SQL do script:** gerado a partir da planilha fictícia e aplicado 2 vezes, sem duplicar.

### Testes de E2E

Playwright, 1 worker, usuário descartável, sem offline:
1. Registrar medição com as 5 principais. O card mostra a variação e o peso aparece na Evolução.
2. Validação de faixa com mensagem clara.
3. Criar meta de % de gordura com 3 medições semeadas: progresso e projeção visíveis.
4. `/perfil/dados` mostra "TMB: balança (dd/mm)" e alterna para fórmula.
5. Resumo do mês com variação de gordura e músculo. O card do mês exporta 1080×1920 com a linha de composição.
6. Axe em `/evolucao/composicao` (com o sheet aberto), nos dois temas.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Esquema e domínio:** migrations (tabelas, trigger, colunas de perfil), `composition.ts`, extensão do `goalBreakdown` e tipos gerados. Testes de RLS, do trigger e de unidade. É a base de tudo.
2. **Importação** (`scripts/scale/`): parser com TDD, dry-run, **parada para o dono revisar**, SQL privado e aplicação pelo dono.
3. **Tela de composição:** card, gráficos, detalhe e sheet de nova medição, com o atalho na Evolução.
4. **Metas de composição + integração com as metas nutricionais** (formulário do perfil, `NutritionBars`).
5. **Perfil e card do mês** (`month_summary.composition`, `MonthSummary`, `MonthCard`) + conquistas + axe + documentação.

### Dependências Técnicas

- V2 concluída: perfil, `month_summary`, card do mês e metas nutricionais.
- Planilha original em `C:\Users\bruno\Downloads\weight_Bruno_*.xlsx`, para o dry-run real.
- O dono aplica o SQL privado no remoto.
- `npx supabase db push` para as migrations, que agentes já executaram nas tasks anteriores.

## Monitoramento e Observabilidade

O mesmo esquema das versões anteriores (logs da Vercel e do Supabase, `get_advisors` após cada migration). O relatório da importação traz as contagens (linhas lidas, medições, ignoradas com motivo, período, métricas presentes). Depois da aplicação, uma consulta de verificação compara as contagens de `body_measurements` e de dias com `body_weights.source = 'scale'`.

## Considerações Técnicas

### Decisões Principais

- **Trigger para o peso do dia**, em vez de uma visão combinada (decisão do dono). Todos os consumidores atuais de peso seguem intactos. O custo é a regra de precedência no banco, coberta por testes de integração.
- **Script local para a importação** (decisão do dono), no padrão Hevy/TACO e sem tela de upload.
- **`exceljs` só no script**, como `devDependency`. O pacote `xlsx` do npm (0.18.5) está desatualizado e tem vulnerabilidades conhecidas.
- **Métricas como colunas**, não como pares chave/valor. São 17, fixas e numéricas, o que dá checks de faixa simples, tipos gerados claros e consultas diretas.
- **Projeção no cliente**, por função pura, com poucos pontos e testável.
- **Sem offline:** o app funciona com rede (decisão do dono, registrada no `CLAUDE.md`). As gravações seguem o padrão `WRITES` só por convenção do projeto.

### Riscos Conhecidos

- **Formato da planilha muda** numa versão futura do app da balança: o mapeamento é por nome, e coluna desconhecida aparece no relatório.
- **Medição de um dia diferente do registro manual:** cada dia é independente, então não há conflito.
- **Precisão da bioimpedância:** fora do escopo (o PRD exclui interpretação clínica).
- **Memória da máquina no E2E:** 1 worker, keep-awake e desktop completo só com ≥ 4 GB livres.

### Conformidade com Padrões

Seguindo o `CLAUDE.md`:
- tabelas com `user_id`, RLS e teste de RLS;
- FKs compostas quando houver referência;
- migrations só por arquivo e tipos gerados;
- gravações idempotentes (id do cliente + upsert; importação por `(user_id, measured_at)`);
- domínio puro testável;
- cores por tokens (variação boa ou ruim pela direção da métrica, com seta e texto);
- `<NumUnit>` e `num` para números;
- axe na rota nova;
- nada pessoal no Git;
- sem funcionalidades de offline.

Nenhum desvio.

### Arquivos relevantes e dependentes

- `tasks/prd-bctrl-hub-v3-composicao/prd.md` (RF01–RF23).
- **Existentes afetados:**
  - `supabase/migrations/*` (`body_weights`, `profiles`, `month_summary`);
  - `src/lib/domain/{nutrition,achievements,month-card}.ts`;
  - `src/features/progress/*`;
  - `src/features/profile/components/{profile-form,month-summary}.tsx`;
  - `src/features/story/layouts/MonthCard.tsx`;
  - `src/lib/query/mutation-defaults.ts`;
  - `tests/e2e/a11y.spec.ts`;
  - `tests/e2e/disposable-user.ts`.
- **A criar:**
  - `src/lib/domain/composition.ts`;
  - `src/features/composition/*`;
  - `src/app/(app)/evolucao/composicao/page.tsx`;
  - `scripts/scale/{parse,run}.ts`;
  - migrations `…_v3_*.sql`;
  - testes `tests/{unit,integration,e2e}/composition*`.

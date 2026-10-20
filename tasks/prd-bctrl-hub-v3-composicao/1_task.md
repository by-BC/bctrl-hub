# Tarefa 1.0: Esquema e domínio de composição

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Base da v3. No banco: as medições (`body_measurements`), as metas de composição (`composition_goals`), as colunas novas em `profiles` e `body_weights`, e o trigger que grava o peso do dia a partir da medição mais recente. No domínio puro: o catálogo das 17 métricas com validação, variações e projeção (`composition.ts`) e a extensão do `goalBreakdown` (TMB da balança e proteína por massa magra).

**Processo obrigatório: TDD.** Escreva primeiro os testes de integração (RLS, trigger, índice único da meta ativa) e os de unidade (`composition.ts`, `goalBreakdown`).

**Depende de:** v2 concluída. **Bloqueia:** 2.0 a 5.0.

<requirements>
- Techspec, seção **Modelos de Dados**: `body_measurements` (peso obrigatório, as outras 16 métricas nuláveis, checks de faixa, `unique (user_id, measured_at)`, índice `(user_id, day)`), `body_weights.source`, `composition_goals` (índice único parcial da meta ativa por métrica), colunas novas em `profiles`
- Trigger `sync_body_weight` (`security invoker`, `search_path = ''`) com a regra de precedência da techspec; o upsert manual da v1 passa a enviar `source: 'manual'`
- RLS de dono e testes de RLS para as tabelas novas
- `src/lib/domain/composition.ts`: `METRICS`, `PRINCIPAL`, `validateMeasurement`, `deltas` e `projectGoal` (regressão linear sobre todo o histórico, ≥ 3 pontos; casos `away`, `flat`, `reached` e `insufficient`)
- `goalBreakdown`/`goalsFromProfile` aceitam `BmrInput` e devolvem `bmrSource`, `bmrDate` e `proteinBasis`. Regras `auto`, `scale` e `formula` (30 dias); proteína por massa magra a 2,5 g/kg (padrão), com fallback para a base peso. A v2 não pode regredir
- Migrations novas (não editar as aplicadas); `npm run db:types`; `npx supabase db push`; `get_advisors`
</requirements>

## Subtarefas

- [ ] 1.1 (RED) Testes de integração: RLS de `body_measurements` e `composition_goals`; trigger (insert, 2 medições no dia, update, delete da última, manual depois da medição, delete sem apagar manual); índice da meta ativa
- [ ] 1.2 (RED) Testes de unidade de `composition.ts` (faixas, `deltas`, `projectGoal` com datas calculadas à mão) e do `goalBreakdown` (3 fontes de TMB, 30 dias, proteína por massa magra com fallback)
- [ ] 1.3 (GREEN) Migrations `…_v3_composition.sql` (tabelas, colunas, índices, RLS, trigger)
- [ ] 1.4 (GREEN) Domínio: `composition.ts` e a extensão de `nutrition.ts`; atualizar os chamadores existentes sem mudar o comportamento atual
- [ ] 1.5 Atualizar o upsert de peso manual (progress) para gravar `source: 'manual'` e incluir no `WRITES` as gravações novas (sem nada de offline)
- [ ] 1.6 (REFACTOR) `db:types`, `db push` no remoto, `get_advisors`
- [ ] 1.7 Rodar a suíte (unidade, integração, typecheck, lint, build); E2E só dos specs de peso e metas (`progress`, `nutrition-goals`)

## Detalhes de Implementação

Ver techspec: **Modelos de Dados** (tabelas, trigger, fonte da TMB, base da proteína, projeção), **Interfaces Principais** e **Decisões Principais**.

## Critérios de Sucesso

- Uma medição gravada aparece como peso do dia em `body_weights` com `source = 'scale'`, e apagá-la restaura o estado anterior
- `projectGoal` devolve a data esperada para uma série linear conhecida e `away` para uma tendência contrária
- As metas nutricionais da v2 continuam iguais para quem não tem medição
- Nenhum teste da v2 regride

## Testes da Tarefa

- [ ] Testes de unidade: `composition.ts` e `goalBreakdown` com as fontes de TMB e a base da proteína
- [ ] Testes de integração: RLS, trigger com todos os casos, índice da meta ativa; E2E de peso e metas sem regressão

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `supabase/migrations/…_v3_composition.sql`
- `src/lib/database.types.ts`, `src/lib/domain/composition.ts`, `src/lib/domain/nutrition.ts`
- `src/features/progress/api.ts`, `src/lib/query/mutation-defaults.ts`
- `tests/unit/composition.test.ts`, `tests/unit/goals.test.ts`, `tests/integration/composition.test.ts`

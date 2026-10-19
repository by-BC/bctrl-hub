# Tarefa 6.0: Pontuação do dia e resumo mensal

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Base de dados e regras do Perfil. Inclui:
- a RPC `daily_scores` (pontuação 0–4 "dia no controle" por dia);
- a RPC `month_summary` (números do mês e do mês anterior);
- as funções puras de pontuação (`score.ts`) e de conquistas (`achievements.ts`).

Tudo considera também o histórico importado do Hevy.

**Processo obrigatório: TDD** (testes de integração das RPCs com dados conhecidos e testes de unidade das conquistas primeiro).

**Depende de:** 2.0 (histórico) e 5.0 (kcal × meta no resumo). **Bloqueia:** 7.0.

<requirements>
- PRD RF11, RF13–RF16, RF26; techspec **Endpoints de API** e **Pontuação do dia**
- `daily_scores(p_from, p_to)`, `security invoker`, até 400 dias. Critérios em America/Sao_Paulo:
  - `trained`: treino finalizado ou cardio no dia;
  - `diet`: adesão ≥ 0,8, com a mesma regra do `week_summary`;
  - `habits`: todos os hábitos ativos com `period = 'day'` cumpridos;
  - `tasks`: pelo menos 1 tarefa concluída no dia.
  Dias futuros não são retornados
- `month_summary(p_month)`: treinos, volume, PRs (contagem + lista), dias com score ≥ 3, adesão média, cardio (min e km), kcal e proteína médias × meta; mesmos números do mês anterior
- `achievements.ts` com o catálogo inicial: primeiro PR; 4 semanas seguidas batendo a meta de treino; 30 dias no controle; 1.000 kg numa sessão; 100 treinos; mês com adesão ≥ 80%. Cada conquista com regra textual, data de desbloqueio e progresso
- Migration nova; `db:types`; `db push`; `get_advisors`
</requirements>

## Subtarefas

- [ ] 6.1 (RED) Testes de integração de `daily_scores` (cada critério isolado, combinações, virada de dia às 23h30 em UTC−3, dias futuros fora)
- [ ] 6.2 (RED) Testes de integração de `month_summary` (mês com dados conhecidos, mês vazio, comparação com o anterior, virada de mês)
- [ ] 6.3 (RED) Testes de unidade de `score.ts` e `achievements.ts` (desbloqueio, data, progresso, histórico importado)
- [ ] 6.4 (GREEN) Migration das RPCs e implementação do domínio
- [ ] 6.5 Hooks `useDailyScores(from, to)` e `useMonthSummary(month)`
- [ ] 6.6 (REFACTOR) Medir `daily_scores` de 365 dias no remoto (meta < 500 ms) e criar índices se preciso

## Detalhes de Implementação

Ver techspec: **Modelos de Dados → Pontuação do dia**, **Endpoints de API**, **Interfaces Principais** (`score.ts`, `achievements.ts`) e **Decisões Principais** (conquistas derivadas).

## Critérios de Sucesso

- Para uma semana semeada à mão, `daily_scores` devolve exatamente os scores esperados
- `month_summary` bate com cálculo manual em 2 meses distintos
- As conquistas desbloqueiam na data certa também com treinos importados do Hevy
- RLS: outro usuário recebe vazio nas duas RPCs

## Testes da Tarefa

- [ ] Testes de unidade: `score.ts` (16 combinações dos 4 critérios); `achievements.ts` (cada conquista: bloqueada, progresso parcial, desbloqueada com data)
- [ ] Testes de integração: `daily_scores` e `month_summary` com dados conhecidos, fuso e RLS

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `supabase/migrations/…_v2_scores.sql`
- `src/lib/domain/score.ts`, `src/lib/domain/achievements.ts`
- `src/features/profile/api.ts`, `src/features/profile/hooks.ts`
- `tests/integration/scores.test.ts`, `tests/unit/achievements.test.ts`, `tests/unit/score.test.ts`

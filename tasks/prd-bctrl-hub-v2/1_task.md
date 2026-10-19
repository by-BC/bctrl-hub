# Tarefa 1.0: Esquema v2 e tipos de série

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Preparar o banco e a sessão de treino para a v2. Ao final:
- exercícios têm tipo (carga×reps, só reps, duração, distância etc.), equipamento e mídia;
- séries aceitam duração, distância e tipo (aquecimento, normal…);
- existem as tabelas `profiles`, `foods` e `meal_log_items`;
- a tela de treino mostra os campos certos para cada tipo de exercício, e o aquecimento não conta para recordes nem volume.

**Processo obrigatório: TDD.** Escreva primeiro os testes de integração (RLS das tabelas novas, views, `finish_workout`) e os de unidade (`exercise-types.ts` e `workout.ts`).

**Depende de:** task 10.0 da v1 concluída. **Bloqueia:** todas as demais.

<requirements>
- Techspec, seção **Modelos de Dados**: colunas novas em `exercises`, `workout_sets` e `workouts`; tabelas `profiles`, `foods` (TACO com `user_id` nulo, ainda vazia nesta task) e `meal_log_items`
- `workout_sets`: `weight_kg`/`reps` aceitam nulo; check `num_nonnulls(...) >= 1`; `set_type` (`normal`, `warmup`, `failure`, `dropset`)
- Views `v_exercise_*` ignoram aquecimento; carga, 1RM e volume só com `weight_kg` e `reps`
- `finish_workout` aceita o payload novo **e** continua aceitando o antigo da v1
- RLS de dono em todas as tabelas novas; `foods` com a exceção documentada (leitura das linhas com `user_id` nulo)
- `src/lib/domain/exercise-types.ts` (campos por tipo) e `workout.ts` atualizado (aquecimento fora de PR e volume; recordes de duração e distância)
- Sessão e histórico renderizam o `SetRow` pelos campos do tipo do exercício; marcar uma série como aquecimento
- Migration nova (não editar as já aplicadas); `npm run db:types`; aplicar no remoto com `npx supabase db push`
</requirements>

## Subtarefas

- [ ] 1.1 (RED) Testes de integração: RLS de `profiles`, `meal_log_items` e `foods` (outro usuário lê a TACO, mas não os alimentos próprios do dono); views sem aquecimento; `finish_workout` com payload novo e antigo
- [ ] 1.2 (RED) Testes de unidade de `exercise-types.ts` e dos cenários novos de `workout.ts`
- [ ] 1.3 (GREEN) Migration `…_v2.sql` (colunas, tabelas, constraints, índices, RLS) e `…_v2_rpcs.sql` (views e `finish_workout`)
- [ ] 1.4 (GREEN) Atualizar `finishWorkoutSchema` (Zod), o domínio e o store da sessão (campos por tipo, `set_type`)
- [ ] 1.5 `SetRow` por tipo (carga×reps, reps, duração mm:ss, distância km) e ação "marcar como aquecimento", com selo textual
- [ ] 1.6 Histórico e evolução exibindo séries de duração e distância corretamente
- [ ] 1.7 (REFACTOR) `db:types`, `db push` no remoto, `get_advisors` sem alertas novos
- [ ] 1.8 Rodar a suíte inteira da v1 + v2 (sem regressão)

## Detalhes de Implementação

Ver techspec: **Modelos de Dados**, **Endpoints de API** (`finish_workout`), **Interfaces Principais** (`exercise-types.ts`) e **Riscos Conhecidos** (nulos em `workout_sets` afetam a v1).

## Critérios de Sucesso

- Um treino com prancha (60 s), corrida (2 km / 12 min) e supino com 1 série de aquecimento é finalizado e aparece certo no histórico
- O aquecimento não gera PR nem entra no volume
- Payload antigo da v1 continua sendo aceito
- Nenhum teste da v1 regride

## Testes da Tarefa

- [ ] Testes de unidade: `exercise-types.ts`; `workout.ts` (aquecimento, séries sem carga, recordes de duração e distância); store com campos por tipo
- [ ] Testes de integração: RLS das tabelas novas e de `foods`; views; `finish_workout` (novo, antigo, inválido); E2E de uma sessão com prancha e aquecimento

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `supabase/migrations/…_v2.sql`, `…_v2_rpcs.sql`
- `src/lib/database.types.ts`, `src/lib/schemas/workout.ts`
- `src/lib/domain/exercise-types.ts`, `src/lib/domain/workout.ts`
- `src/features/workout-session/*`, `src/features/history/*`, `src/features/progress/*`
- `tests/integration/v2-schema.test.ts`, `tests/unit/exercise-types.test.ts`, `tests/e2e/workout-types.spec.ts`

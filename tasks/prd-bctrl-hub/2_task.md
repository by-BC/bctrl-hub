# Tarefa 2.0: Banco de dados: esquema, RLS, views, RPCs e seed

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Criar todo o modelo de dados do app no Supabase, com segurança por linha (RLS), as views de estatística, as funções `finish_workout` e `week_summary`, o seed com o treino e a dieta reais (local, fora do Git) e os tipos TypeScript gerados. É a base de todas as features.

**Processo obrigatório: TDD (red-green-refactor).** Escreva primeiro os testes de RLS e das RPCs, veja-os falhar e só então crie as migrations.

**Depende de:** 1.0. **Bloqueia:** 3.0 a 10.0.

<requirements>
- 13 tabelas da seção "Modelos de Dados" da techspec, todas com `user_id default auth.uid()` e política RLS `user_id = auth.uid()`
- Views `v_exercise_session_stats`, `v_exercise_bests` e `v_exercise_last_sets` com `security_invoker = true`
- RPC `finish_workout(payload jsonb)`: transacional e idempotente pelo `id`
- RPC `week_summary(p_week_start date)`: resumo da semana em uma chamada
- Seed real em `supabase/seed.sql` (ignorado pelo Git) a partir de `anexo-dados-iniciais.md`; `supabase/seed.example.sql` versionado com dados fictícios
- Hábitos do sistema com `system_key` (`cardio`, `abs`, `supplements`) não podem ser excluídos
- `src/lib/database.types.ts` gerado, nunca editado à mão
- Advisors de segurança do Supabase sem alertas críticos
</requirements>

## Subtarefas

- [ ] 2.1 (RED) Escrever testes de integração de RLS: com dois usuários de teste, B não lê, não altera e não apaga dados de A em cada tabela e view
- [ ] 2.2 (RED) Escrever testes de `finish_workout` (atomicidade e idempotência) e de `week_summary` (valores conhecidos)
- [ ] 2.3 (GREEN) Migration de tabelas, chaves, índices (`user_id`, `day`, FKs) e constraints `unique`
- [ ] 2.4 (GREEN) Migration de políticas RLS para todas as tabelas, mais o bloqueio de exclusão de hábitos do sistema
- [ ] 2.5 (GREEN) Migration das views com `security_invoker`
- [ ] 2.6 (GREEN) Migration das RPCs `finish_workout` e `week_summary`
- [ ] 2.7 Escrever `seed.example.sql` (fictício) e `seed.sql` (real, local) com 4 rotinas, 26 exercícios únicos, 6 refeições com opções e substituições, e 3 hábitos do sistema
- [ ] 2.8 Gerar `database.types.ts` e criar o schema Zod `finishWorkoutSchema`
- [ ] 2.9 (REFACTOR) Revisar nomes e índices; aplicar as migrations no projeto remoto via MCP e rodar `get_advisors` (segurança e performance)
- [ ] 2.10 Aplicar o seed real no projeto remoto para o usuário do dono
- [ ] 2.11 Rodar toda a suíte da tarefa contra o Supabase local

## Detalhes de Implementação

Ver techspec: **Modelos de Dados** (tabela de colunas, views), **Endpoints de API** (contratos das RPCs) e **Decisões Principais** (views em vez de tabelas agregadas). O hábito "Treino" é derivado de `workouts` e não tem logs. Datas de "dia" são `date` calculadas no cliente (`America/Sao_Paulo`).

## Critérios de Sucesso

- 100% das tabelas e views com RLS testado e aprovado
- Chamar `finish_workout` duas vezes com o mesmo payload resulta em um único treino
- Payload inválido não grava nada (sem dados parciais)
- `supabase db reset` local roda migrations + seed de exemplo sem erro
- No remoto: 4 rotinas, 28 itens de rotina (26 exercícios únicos) e 6 refeições visíveis para o dono
- `git status` nunca mostra `supabase/seed.sql`

## Testes da Tarefa

- [ ] Testes de unidade: `finishWorkoutSchema` aceita payload válido e rejeita carga negativa, reps não inteiras e listas vazias
- [ ] Testes de integração (Supabase local + Vitest): isolamento por RLS em todas as tabelas e views; atomicidade e idempotência do `finish_workout`; `week_summary` com dados semeados; proteção dos hábitos do sistema; contagens do seed de exemplo

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `supabase/migrations/*_schema.sql`, `*_rls.sql`, `*_views.sql`, `*_rpcs.sql`
- `supabase/seed.sql` (local, ignorado), `supabase/seed.example.sql`
- `src/lib/database.types.ts`, `src/lib/schemas/workout.ts`
- `tests/integration/rls.test.ts`, `tests/integration/rpc.test.ts`
- `tasks/prd-bctrl-hub/anexo-dados-iniciais.md` (fonte do seed)

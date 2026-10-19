# Tarefa 6.0: Plano alimentar e refeições

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Registrar a adesão ao plano alimentar: o plano (refeições, opções, itens e substituições) já vem cadastrado e é editável; no dia a dia, o dono toca na refeição, escolhe a opção que comeu e marca como feita, ou marca "fora do plano" com uma nota.

**Depende de:** 2.0. A regra do pós-treino usa dados de treino (4.0); até a 4.0 existir, testar com treinos semeados. **Pode correr em paralelo com:** 3.0, 4.0, 5.0 e 7.0.

<requirements>
- RF26 a RF31
- `/comida`: refeições do dia em ordem de horário, com seletor de data (ontem/hoje/amanhã)
- Tocar na refeição abre um Sheet com as opções (itens, quantidades e substituições recolhíveis); escolher marca como feita
- "Fora do plano" com nota livre
- Pós-treino visível só em dia com treino iniciado (sessão ativa local) ou finalizado
- Adesão do dia (feitas/previstas) e da semana
- `/comida/plano`: editar refeições (nome, horário, só em dia de treino) e opções (título, itens em lista editável)
- Marcar ou desmarcar com *optimistic update* e `upsert` idempotente (`unique(user_id, day, meal_id)`)
</requirements>

## Subtarefas

- [ ] 6.1 Funções de domínio em `src/lib/domain/meals.ts`: `visibleMeals(meals, hasWorkout)` e `adherence(logs, visibleMeals)`
- [ ] 6.2 Hooks `useMealPlan`, `useMealLogs(day)` e mutações `logMeal`, `unlogMeal`
- [ ] 6.3 Tela `/comida` com cards por refeição (horário em Plex Mono, estado feito/pendente/fora do plano com ícone + texto)
- [ ] 6.4 Sheet de opções com substituições recolhíveis e a ação "fora do plano"
- [ ] 6.5 Editor `/comida/plano`
- [ ] 6.6 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: tabelas `meals`, `meal_options` (itens em `jsonb`) e `meal_logs` em **Modelos de Dados**; `src/lib/domain/meals.ts` em **Visão Geral dos Componentes**; testes unitários de `meals.ts` em **Testes Unidade**.

## Critérios de Sucesso

- Marcar uma refeição leva ≤ 3 toques
- Em dia sem treino, o pós-treino não aparece e não conta na adesão
- Trocar a opção escolhida atualiza o registro sem duplicar
- O plano editado reflete imediatamente na tela do dia

## Testes da Tarefa

- [ ] Testes de unidade: `visibleMeals` com e sem treino; `adherence` (0 refeições, todas feitas, fora do plano conta como registrada mas não aderente, conforme regra definida no código e documentada)
- [ ] Testes de integração: `upsert` em `meal_logs` não duplica; Playwright marca o café com a Opção 2 e vê a adesão subir; marca o jantar como fora do plano com nota; com treino semeado no dia, o pós-treino aparece

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/lib/domain/meals.ts`
- `src/features/meals/*`
- `src/app/(app)/comida/page.tsx`, `src/app/(app)/comida/plano/page.tsx`
- `tests/unit/meals.test.ts`, `tests/e2e/meals.spec.ts`

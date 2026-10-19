# Tarefa 7.0: Hábitos e tarefas

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Hábitos recorrentes com metas diárias ou semanais (cardio, abdominal, suplementos e hábitos customizados), com progresso da semana e sequência (streak), mais a lista de tarefas simples. O hábito "Treino" é derivado automaticamente das sessões.

**Depende de:** 2.0. **Pode correr em paralelo com:** 3.0, 4.0, 5.0 e 6.0.

<requirements>
- RF32 a RF38
- Tipos de hábito: `check`, `quantity` e `cardio`; período `day` ou `week`; meta numérica
- Cardio: tipo (esteira, bike, escada, caminhada, corrida, outro), minutos, distância opcional (km) e calorias opcionais (kcal); meta soma os minutos; totais de km e kcal da semana
- Hábitos do sistema editáveis mas não excluíveis; customizados podem ser criados, arquivados e excluídos
- Streak = semanas consecutivas com meta cumprida (semana segunda→domingo, `America/Sao_Paulo`)
- Tarefas: criar (Enter), concluir/desfazer, excluir; concluídas em seção recolhida
- Toda data de "dia" e "semana" calculada em `src/lib/domain/week.ts`
</requirements>

## Subtarefas

- [ ] 7.1 Implementar `src/lib/domain/week.ts` (`weekStart`, `dayKey`, `weekDays`) com testes da virada de domingo para segunda às 23h30 em UTC−3
- [ ] 7.2 Funções `habitProgress(habit, logs, week)` e `streak(habit, logsByWeek)`
- [ ] 7.3 Hooks e mutações de hábitos e logs (`useHabits`, `useHabitLogs(week)`, `logHabit`, `undoHabitLog`)
- [ ] 7.4 Tela `/habitos`: cards com barra de progresso semanal, botão de check rápido, sheet de cardio (tipo, min, km, kcal), streak
- [ ] 7.5 Criar e editar hábito customizado (nome, tipo, período, meta, unidade); arquivar e excluir
- [ ] 7.6 Tela `/tarefas` com criação rápida, conclusão, exclusão e seção "Concluídas" recolhida
- [ ] 7.7 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: tabelas `habits`, `habit_logs` e `tasks` em **Modelos de Dados**; `week.ts` em **Visão Geral dos Componentes**; riscos de fuso em **Riscos Conhecidos**.

## Critérios de Sucesso

- Registrar 30 min de cardio atualiza a barra para 30/150 imediatamente
- Abdominal 3/3 na semana marca a meta como cumprida e incrementa o streak
- Um log às 23h30 de domingo conta para a semana certa
- Tentar excluir um hábito do sistema não é possível pela interface nem pela API
- Criar uma tarefa leva 1 campo + Enter

## Testes da Tarefa

- [ ] Testes de unidade: `week.ts` (virada de semana, fuso); `habitProgress` para check, quantity e cardio; `streak` com semana falhada no meio
- [ ] Testes de integração: totais de cardio (min, km, kcal) na semana a partir de logs semeados; Playwright registra cardio de 30 min/4 km/250 kcal e vê a barra subir; cria um hábito customizado e marca; cria, conclui e exclui uma tarefa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/lib/domain/week.ts`, `src/lib/domain/habits.ts`
- `src/features/habits/*`, `src/features/tasks/*`
- `src/app/(app)/habitos/page.tsx`, `src/app/(app)/tarefas/page.tsx`
- `tests/unit/week.test.ts`, `tests/unit/habits.test.ts`, `tests/e2e/habits-tasks.spec.ts`

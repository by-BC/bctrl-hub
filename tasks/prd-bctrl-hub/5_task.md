# Tarefa 5.0: Evolução e peso corporal

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Telas para acompanhar a evolução: gráficos por exercício (melhor carga, 1RM estimado e volume), recordes pessoais, histórico de séries e registro de peso corporal com gráfico de tendência. Pensada para ser confortável no PC, mas funcional no celular.

**Depende de:** 4.0. **Pode correr em paralelo com:** 6.0 e 7.0.

<requirements>
- RF23, RF24, RF25
- `/evolucao`: lista de exercícios com último treino e melhor carga; busca
- `/evolucao/[exerciseId]`: gráfico (Recharts) com alternância entre carga, 1RM e volume; filtro de 1 mês, 3 meses ou tudo; lista de PRs; histórico de séries por sessão
- Peso corporal: registrar (data + kg, um por dia, `upsert`), gráfico de tendência com média móvel de 7 dias
- Gráficos com cores dos tokens, números em IBM Plex Mono, tooltip acessível e tabela alternativa ("ver dados") para leitores de tela
- Seguir a skill `dataviz` ao desenhar os gráficos
</requirements>

## Subtarefas

- [ ] 5.1 Função de domínio `movingAverage(points, window)` e transformação das linhas da view para o formato do gráfico
- [ ] 5.2 Hooks `useExerciseStats(exerciseId, range)`, `useExerciseBests`, `useBodyWeights` e mutação `upsertBodyWeight`
- [ ] 5.3 Tela `/evolucao` com lista e busca
- [ ] 5.4 Tela `/evolucao/[exerciseId]` com gráfico, filtros, PRs e histórico
- [ ] 5.5 Seção de peso corporal: formulário rápido + gráfico; layout em 2 colunas a partir de 1024 px
- [ ] 5.6 Estados vazios ("Nenhum treino com este exercício ainda")
- [ ] 5.7 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: views `v_exercise_session_stats` e `v_exercise_bests` em **Modelos de Dados**; tabela `body_weights`; feature `progress` em **Visão Geral dos Componentes**.

## Critérios de Sucesso

- Os valores do gráfico batem com os treinos registrados (conferir 1 caso manualmente)
- O filtro de período altera os dados sem recarregar a página
- Registrar o peso duas vezes no mesmo dia atualiza o valor em vez de duplicar
- Gráficos legíveis em 375 px e em 1440 px, nos temas claro e escuro

## Testes da Tarefa

- [ ] Testes de unidade: `movingAverage` (janela maior que os dados, dias faltando); transformação view → série do gráfico; filtro de período
- [ ] Testes de integração: com 3 sessões semeadas, a view retorna 3 pontos com best e volume corretos; Playwright registra o peso, vê o ponto no gráfico, abre um exercício, troca a métrica e o período

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/features/progress/*`
- `src/lib/domain/stats.ts`
- `src/app/(app)/evolucao/page.tsx`, `src/app/(app)/evolucao/[exerciseId]/page.tsx`
- `tests/unit/stats.test.ts`, `tests/e2e/progress.spec.ts`

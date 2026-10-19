# Tarefa 4.0: Sessão de treino e histórico

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

O núcleo do app: registrar o treino na academia no estilo Hevy. A sessão ativa vive no aparelho (Zustand + `localStorage`), mostra a carga anterior, dispara o timer de descanso, detecta recordes (PR) e só grava no banco ao finalizar, via `finish_workout`, resistindo a sinal fraco. Inclui o histórico de sessões.

**Processo obrigatório: TDD (red-green-refactor)** para `src/lib/domain/workout.ts` e para o store da sessão.

**Depende de:** 3.0. **Bloqueia:** 5.0, 8.0 e 9.0.

<requirements>
- RF09 a RF18
- Treino sugerido = próxima rotina da sequência após a última concluída (RF40, função `nextRoutineId`)
- Ao iniciar, buscar e guardar no store a carga anterior (`v_exercise_last_sets`) e os recordes (`v_exercise_bests`) de cada exercício, para funcionar sem rede
- Timer baseado em `endsAt` (timestamp), ajustável em ±15 s, com opção de pular; vibração ao terminar, quando houver suporte
- PR por carga, volume da série e 1RM estimado (Epley); empate não é PR
- Recarregar ou fechar a aba não perde a sessão
- Finalizar sem rede: sessão marcada `pendingSync`, nova tentativa com backoff, só é limpa após confirmação do servidor
- Resumo final: duração, volume, séries e PRs
- Histórico: lista, detalhe, edição e exclusão de sessões passadas
- Campos numéricos com `inputMode="decimal"` (carga) e `"numeric"` (reps); alvos de toque ≥ 44 px
</requirements>

## Subtarefas

- [ ] 4.1 (RED) Testes de `e1rm`, `detectPrs` e `nextRoutineId` cobrindo os casos extremos da techspec
- [ ] 4.2 (GREEN/REFACTOR) Implementar `src/lib/domain/workout.ts`
- [ ] 4.3 (RED) Testes do store: reidratação, `completeSet` inicia o timer, `addSet`/`addExercise` não alteram a rotina-base, geração de payload válido para `finishWorkoutSchema`
- [ ] 4.4 (GREEN/REFACTOR) Implementar `useActiveWorkout` com `persist`
- [ ] 4.5 Tela `/treino/sessao`: lista de exercícios com observações técnicas recolhíveis, `SetRow` (anterior · kg · reps · ✓), adicionar série e exercício
- [ ] 4.6 `RestTimer` fixo na parte de baixo da tela, em IBM Plex Mono e laranja, com +15/−15/pular
- [ ] 4.7 Selo de PR na série (ícone + texto, não só cor)
- [ ] 4.8 `FinishSheet` com resumo e o fluxo de `pendingSync` com retry e toast
- [ ] 4.9 Retomar a sessão: ao abrir o app com sessão ativa, mostrar "Continuar treino"
- [ ] 4.10 Histórico `/treino/historico` e detalhe `/treino/historico/[id]` com edição e exclusão
- [ ] 4.11 Escrever e rodar os testes de integração e E2E

## Detalhes de Implementação

Ver techspec: **Interfaces Principais** (`workout.ts` e `store.ts`), **Pontos de Integração** (falha no `finish_workout`), **Decisões Principais** (sessão local, timer por timestamp) e **Testes de E2E** (cenários 2 e 3).

## Critérios de Sucesso

- Registrar uma série leva ≤ 2 toques após digitar carga e reps
- Após recarregar no meio do treino, todas as séries e o timer continuam corretos
- Em modo offline, finalizar não perde dados e o treino aparece no histórico ao reconectar
- Um PR aparece imediatamente ao concluir a série que o bate
- O treino sugerido segue U1 → L1 → U2 → L2 → U1

## Testes da Tarefa

- [ ] Testes de unidade: `workout.ts` (primeiro registro, empate, PR só de volume, reps nulas, volta de L2 para U1, rotina arquivada ignorada); store da sessão (persistência, timer por `endsAt`, payload)
- [ ] Testes de integração: `finish_workout` com payload gerado pelo store grava a estrutura completa; views retornam anterior e bests corretos após 2 sessões; Playwright cobre o treino completo com reload no meio e o treino finalizado offline (`context.setOffline`)

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/lib/domain/workout.ts`
- `src/features/workout-session/{store.ts,SetRow.tsx,RestTimer.tsx,FinishSheet.tsx}`
- `src/features/history/*`
- `src/app/(app)/treino/sessao/page.tsx`, `src/app/(app)/treino/historico/**`
- `tests/unit/workout.test.ts`, `tests/unit/active-workout-store.test.ts`, `tests/e2e/workout-session.spec.ts`

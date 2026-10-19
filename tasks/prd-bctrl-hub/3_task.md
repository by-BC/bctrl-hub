# Tarefa 3.0: Rotinas e exercícios

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Telas para ver e gerenciar as rotinas de treino (estilo Hevy *routines*) e a biblioteca de exercícios. Ao final, o dono vê Upper 1, Lower 1, Upper 2 e Lower 2 em `/treino` e consegue editar exercícios, séries, descanso e observações técnicas.

**Depende de:** 2.0. **Pode correr em paralelo com:** 6.0 e 7.0.

<requirements>
- RF04 a RF08
- Lista de rotinas em `/treino` na ordem da sequência (`position`)
- Editor em `/treino/rotinas/[id]`: nome, observações, descanso padrão, exercícios ordenados (séries, descanso, observação por exercício)
- Reordenar rotinas e exercícios por arrastar (`@dnd-kit/sortable`) e por botões subir/descer (acessibilidade)
- Biblioteca de exercícios: buscar, criar (nome + grupo muscular), editar; não duplicar nome
- Arquivar rotina em vez de apagar quando já houver treinos registrados
- Leituras e gravações via TanStack Query + `supabase-js` com tipos gerados
</requirements>

## Subtarefas

- [x] 3.1 Configurar `QueryProvider` (TanStack Query) no layout, se ainda não existir
- [x] 3.2 Hooks `useRoutines`, `useRoutine(id)`, `useExercises` e mutações (criar, editar, reordenar, arquivar) em `src/features/routines`
- [x] 3.3 Tela `/treino`: cards de rotina com nº de exercícios e séries; botão "Nova rotina"
- [x] 3.4 Editor de rotina com reordenação, séries (stepper), descanso (padrão 120 s) e observações
- [x] 3.5 Seletor de exercício (busca + "criar novo") reutilizável, que também será usado na sessão (4.0)
- [x] 3.6 Arquivar ou excluir rotina com confirmação (Dialog do shadcn, não `window.confirm`)
- [x] 3.7 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Visão Geral dos Componentes**, feature `routines`; tabelas `routines`, `routine_exercises` e `exercises` em **Modelos de Dados**. Gravações com id gerado no cliente (`crypto.randomUUID()`) e `upsert`, seguindo o padrão de idempotência.

## Critérios de Sucesso

- As 4 rotinas do seed aparecem com 8, 6, 8 e 6 exercícios
- Uma alteração no editor aparece na lista sem recarregar a página
- A reordenação persiste após recarregar
- Não é possível criar dois exercícios com o mesmo nome (mensagem clara)
- Funciona em 375 px de largura sem rolagem horizontal

## Testes da Tarefa

- [x] Testes de unidade: função de reordenação (recalcula `position` sem buracos); validação Zod do formulário de rotina (séries ≥ 1, descanso entre 15 e 600 s)
- [x] Testes de integração: Playwright cria rotina, adiciona 2 exercícios, reordena, recarrega e confere a ordem; arquivar remove da lista ativa; editar observação técnica persiste

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/features/routines/*`
- `src/app/(app)/treino/page.tsx`, `src/app/(app)/treino/rotinas/[id]/page.tsx`
- `src/components/providers/query-provider.tsx`
- `tests/unit/routines.test.ts`, `tests/e2e/routines.spec.ts`

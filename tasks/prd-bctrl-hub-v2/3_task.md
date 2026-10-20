# Tarefa 3.0: Catálogo de exercícios e instruções próprias

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Transformar `/treino/exercicios` num catálogo navegável:
- busca e filtros por músculo e equipamento;
- detalhe com mídia exibida por link do Hevy (ou placeholder) e instruções de execução **escritas para o projeto**.

O seletor de exercício (rotina e sessão) passa a usar o catálogo com os mesmos filtros.

**Depende de:** 2.0.

<requirements>
- PRD RF02 (mídia por referência), RF02b (instruções próprias), RF08 (busca e filtros)
- Filtros por músculo principal e equipamento (rótulos em PT), combináveis, com busca sem acento
- Miniatura com `<img loading="lazy">`; vídeo `muted loop playsInline preload="none"`, que só toca no detalhe; `onError` → placeholder com o símbolo Bctrl e o grupo muscular
- Instruções próprias (posição inicial, execução, respiração, erros comuns; até ~80 palavras) para os ~456 exercícios, escritas em lotes e guardadas em `scripts/hevy/instructions/*.json`. Aplicar no banco pelo mesmo fluxo privado da importação. **Nunca** copiar ou parafrasear o texto do Hevy; prioridade para os exercícios usados nas rotinas e no histórico
- Instruções também visíveis, recolhidas, durante a sessão de treino
- Lista grande performática (virtualização ou paginação no cliente) em 375 px
</requirements>

## Subtarefas

- [x] 3.1 Função pura de filtro e busca (`src/lib/domain/catalog.ts`) com testes
- [x] 3.2 Tela `/treino/exercicios`: barra de busca, chips de músculo e equipamento, lista com miniatura
- [x] 3.3 Detalhe do exercício (sheet ou rota) com mídia, instruções, músculos secundários e link "ver no histórico/evolução"
- [x] 3.4 Componente `ExerciseMedia` com placeholder em caso de erro
- [x] 3.5 `exercise-picker` da v1 usando o catálogo e os filtros
- [x] 3.6 Escrever as instruções em lotes (primeiro os usados, depois o restante) e aplicá-las (local e remoto) — aplicado em produção pelo dono em 2026-10-19; verificado 455/455 com instruções
  - [x] 455/455 textos próprios em `scripts/hevy/instructions/*.json` (01 = rotinas e histórico; 02–09 por grupo), fora do Git
  - [x] `npm run instructions:hevy` gera `supabase/instructions.private.sql` (idempotente, só o dono, por `hevy_template_id`)
  - [x] Validado no Supabase local num usuário descartável: importação + instruções, 455/455, segunda aplicação sem mudança
  - [x] **Dono:** aplicar no remoto com `npx supabase db query --linked -f supabase/instructions.private.sql`
- [x] 3.7 Instruções recolhíveis na sessão de treino
- [x] 3.8 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Pontos de Integração → Mídia por link**, **Visão Geral → feature `exercises`** e **Decisões Principais** (instruções próprias).

## Critérios de Sucesso

- Filtrar "Peito" + "Halter" lista só exercícios que atendem aos dois critérios
- Sem rede para o CDN do Hevy, o catálogo mostra placeholders sem quebrar o layout
- 100% dos exercícios usados nas rotinas e no histórico têm instruções próprias; o restante coberto até o fim da task
- Rolagem fluida em 375 px com ~456 itens

## Testes da Tarefa

- [x] Testes de unidade: `catalog.ts` (busca sem acento, combinação de filtros, ordenação); `ExerciseMedia` cai no placeholder em `onError`
- [x] Testes de integração: E2E filtra e abre o detalhe; mídia bloqueada (`page.route` abortando o CDN) mostra placeholder; adicionar exercício do catálogo a uma rotina

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/lib/domain/catalog.ts`, `src/features/exercises/*`
- `src/features/routines/components/exercise-picker*`, `src/features/workout-session/*`
- `src/app/(app)/treino/exercicios/**`
- `scripts/hevy/instructions/*.json` (ignorado se contiver dados do catálogo)
- `tests/unit/catalog.test.ts`, `tests/e2e/catalog.spec.ts`

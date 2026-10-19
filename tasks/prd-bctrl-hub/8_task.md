# Tarefa 8.0: Painel Hoje e Hex Week

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

A tela inicial (`/`), que responde em ≤ 5 segundos "como está meu dia e minha semana". Junta o treino sugerido, as refeições do dia, os hábitos e as tarefas pendentes, e apresenta o **Hex Week**: o símbolo do logo Bctrl Hub como anel de progresso da semana.

**Depende de:** 4.0, 6.0 e 7.0. **Bloqueia:** 9.0 (layout Hex Week do story).

<requirements>
- RF39, RF40, RF41
- Uma chamada a `week_summary` para os números da semana
- Componente `HexProgress` em SVG: 3 segmentos (azul = treinos x/4, laranja = adesão alimentar %, neutro = hábitos) preenchidos proporcionalmente, com núcleo central; mesma geometria do `bctrl-hub-symbol.svg`
- `HexProgress` reutilizável em tamanhos diferentes (painel, story, favicon estático)
- Animação de preenchimento suave que respeita `prefers-reduced-motion`
- Cada segmento tem rótulo textual acessível (`aria-label` + legenda visível)
- Card "Treino de hoje": próxima rotina + botão Iniciar, ou "Continuar treino" se houver sessão ativa
- Blocos resumidos de refeições, hábitos e tarefas, com ações rápidas inline (marcar refeição, check de hábito, concluir tarefa)
- Celular: uma coluna; desktop (≥ 1024 px): grade com Hex Week em destaque
- Renderização inicial no servidor + hidratação do TanStack Query (meta de ≤ 2 s em 4G)
</requirements>

## Subtarefas

- [ ] 8.1 Função `segmentFill(progress)` que converte 0–1 no comprimento do traço de cada segmento (clamp em 0 e 1)
- [ ] 8.2 Componente `HexProgress` (SVG, tokens de cor, legenda, reduced motion)
- [ ] 8.3 Hook `useWeekSummary(weekStart)` sobre a RPC
- [ ] 8.4 Montar a página `/` com Server Component (prefetch) + blocos cliente
- [ ] 8.5 Ações rápidas reaproveitando as mutações de 6.0 e 7.0, invalidando `week_summary`
- [ ] 8.6 Layout responsivo e estados vazios (semana sem dados)
- [ ] 8.7 Medir o carregamento com Speed Insights / Lighthouse mobile
- [ ] 8.8 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: `HexProgress` e feature `today` em **Visão Geral dos Componentes**; RPC `week_summary` em **Endpoints de API**; fluxo de dados (prefetch no servidor + hidratação). Geometria do símbolo em `assets/brand/bctrl-hub-symbol.svg`.

## Critérios de Sucesso

- Marcar um hábito ou refeição no Hoje atualiza o Hex Week sem recarregar a página
- Com 2/4 treinos, o segmento azul fica preenchido pela metade (verificável no SVG)
- Lighthouse mobile da página `/`: Performance ≥ 85 e Acessibilidade ≥ 90
- Com movimento reduzido ativado, não há animação

## Testes da Tarefa

- [ ] Testes de unidade: `segmentFill` (0, 0,5, 1, >1, negativo); `HexProgress` renderiza 3 segmentos com `aria-label` corretos (Testing Library)
- [ ] Testes de integração: `week_summary` com semana semeada retorna os números exibidos; Playwright abre `/`, vê o treino sugerido correto, marca suplementos e vê o segmento de hábitos aumentar; botão Iniciar leva à sessão da rotina certa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/components/shell/HexProgress.tsx`, `src/lib/domain/hex.ts`
- `src/features/today/*`
- `src/app/(app)/page.tsx`
- `tests/unit/hex.test.ts`, `tests/unit/HexProgress.test.tsx`, `tests/e2e/today.spec.ts`
- `assets/brand/bctrl-hub-symbol.svg`

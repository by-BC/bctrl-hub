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

- [x] 8.1 Função `segmentFill(progress)` que converte 0–1 no comprimento do traço de cada segmento (clamp em 0 e 1)
- [x] 8.2 Componente `HexProgress` (SVG, tokens de cor, legenda, reduced motion)
- [x] 8.3 Hook `useWeekSummary(weekStart)` sobre a RPC
- [x] 8.4 Montar a página `/` com Server Component (prefetch) + blocos cliente
- [x] 8.5 Ações rápidas reaproveitando as mutações de 6.0 e 7.0, invalidando `week_summary`
- [x] 8.6 Layout responsivo e estados vazios (semana sem dados)
- [x] 8.7 Medir o carregamento com Speed Insights / Lighthouse mobile
- [x] 8.8 Escrever e rodar os testes da tarefa

## Notas da entrega

- **Leitura no cliente, sem prefetch no servidor (8.4):** como nas tasks 3–7, os blocos leem com TanStack Query no navegador e o dia vem de `useToday()`. Prefetch exigiria ler a sessão (cookies) na página e tiraria `/` do shell estático; o build mantém `/` como estática (○). Skeletons com a altura do conteúdo final (CLS 0,006).
- **Média dos hábitos (Hex):** média simples de cardio (min/150), abdominal (x/3) e suplementos (dias/7), cada um limitado a 1; meta do hábito vinda do `week_summary` ou a padrão; hábito do sistema arquivado sai da média (`src/lib/domain/hex.ts`).
- **8.7 Lighthouse mobile** (`next build` + `next start`, Lighthouse 12.8 com sessão logada no Chromium via CDP, usuário do seed local): Performance 99–100, Acessibilidade 100, Best Practices 82 (só "HTTPS": localhost e um script injetado pelo antivírus), LCP 1,7–1,8 s, TBT 0 ms, CLS 0,006 (3 execuções).

## Detalhes de Implementação

Ver techspec: `HexProgress` e feature `today` em **Visão Geral dos Componentes**; RPC `week_summary` em **Endpoints de API**; fluxo de dados (prefetch no servidor + hidratação). Geometria do símbolo em `assets/brand/bctrl-hub-symbol.svg`.

## Critérios de Sucesso

- Marcar um hábito ou refeição no Hoje atualiza o Hex Week sem recarregar a página
- Com 2/4 treinos, o segmento azul fica preenchido pela metade (verificável no SVG)
- Lighthouse mobile da página `/`: Performance ≥ 85 e Acessibilidade ≥ 90
- Com movimento reduzido ativado, não há animação

## Testes da Tarefa

- [x] Testes de unidade: `segmentFill` (0, 0,5, 1, >1, negativo); `HexProgress` renderiza 3 segmentos com `aria-label` corretos (Testing Library)
- [x] Testes de integração: `week_summary` com semana semeada retorna os números exibidos; Playwright abre `/`, vê o treino sugerido correto, marca suplementos e vê o segmento de hábitos aumentar; botão Iniciar leva à sessão da rotina certa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/components/shell/HexProgress.tsx`, `src/lib/domain/hex.ts`
- `src/features/today/*`
- `src/app/(app)/page.tsx`
- `tests/unit/hex.test.ts`, `tests/unit/HexProgress.test.tsx`, `tests/e2e/today.spec.ts`
- `assets/brand/bctrl-hub-symbol.svg`

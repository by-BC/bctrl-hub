# Tarefa 7.0: Tela de Perfil

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

A tela `/perfil`:
- **heatmap estilo GitHub** dos últimos 12 meses (nível = pontuação "dia no controle");
- **resumo do mês** com navegação e comparação com o mês anterior;
- **recordes do mês**;
- **conquistas**;
- atalho para os dados e metas (5.0).

Acesso pelo avatar no cabeçalho do celular e pela lateral do desktop.

**Depende de:** 6.0.

<requirements>
- PRD RF09, RF10, RF12–RF15; techspec **Decisões Principais** (`react-activity-calendar`)
- `react-activity-calendar` 3.x com tema derivado dos tokens Bctrl (escala de 5 níveis do ultramarino, legível nos dois temas), semana começando na segunda, rótulos em PT; `renderBlock` com `data-level` e tooltip acessível (data, score, critérios cumpridos)
- No celular, o heatmap rola na horizontal dentro do próprio bloco, rolado até hoje por padrão, sem rolar a página
- Alternativa textual: tabela acessível por mês e resumo ("18 de 31 dias no controle")
- Resumo do mês: cards com o número e a variação contra o mês anterior (seta + texto); navegação mês anterior/próximo (sem passar do atual)
- Conquistas: desbloqueadas com data; bloqueadas com regra e barra de progresso; ícone e texto distinguem os estados
- Shell: avatar ou símbolo no `MobileHeader` e item "Perfil" no `SideNav`, sem tirar itens da barra inferior
- Seguir a skill `dataviz` para heatmap e números; rota dinâmica com `<Suspense>` se houver params
</requirements>

## Subtarefas

- [x] 7.1 Instalar `react-activity-calendar` e criar `ControlHeatmap` (tema, `renderBlock`, tooltip, tabela alternativa)
- [x] 7.2 `MonthSummary` com navegação e comparação
- [x] 7.3 `MonthRecords` e `Achievements`
- [x] 7.4 Página `/perfil` (layout celular e desktop) e links no shell
- [x] 7.5 Estados vazios (sem dados no mês, nenhuma conquista)
- [x] 7.6 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Visão Geral → feature `profile`**, **Decisões Principais** e **Conformidade com Padrões** (tokens, acessibilidade).

## Critérios de Sucesso

- O perfil abre em ≤ 2 s em 4G com 12 meses de dados (Playwright com throttling simples ou métrica de tempo até o heatmap)
- Os níveis do heatmap batem com `daily_scores` (verificável por `data-level`)
- Sem rolagem horizontal da página em 375 px
- Axe sem violações serious/critical nos dois temas

## Testes da Tarefa

- [x] Testes de unidade: mapeamento score → nível e cor; texto da variação mensal (positivo, negativo, sem base); `Achievements` renderiza bloqueada e desbloqueada com rótulos distintos
- [x] Testes de integração: E2E com dias semeados confere `data-level`, troca de mês e conquista visível; axe em `/perfil`

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/features/profile/components/{control-heatmap,month-summary,month-records,achievements}.tsx`
- `src/app/(app)/perfil/page.tsx`
- `src/components/shell/{mobile-header,side-nav,nav-items}.tsx`
- `tests/unit/profile.test.tsx`, `tests/e2e/profile.spec.ts`

## Notas de execução

- **Heatmap:** `react-activity-calendar` 3.2.1, janela do 1º dia de 11 meses atrás até hoje (o futuro nem é desenhado). A cor vem dos tokens `--heat-0` a `--heat-4` (`tokens.css`, um conjunto por tema), aplicada no `renderBlock` por `style.fill`, sem depender do esquema de cor da biblioteca. Escala sequencial do ultramarino em luminosidade OKLCH monotônica: claro `#e9e4d8` (0, neutro) · `#aec4f6` · `#698deb` · `#2448db` · `#142d8c`; escuro `#32353c` (0) · `#334a83` · `#4668c5` · `#5f8afb` · `#a6c3ff` (a âncora inverte: mais ponto = mais claro sobre o grafite).
- **Tooltip próprio** (não o da biblioteca, que só abre no hover): abre por mouse, toque e foco, com `role="tooltip"` ligado por `aria-describedby`; cada quadrado tem `role="button"` e `aria-label` com data, "N de 4 pontos" e os critérios. Teclado: um só ponto de Tab (roving tabindex), ← → semana, ↑ ↓ dia, Home/End, Esc fecha.
- **Celular:** o bloco rola sozinho (a página não) e começa em hoje (rolagem feita dois quadros depois de montar, porque a biblioteca mede os rótulos dos dias só no cliente).
- **Meses sem registro de refeição** (época do Hevy): adesão, kcal e proteína mostram "Sem registros" e a variação "sem comparação"; mês anterior sem registros dá "sem base em <mês>". Critério: `nutrition.logged_days = 0` (as refeições previstas existem em todo dia, porque o plano vale para trás).
- **Perfil no shell:** item "Perfil" (`mobile: false`) na lateral e link com avatar no `MobileHeader`; a barra inferior continua com 5 itens.
- **E2E:** `profile.spec.ts` usa timeout de 90 s por teste (seed de ~20 inserts + login numa máquina fria passava dos 30 s e o `afterEach` apagava o usuário no meio do seed). Tempo até o heatmap (dev server, Playwright): 327–476 ms em carga completa e 233–314 ms navegando pelo app com a máquina aquecida; 945–1.006 ms e 525–566 ms logo após reiniciar.

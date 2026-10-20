# Tarefa 8.0: Card do mês e acabamento da v2

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Fechar a v2:
- **card do mês compartilhável** (1080×1920) no Story Studio, com heatmap do mês, números principais e conquistas;
- auditoria de acessibilidade das telas novas;
- suíte E2E completa da v1 + v2;
- documentação;
- publicação, com checagem dos advisors do Supabase.

**Depende de:** 7.0.

<requirements>
- PRD RF17; techspec **Visão Geral → feature `story`** (layout `MonthCard`, rota `/perfil/mes/[yyyy-mm]/story` dentro de `<Suspense>`)
- Reaproveitar `StoryFrame`, `exportStory` e `shareOrDownload` (validados no iPhone): `document.fonts.ready`, captura de aquecimento, `pixelRatio: 1`, áreas seguras de 250 px; cores pelas classes `.story-*`
- `MonthCard`: mês/ano, mini-heatmap do mês (hexágonos ou células da marca), dias no controle, treinos, volume, PRs, adesão e conquistas do mês; estilo coerente com os 4 layouts existentes
- Atalho "Compartilhar mês" no `MonthSummary`
- Axe (`tests/e2e/a11y.spec.ts`) cobrindo as rotas novas (`/perfil`, `/perfil/dados`, `/treino/exercicios` e detalhe) nos dois temas
- Atualizar `README.md` e `CLAUDE.md` (importação do Hevy, TACO, metas, perfil, arquivos privados)
- `get_advisors` sem alertas novos; o dono faz smoke test no celular após o push
</requirements>

## Subtarefas

- [x] 8.1 Layout `MonthCard` e rota do story do mês
- [x] 8.2 Atalho no Perfil
- [x] 8.3 Axe nas rotas novas e correção de violações
- [ ] 8.4 Suíte E2E completa estável (1 worker; sem Lighthouse; servidores encerrados)
  - Mobile completo: 113 passaram, 1 pulado (só desktop). Desktop: só os specs afetados (`story`, `a11y`, `profile`, `month-card`); o **desktop completo não rodou** (3,2–3,7 GB livres, abaixo dos 4 GB). Pendente desde a v1.
- [x] 8.5 Documentação (`README.md`, `CLAUDE.md`)
- [x] 8.6 Advisors do Supabase
- [ ] 8.7 Smoke test do dono em produção (celular): perfil, nutrição, catálogo, card do mês no Instagram
  - **Pendente (dono)**: depois do push, abrir no iPhone `/perfil` → "Compartilhar mês" → Compartilhar → Instagram › Story e conferir fontes, cores do calendário e áreas seguras; conferir também nutrição e catálogo.

## Detalhes de Implementação

Ver techspec: **Sequenciamento → passo 8**, **Monitoramento** e a seção Story Studio do `CLAUDE.md`.

## Critérios de Sucesso

- O card do mês exporta um PNG de exatamente 1080×1920 e compartilha pelo menu nativo
- 0 violações serious/critical do axe em todas as rotas
- `npm run test:all` passa
- Smoke test do dono aprovado

## Testes da Tarefa

- [x] Testes de unidade: dados do card do mês (função pura a partir do `month_summary` + `daily_scores`)
- [ ] Testes de integração: E2E exporta o card do mês e valida as dimensões; axe nas rotas novas; suíte E2E completa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/features/story/layouts/MonthCard.tsx`, `src/features/story/*`
- `src/app/(app)/perfil/mes/[month]/story/page.tsx`
- `tests/e2e/a11y.spec.ts`, `tests/e2e/month-card.spec.ts`
- `README.md`, `CLAUDE.md`

## Notas de execução

- **Card do mês:** tom grafite (`.story-ink`), mês em Sora itálico, calendário de hexágonos da marca (segunda a domingo) com o número do dia dentro (texto grafite nos níveis 3 e 4, off-white nos outros), hoje com fio laranja e dias futuros só com contorno. Escala `--heat-ink-0…4` (a do tema escuro, agora fixa em `:root`). Mês de 6 semanas usa hexágonos menores; até 3 conquistas na lista (o total vai no título) e o mote "Be in control." sai quando a lista enche. Pior caso conferido (6 semanas, "fevereiro", 154.320 kg, 4 conquistas): o texto termina em y = 1606.
- **E2E:** `month-card.spec.ts` confere que todo texto do quadro fica entre y = 250 e 1670 e que o PNG sai com 1080×1920.
- **Lentidão dos seeds:** `readLocalSupabaseEnv()` rodava `npx supabase status` (~4,5 s) a cada cliente admin; agora lê uma vez por processo. Um usuário + 3 inserts caiu de ~23 s para ~5 s.
- **Advisors (2026-10-20):** segurança, só o já conhecido `auth_leaked_password_protection` (configuração do Auth, cadastro desligado, usuário único). Performance, 5 `unused_index` (INFO) em índices de FK (`routine_exercises_exercise_idx`, `meal_logs_meal_idx`, `habit_logs_habit_idx`, `meal_log_items_meal_log_idx`, `meal_log_items_food_id_idx`), mantidos para os deletes em cascata e as checagens de FK. Nada novo acionável; sem migration.

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

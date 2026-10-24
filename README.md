# Bctrl Hub

> **Be in control.** Central pessoal de treino, alimentação, hábitos e tarefas.

App de uso pessoal: Next.js 16 + Supabase, hospedado na Vercel.

## Rodando localmente

Pré-requisitos: Node 24, Docker Desktop aberto.

```bash
npm install
npm run db:start                 # Supabase local
cp .env.example .env.local       # preencha com `npx supabase status -o env` (API_URL e PUBLISHABLE_KEY)
npm run dev                      # http://localhost:3000
```

O cadastro público é desativado. O usuário de teste (`e2e@bctrl.test`) é criado automaticamente pelos testes E2E (`tests/e2e/global-setup.ts`) e serve para entrar no app local.

## Testes

```bash
npm test                  # unidade
npm run test:integration  # integração (Supabase local)
npx playwright install chromium
npm run test:e2e          # ponta a ponta (celular + desktop)
npm run test:all          # typecheck + lint + unidade + integração + E2E
```

O `test:all` precisa do Supabase local no ar. O E2E roda com 1 worker e inclui:

- **acessibilidade**: axe (WCAG 2.1 A/AA) em todas as rotas, tema claro e escuro, celular e desktop (`tests/e2e/a11y.spec.ts`);
- **stories**: dois modelos exclusivos de treino, quatro layouts gerais no Perfil, o resumo diário e o card do mês exportam PNG de exatamente 1080×1920 (`story.spec.ts`, `daily-story.spec.ts`, `month-card.spec.ts`).

Os testes que gravam dados usam usuários descartáveis (`tests/e2e/disposable-user.ts`), apagados ao fim.

Veja [docs/architecture.md](docs/architecture.md) para a organização dos módulos e as regras de dependência.

## O que o app faz

- **Treino**: rotinas, sessão com timer e fila própria, histórico, evolução por exercício, catálogo de exercícios (`/treino/exercicios`) com mídia por link e instruções próprias, tipos de série (carga, peso corporal, duração, distância).
- **Comida**: plano alimentar com macros pela **TACO** (597 alimentos, NEPA/Unicamp), seleção dos alimentos realmente consumidos em cada refeição, refeição "fora do plano" e **consumido × meta**.
- **Perfil** (`/perfil`): heatmap de "dias no controle" (pontuação 0–4 por dia), resumo do mês, recordes e conquistas. Dados corporais e metas em `/perfil/dados`: Mifflin-St Jeor × fator de atividade, ajuste pelo objetivo, proteína em g/kg; cada meta aceita ajuste manual e pode ser diferente em dia de treino.
- **Composição corporal** (`/evolucao/composicao`): histórico e registro das 17 métricas da balança, gráficos, metas com projeção, TMB medida e proteína por massa magra. O peso da medição alimenta a Evolução sem duplicar o dia; Perfil e card do mês mostram as variações de peso, gordura e músculo.
- **Stories por módulo**: Treino tem dois modelos exclusivos para a sessão concluída (`/treino/historico/[id]/story`). No Perfil, a central `/perfil/stories` reúne o story diário e os quatro layouts gerais para qualquer treino salvo (`/perfil/stories/[id]`); o card do mês fica no resumo mensal (`/perfil/mes/AAAA-MM/story`). Imagens geradas no aparelho e compartilhadas pelo menu nativo ou baixadas em PNG.

## Dados privados (fora do Git)

O repositório é público. Nada pessoal é versionado:

| Arquivo | O quê |
|---|---|
| `.env.local` | Supabase local; `HEVY_API_KEY` para a importação |
| `supabase/seed.private.sql` | seed real (rotinas, refeições, hábitos) |
| `supabase/*.private.sql` | saídas dos scripts abaixo, aplicadas no remoto à mão |
| `scripts/hevy/data/`, `scripts/hevy/out/`, `scripts/hevy/instructions/` | catálogo PT do Hevy, relatório da importação, instruções próprias |
| `scripts/meals/data/`, `scripts/meals/out/` | ajustes do vínculo com a TACO e o relatório |
| `scripts/scale/data/`, `scripts/scale/out/` | planilha da balança e relatório da importação de composição corporal |

Scripts (todos com dry-run e relatório antes de gerar SQL):

```bash
npm run import:hevy                  # relatório em scripts/hevy/out/report.md
npm run import:hevy -- --write       # gera supabase/import.private.sql
npm run instructions:hevy            # gera supabase/instructions.private.sql
npm run meals:link [-- --write]      # vincula o plano à TACO → supabase/meal-items.private.sql
npm run import:scale -- planilha.xlsx # dry-run → scripts/scale/out/report.md
npm run import:scale -- planilha.xlsx --write # gera supabase/scale.private.sql
npm run taco:convert                 # regenera a migration pública da TACO
```

Aplicar no remoto só depois de revisar o relatório: `npx supabase db query --linked -f supabase/<arquivo>.private.sql`.

## Documentação

- `tasks/prd-bctrl-hub/` (v1), `tasks/prd-bctrl-hub-v2/` (v2) e `tasks/prd-bctrl-hub-v3-composicao/` (v3): `prd.md` (requisitos), `techspec.md` (arquitetura), `tasks.md` (plano)
- `CLAUDE.md`: padrões do código

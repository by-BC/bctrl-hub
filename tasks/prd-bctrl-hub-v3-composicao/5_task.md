# Tarefa 5.0: Perfil, card do mês e acabamento da v3

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Fechar a v3:
- o `month_summary` ganha o bloco `composition`, com a variação de peso, gordura e músculo no mês e no anterior;
- o resumo do Perfil e o card do mês (story) mostram essas variações, ou "sem medições";
- duas conquistas novas;
- axe nas telas novas;
- documentação;
- deploy.

**Depende de:** 4.0.

<requirements>
- PRD RF21–RF23; techspec **Endpoints de API** (`month_summary` com `composition`) e **Visão Geral** (`month-summary`, `MonthCard`, `achievements`)
- Migration nova com `create or replace` do `month_summary` (contrato compatível; campo novo opcional); `db:types`; `db push`; `get_advisors`
- `MonthSummary`: cartões de variação de peso, % gordura e músculo kg contra o mês anterior (seta + texto); "sem medições" quando não houver
- `MonthCard`: linha de composição quando houver medição no mês, respeitando as áreas seguras de 250 px; PNG continua exatamente 1080×1920
- `achievements.ts`: "−1 ponto de gordura" (queda de 1 ponto percentual desde a primeira medição) e "Meta de composição atingida" (qualquer `achieved_on`)
- Atalho "Nova medição" no Perfil
- Axe cobrindo as rotas novas da v3 nos dois temas
- `README.md` e `CLAUDE.md`: composição, importação da balança (`import:scale`), trigger do peso do dia, arquivos privados
- O dono faz o smoke test no celular após o push
</requirements>

## Subtarefas

- [x] 5.1 (RED) Teste de integração do `month_summary.composition` (mês com medições, sem medições, comparação com o anterior, virada de mês)
- [x] 5.2 (GREEN) Migration do `month_summary` + `db push`
- [x] 5.3 `MonthSummary` com a composição e o atalho "Nova medição"
- [x] 5.4 `MonthCard` com a linha de composição (pior caso dentro das áreas seguras)
- [x] 5.5 Conquistas novas em `achievements.ts`
- [x] 5.6 Axe, documentação e `get_advisors`
- [x] 5.7 Smoke test do dono no celular (Composição, nova medição, metas, Perfil e card do mês)

## Detalhes de Implementação

Ver techspec: **Endpoints de API**, **Modelos de Dados → bloco `composition`** e a seção Story Studio do `CLAUDE.md`.

## Critérios de Sucesso

- O resumo do mês com medições mostra as variações certas (conferidas à mão em 1 mês); sem medições, mostra "sem medições"
- O card do mês com composição exporta exatamente 1080×1920, com todo o texto entre y = 250 e y = 1670
- As conquistas novas desbloqueiam na data certa
- 0 violações serious/critical do axe nas rotas da v3

## Testes da Tarefa

- [x] Testes de unidade: dados do card com e sem composição; as conquistas novas (bloqueada, progresso, desbloqueada)
- [x] Testes de integração: `month_summary.composition` com dados conhecidos; E2E do resumo e do card do mês (dimensões e áreas seguras); axe nas rotas novas

## Execução (2026-10-22)

- RED confirmado nos testes de `achievements` e `month-card`; GREEN com 522 testes de unidade e 254 de integração.
- Migration `20261022230000_v3_rpcs.sql` aplicada no Supabase local e remoto; `db:types` regenerado sem alteração de contrato gerado.
- E2E do card: 4 cenários verdes (mobile e desktop), PNG 1080×1920 e nenhum texto fora de y = 250–1670.
- Axe: temas claro e escuro, mobile e desktop, 0 violações serious/critical; teste de teclado desktop verde.
- `typecheck`, `lint`, `git diff --check` e build de produção verdes.
- Advisors remoto: 0 erros; permanece 1 aviso de configuração do Auth (`auth_leaked_password_protection`), sem relação com a migration.
- Smoke test do dono no celular concluído e confirmado em 2026-10-24: Composição, nova medição, metas, Perfil e card do mês.
- Task 5.0 concluída; a V3 está fechada.

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `supabase/migrations/…_v3_rpcs.sql`
- `src/features/profile/components/month-summary.tsx`, `src/features/story/layouts/MonthCard.tsx`
- `src/lib/domain/{achievements,month-card}.ts`
- `tests/integration/scores.test.ts`, `tests/e2e/month-card.spec.ts`, `tests/e2e/a11y.spec.ts`
- `README.md`, `CLAUDE.md`

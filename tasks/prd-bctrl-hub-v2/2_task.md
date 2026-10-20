# Tarefa 2.0: Importação do Hevy

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Script local e único (`scripts/hevy/`) que traz para o Bctrl Hub:
- o **catálogo do Hevy** (~456 exercícios: tipo, músculos, equipamento, miniatura, nome em PT e vídeo por link);
- os **exercícios personalizados**;
- os **82 treinos** do dono.

O script vincula os 26 exercícios atuais aos equivalentes do catálogo, gera um relatório para revisão e, só depois da aprovação do dono, aplica um SQL privado e idempotente no Supabase remoto.

**Processo obrigatório: TDD** para `scripts/hevy/map.ts`, com fixtures no formato real da API (anonimizados).

**Depende de:** 1.0. **Bloqueia:** 3.0 e 6.0.

<requirements>
- PRD RF01–RF07; techspec **Pontos de Integração** (API do Hevy, catálogo do site, mídia por link)
- Chave `HEVY_API_KEY` lida de `.env.local` (já existe; nunca imprimir nem gravar em arquivo versionado). Falhar cedo se faltar
- Paginar `GET /v1/exercise_templates` e `GET /v1/workouts` até o fim, com backoff em 429/5xx (até 5 tentativas)
- Mapa `id → { pt_br_title, media_url }` extraído uma vez do catálogo carregado em hevy.com (Chrome do dono, só leitura), salvo em `scripts/hevy/data/catalog-pt.json`
- **Não** copiar mídia nem `localised_instructions` do Hevy; só URLs
- Vínculo por `exercise_template_id`; ligar os 26 exercícios existentes por nome exato, depois normalizado (sem acento e caixa), depois `overrides.json`; o que sobrar fica pendente no relatório
- Conversões: datas ISO → `day` em America/Sao_Paulo; `distance_meters` → `distance_m`; `type` da série → `set_type`; personalizados → `source = 'hevy_custom'`
- `--dry-run` (padrão) gera `scripts/hevy/out/report.md`; `--write` gera `supabase/import.private.sql` (upsert por `hevy_template_id` / `hevy_workout_id`)
- `.gitignore`: `supabase/*.private.sql`, `scripts/hevy/data/`, `scripts/hevy/out/`
- Aplicar no remoto com `npx supabase db query --linked -f supabase/import.private.sql` **somente após o dono aprovar o relatório**
</requirements>

## Subtarefas

- [x] 2.1 `.gitignore` e estrutura de `scripts/hevy/` (executado com `tsx`; script `npm run import:hevy`)
- [x] 2.2 Extrair `catalog-pt.json` pelo Chrome (Claude in Chrome, sessão do dono, só leitura) e validar a estrutura
- [x] 2.3 (RED) Testes de `map.ts`: template → exercício (com e sem PT), workout → linhas (aquecimento, distância, duração, personalizado), `linkExisting` (exato, normalizado, override, pendente), SQL determinístico
- [x] 2.4 (GREEN) `api.ts` (paginação e backoff) e `map.ts`
- [x] 2.5 `run.ts` com `--dry-run`/`--write` e geração do relatório (contagens, vínculos, pendentes, ignorados com motivo)
- [x] 2.6 Teste de integração: aplicar no Supabase local o SQL gerado dos fixtures, duas vezes, sem duplicar
- [x] 2.7 Rodar o dry-run real e **parar para o dono revisar o `report.md`**; ajustar `overrides.json`
- [x] 2.8 Após aprovação: `--write`, aplicar no remoto, consulta de verificação (82 treinos; contagem de séries igual à da API) — aplicado pelo dono em 2026-10-19 (`supabase db query --linked`); verificado: 82 treinos `source=hevy`, 1.489 séries (11 aquecimentos), 455 exercícios com `hevy_template_id` (4 personalizados), 28/28 itens de rotina vinculados
- [ ] 2.9 Lembrar o dono de gerar uma nova chave da API no Hevy — **pendente (dono)**: gerar nova chave no Hevy e trocar `HEVY_API_KEY` no `.env.local`

## Detalhes de Implementação

Ver techspec: **Visão Geral dos Componentes → Importação**, **Interfaces Principais** (`scripts/hevy/map.ts`), **Pontos de Integração** e **Monitoramento** (relatório e verificação).

## Critérios de Sucesso

- ~456 exercícios do catálogo + os personalizados existem para o dono, sem duplicar os 26 atuais (os ids antigos são reaproveitados, e rotinas e treinos da v1 continuam ligados)
- 82 treinos importados aparecem no histórico e na evolução com datas corretas
- Rodar o `--write` + aplicação de novo não altera as contagens
- `git status` nunca mostra `catalog-pt.json`, `report.md` nem `*.private.sql`; a chave não aparece em nenhum arquivo versionado

## Testes da Tarefa

- [x] Testes de unidade: `map.ts` e `api.ts` (paginação e backoff com `fetch` simulado)
- [x] Testes de integração: SQL gerado dos fixtures aplicado 2x no Supabase local (idempotente, vínculos reaproveitam ids, aquecimento sem PR)

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `scripts/hevy/{api,map,run,catalog-pt}.ts`, `scripts/hevy/data/` (ignorado), `scripts/hevy/out/` (ignorado)
- `tests/fixtures/hevy/*.json` (anonimizados), `tests/unit/hevy-map.test.ts`, `tests/integration/hevy-import.test.ts`
- `supabase/import.private.sql` (ignorado), `.gitignore`, `package.json`

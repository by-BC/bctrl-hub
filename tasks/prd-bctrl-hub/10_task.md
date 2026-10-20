# Tarefa 10.0: Offline geral, acessibilidade e E2E final

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Fechar a v1: garantir que nenhuma gravação se perca com sinal fraco em qualquer tela (não só no treino), revisar acessibilidade de ponta a ponta, completar a suíte E2E da techspec e publicar a versão final na Vercel.

**Depende de:** todas as anteriores (1.0 a 9.0).

<requirements>
- Restrição de conectividade do PRD (reenvio quando a conexão voltar)
- `PersistQueryClientProvider` + `query-sync-storage-persister` sobre `localStorage`
- `networkMode: 'offlineFirst'` e `setMutationDefaults` para todas as chaves de mutação (refeições, hábitos, tarefas, peso, rotinas)
- `resumePausedMutations()` no `onSuccess` do provider e no evento `online`
- Indicador global de pendências (toast persistente com contagem) e de "offline"
- Acessibilidade WCAG AA: contraste nos 2 temas (atenção ao laranja sobre off-white), estados não dependentes só de cor, navegação por teclado no desktop, rótulos em todos os controles, `prefers-reduced-motion`
- Suíte E2E completa (cenários 1 a 6 da techspec) passando em iPhone 14 e desktop 1440
- Advisors do Supabase sem alertas críticos; deploy de produção validado
</requirements>

## Subtarefas

- [x] 10.1 Configurar a persistência do QueryClient e registrar `setMutationDefaults` para cada mutação existente
- [x] 10.2 Componente `SyncStatus` (offline, sincronizando, N pendentes) no shell
- [x] ~~10.3 Teste manual guiado: modo avião no celular, marcar refeição, hábito e tarefa, fechar o app, reabrir online e conferir
  - **Cancelada (dono, 2026-10-20):** offline deixou de ser requisito; o app funciona com rede. Os E2E de offline foram removidos.
- [x] 10.4 Auditoria de acessibilidade com `@axe-core/playwright` em todas as rotas, nos dois temas; corrigir as violações
- [x] 10.5 Revisar o contraste dos tokens e ajustar variações (ex: laranja mais escuro para texto em fundo claro)
- [x] 10.6 Completar e estabilizar a suíte E2E (cenários 1 a 6) e criar o script `npm run test:all`
- [x] 10.7 Rodar `get_advisors` (segurança e performance) e resolver os alertas
- [ ] 10.8 Deploy final em produção via Vercel, smoke test no celular e atualização do `CLAUDE.md` e do README
  - `CLAUDE.md` e README atualizados. Pendente (dono): push (publica na Vercel) e smoke test no celular.

## Detalhes de Implementação

Ver techspec: **Pontos de Integração** (fila offline), **Testes de E2E** (cenários 1 a 6), **Monitoramento e Observabilidade** e **Riscos Conhecidos** (iOS e `localStorage`, pausa do Supabase free).

## Critérios de Sucesso

- Mutações feitas offline são aplicadas ao voltar a rede, inclusive após fechar e reabrir o app
- 0 violações *serious*/*critical* do axe em todas as rotas
- Suíte completa (unidade + integração + E2E) passando localmente
- Deploy de produção funcional e testado num celular real
- `npm run test:all` documentado no README

## Testes da Tarefa

- [x] Testes de unidade: `SyncStatus` mostra o estado certo para online, offline e N pendentes; registro de `setMutationDefaults` cobre todas as chaves exportadas
- [x] Testes de integração: Playwright com `setOffline(true)`, marca refeição, hábito e tarefa, recarrega a página ainda offline, volta online e confere no banco; axe em todas as rotas; suíte E2E completa

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/components/providers/query-provider.tsx`, `src/lib/query/mutation-defaults.ts`
- `src/components/shell/SyncStatus.tsx`
- `src/styles/tokens.css`
- `tests/e2e/offline.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/*.spec.ts`
- `README.md`, `CLAUDE.md`, `package.json` (script `test:all`)

## Encerramento (2026-10-19)

Task encerrada por decisão do dono. Verificado: typecheck, lint, build, 192 testes de unidade, 151 de integração e E2E completo no projeto mobile (45 passaram, 1 pulado). **Ressalva aceita pelo dono:** o E2E do projeto desktop não foi reexecutado depois dos últimos ajustes (rótulo do botão de opção, tempos do `offline.spec`, contrastes); a rodada anterior foi interrompida por suspensão do PC e a seguinte por falta de memória. Rodar `npx playwright test --project=desktop` na próxima oportunidade. Pendentes do dono: 10.3 (modo avião no celular) e smoke test no celular.

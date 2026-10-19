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

O `test:all` precisa do Supabase local no ar. O E2E roda com 1 worker (~7 min) e inclui:

- **acessibilidade**: axe (WCAG 2.1 A/AA) em todas as rotas, tema claro e escuro, celular e desktop (`tests/e2e/a11y.spec.ts`);
- **fila offline**: refeição, hábito e tarefa marcados sem rede chegam ao banco quando o app é reaberto online (`tests/e2e/offline.spec.ts`).

## Sem sinal

Gravações feitas sem rede ficam numa fila no aparelho (`localStorage`) e são reenviadas quando a conexão volta, mesmo depois de fechar o app. O topo da tela mostra "Offline · N pendentes" enquanto houver algo esperando. O treino em andamento fica salvo no aparelho e só vai ao banco ao finalizar. Limite conhecido: o Safari apaga os dados do site após ~7 dias sem uso.

## Documentação

- `tasks/prd-bctrl-hub/prd.md`: requisitos
- `tasks/prd-bctrl-hub/techspec.md`: arquitetura
- `tasks/prd-bctrl-hub/tasks.md`: plano de implementação
- `CLAUDE.md`: padrões do código

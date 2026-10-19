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
npm run test:all          # tudo
```

## Documentação

- `tasks/prd-bctrl-hub/prd.md`: requisitos
- `tasks/prd-bctrl-hub/techspec.md`: arquitetura
- `tasks/prd-bctrl-hub/tasks.md`: plano de implementação
- `CLAUDE.md`: padrões do código

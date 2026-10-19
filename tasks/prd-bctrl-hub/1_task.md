# Tarefa 1.0: Fundação: app, login, navegação e deploy

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Criar o esqueleto do Bctrl Hub: projeto Next.js 16 com identidade visual Bctrl, login de usuário único via Supabase, rotas protegidas, navegação (barra inferior no celular, lateral no desktop) e primeiro deploy na Vercel. Ao final, o dono acessa `*.vercel.app`, faz login e navega entre telas vazias com a marca aplicada.

**Depende de:** nenhuma. **Bloqueia:** todas as demais.

<requirements>
- RF01, RF02, RF03 (acesso com login único, sessão longa)
- Next.js 16 App Router + React 19 + TypeScript `strict`
- Tailwind 4 com tokens Bctrl em `@theme` (nada de hex solto em componentes)
- Fontes Sora (interface) e IBM Plex Mono (números) via `next/font`
- Tema escuro padrão + tema claro
- `@supabase/ssr` com `getClaims()` no `updateSession` chamado pelo `src/proxy.ts`
- Cadastro público desativado no Supabase (`enable_signup = false`)
- Variáveis apenas em `.env.local` (ignorado pelo Git) e no painel da Vercel; criar `.env.example` sem valores
</requirements>

## Subtarefas

- [ ] 1.1 Criar o app com `create-next-app` (TypeScript, App Router, Tailwind, ESLint, `src/`, alias `@/*`) na raiz do repositório
- [ ] 1.2 Criar `src/styles/tokens.css` com as cores Bctrl e configurar fontes no `src/app/layout.tsx`; tema escuro padrão com alternância para claro
- [ ] 1.3 Inicializar shadcn/ui e adicionar as primitivas: Button, Input, Sheet, Dialog, Tabs, Checkbox, Sonner
- [ ] 1.4 Copiar `assets/brand/*.svg` para `public/brand/`; gerar favicon e ícones a partir de `bctrl-hub-symbol-dark.svg`
- [ ] 1.5 Criar o projeto Supabase via MCP (região `sa-east-1`), desativar signup e pedir ao dono para criar seu usuário no painel
- [ ] 1.6 Criar `src/lib/supabase/{client,server,proxy}.ts` e `src/proxy.ts` conforme a techspec (padrão oficial com `getClaims()`)
- [ ] 1.7 Tela `/login` (e-mail + senha) com mensagem de erro clara; botão "Sair"
- [ ] 1.8 Shell: `BottomNav` (Hoje, Treino, Comida, Hábitos, Tarefas) no celular e `SideNav` a partir de 1024 px; páginas vazias para cada rota da techspec
- [ ] 1.9 Configurar Vitest (unidade), Playwright (E2E, viewports iPhone 14 e desktop 1440) e Supabase CLI local (`supabase init`)
- [ ] 1.10 Prova de conceito: página `/dev/story-poc` que exporta um PNG 1080×1920 com `html-to-image` usando as fontes da marca; testar no iPhone real e registrar o resultado no `CLAUDE.md`
- [ ] 1.11 Criar o `CLAUDE.md` com os padrões da seção "Conformidade com Padrões" da techspec
- [ ] 1.12 Criar o projeto na Vercel via MCP ligado a `by-BC/bctrl-hub`, configurar as variáveis e validar o deploy de produção
- [ ] 1.13 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Visão Geral dos Componentes** (Infra/config e Shell de UI), **Pontos de Integração** (Supabase Auth e Vercel) e **Dependências Técnicas**. O padrão do `updateSession` com `getClaims()` está documentado na techspec. Não colocar nenhum código entre `createServerClient` e `getClaims()`.

## Critérios de Sucesso

- Acessar qualquer rota sem sessão redireciona para `/login`
- Login válido leva ao Hoje; login inválido mostra erro sem recarregar a página
- Tentativa de cadastro pela API do Supabase é recusada
- A sessão continua ativa após fechar e reabrir o navegador
- O deploy em `*.vercel.app` funciona com login
- Lighthouse mobile da página de login: Acessibilidade ≥ 90
- Nenhuma chave no repositório (`git grep` por `sb_secret`/`eyJ` vazio)

## Testes da Tarefa

- [ ] Testes de unidade: helper de tema (alternância e persistência); componente `BottomNav` destaca a rota ativa
- [ ] Testes de integração: Playwright com rota protegida sem sessão → `/login`; login com credenciais de teste do Supabase local → Hoje; logout → `/login`

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `package.json`, `next.config.ts`, `tsconfig.json`, `.env.example`, `CLAUDE.md`
- `src/proxy.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`
- `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/(app)/**/page.tsx`
- `src/styles/tokens.css`, `src/components/shell/*`, `src/components/ui/*`
- `public/brand/*`, `supabase/config.toml`, `vitest.config.ts`, `playwright.config.ts`

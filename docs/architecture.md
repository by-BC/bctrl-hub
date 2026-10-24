# Organização do código

O app usa módulos por funcionalidade: o código que muda junto fica junto. A estrutura é incremental; não adicionamos camadas ou abstrações sem um caso de uso concreto.

```text
src/
├── app/                    # rotas Next.js; compõe telas de features
├── components/
│   ├── ui/                 # componentes visuais genéricos
│   ├── shell/              # navegação e estrutura global
│   └── brand/              # elementos de marca
├── features/
│   └── <feature>/
│       ├── api.ts          # acesso a dados da feature
│       ├── hooks.ts        # queries e casos de uso do cliente
│       ├── components/     # interface da feature
│       ├── domain/         # regras puras do domínio
│       └── schemas/        # validação de entradas e dados persistidos
└── lib/
    ├── domain/             # regras puras compartilhadas por mais de uma feature
    ├── query/              # configuração e políticas de mutations
    └── supabase/           # clientes de infraestrutura
```

## Regras de dependência

- `app` conhece as features para montar páginas; as features não importam páginas de `app`.
- `api.ts` concentra I/O da feature. Regras sem I/O ficam em `domain/` e podem ser testadas isoladamente.
- `schemas/` pertence ao módulo que define o contrato. Outra feature pode importar o schema explícito quando compartilhar aquele contrato.
- `lib/domain` é somente para regras realmente compartilhadas, como datas, semana, pontuação e modelos básicos de treino. Uma regra usada por uma única feature deve morar em `features/<feature>/domain`.
- `lib` não deve virar uma pasta genérica de `utils`, `services` ou `helpers`. Código visual compartilhado vai para `components/ui` ou `components/shell` conforme sua responsabilidade.
- Evite arquivos `index.ts` que reexportam diretórios inteiros; importe do módulo dono para manter a origem clara.

## Domínios atuais

| Feature | Regras e contratos próprios |
|---|---|
| `composition` | métricas, metas e validação de medições corporais |
| `exercises` | filtros e busca do catálogo de exercícios |
| `habits` | progresso, sequência e schemas de hábitos |
| `meals` | adesão ao plano, itens e schema das refeições |
| `nutrition` | alimentos, macros e cálculo de metas nutricionais |
| `profile` | conquistas, resumo mensal e dados do perfil |
| `routines` | ordenação, busca e schemas de rotinas/exercícios |
| `story` | construção dos dados dos stories |
| `workout-session` | schema do payload de finalização da sessão |

`history`, `progress` e `today` mantêm suas consultas e interfaces próprias. Regras que ainda são compartilhadas entre esses módulos permanecem em `lib/domain` até que exista uma fronteira de domínio mais clara.

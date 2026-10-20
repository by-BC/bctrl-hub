# Tarefa 4.0: Metas de composição e integração com as metas nutricionais

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Duas frentes:
- **Metas de composição** (% gordura, músculo esquelético kg, visceral e peso): valor-alvo e data-alvo opcional, progresso (partida → atual → alvo) e projeção de data por `projectGoal`.
- **Metas nutricionais da v2**: passam a mostrar e permitir escolher a fonte da TMB (automática, balança ou fórmula) e a base da proteína (peso ou massa magra). As barras de consumido × meta usam o resultado.

**Depende de:** 3.0.

<requirements>
- PRD RF14–RF20; techspec **Modelos de Dados** (`composition_goals`, fonte da TMB, base da proteína, projeção)
- `CompositionGoals` em `/evolucao/composicao`: criar, editar e arquivar meta (uma ativa por métrica); progresso em %; projeção ("deve chegar em dd/mm/aaaa") ou "sem projeção" com o motivo (poucas medições, tendência contrária, estável, já atingida). `achieved_on` é preenchido quando a medição atinge o alvo
- `profile-form` (`/perfil/dados`): "TMB: balança (dd/mm)" ou "TMB: fórmula", com a explicação; seletor da fonte (`auto`, `scale`, `formula`); seletor da base da proteína (`weight` ou `lean_mass`) e g/kg de massa magra (padrão 2,5); a conta passo a passo usa a fonte escolhida
- `NutritionBars` (Comida e Hoje) usam `goalsFromProfile` com `BmrInput` vindo de `useLatestMeasurement`
- Gravações pelo `WRITES`; nada de offline
</requirements>

## Subtarefas

- [ ] 4.1 Hooks e gravações de `composition_goals`
- [ ] 4.2 Componente `CompositionGoals` (lista, criar/editar, progresso, projeção, arquivar)
- [ ] 4.3 Marcar `achieved_on` ao atingir o alvo (no cliente, ao salvar a medição, de forma idempotente)
- [ ] 4.4 `profile-form`: fonte da TMB e base da proteína, com a conta passo a passo
- [ ] 4.5 `NutritionBars` com a TMB e a massa magra da última medição
- [ ] 4.6 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Modelos de Dados → Fonte da TMB, Base da proteína, Projeção** e **Interfaces Principais** (`goalBreakdown` com `BmrInput`).

## Critérios de Sucesso

- Com 3 medições semeadas em tendência de queda de gordura, a meta mostra o progresso e uma data de projeção coerente
- Com medição de até 30 dias, `/perfil/dados` mostra "TMB: balança", e as metas mudam de acordo; trocar para "fórmula" volta ao cálculo da v2
- A proteína por massa magra usa 2,5 g/kg × massa magra quando escolhida
- Sem medição, tudo funciona como na v2

## Testes da Tarefa

- [ ] Testes de unidade: progresso da meta (subir e descer, já atingida); texto da projeção e dos motivos; `profile-form` mostra a fonte certa
- [ ] Testes de integração: unicidade da meta ativa; E2E cria meta com medições semeadas e vê o progresso e a projeção; alterna a fonte da TMB e vê as metas mudarem

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/features/composition/components/composition-goals.tsx`, `src/features/composition/hooks.ts`
- `src/features/profile/components/profile-form.tsx`, `src/features/nutrition/components/nutrition-bars.tsx`
- `tests/unit/composition-goals.test.ts`, `tests/e2e/composition-goals.spec.ts`

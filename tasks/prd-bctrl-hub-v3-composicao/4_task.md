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

- [x] 4.1 Hooks e gravações de `composition_goals`
- [x] 4.2 Componente `CompositionGoals` (lista, criar/editar, progresso, projeção, arquivar)
- [x] 4.3 Marcar `achieved_on` ao atingir o alvo (no cliente, ao salvar a medição, de forma idempotente)
- [x] 4.4 `profile-form`: fonte da TMB e base da proteína, com a conta passo a passo
- [x] 4.5 `NutritionBars` com a TMB e a massa magra da última medição
- [x] 4.6 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Modelos de Dados → Fonte da TMB, Base da proteína, Projeção** e **Interfaces Principais** (`goalBreakdown` com `BmrInput`).

## Critérios de Sucesso

- Com 3 medições semeadas em tendência de queda de gordura, a meta mostra o progresso e uma data de projeção coerente
- Com medição de até 30 dias, `/perfil/dados` mostra "TMB: balança", e as metas mudam de acordo; trocar para "fórmula" volta ao cálculo da v2
- A proteína por massa magra usa 2,5 g/kg × massa magra quando escolhida
- Sem medição, tudo funciona como na v2

## Testes da Tarefa

- [x] Testes de unidade: progresso da meta (subir e descer, já atingida); texto da projeção e dos motivos; `profile-form` mostra a fonte certa
- [x] Testes de integração: unicidade da meta ativa; E2E cria meta com medições semeadas e vê o progresso e a projeção; alterna a fonte da TMB e vê as metas mudarem

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/features/composition/components/composition-goals.tsx`, `src/features/composition/hooks.ts`
- `src/features/profile/components/profile-form.tsx`, `src/features/nutrition/components/nutrition-bars.tsx`
- `tests/unit/composition-goals.test.ts`, `tests/e2e/composition-goals.spec.ts`

## Notas de execução (2026-10-20)

- **Metas de composição:** `CompositionGoals` (`composition-goals.tsx`) entra em `/evolucao/composicao` entre o card da última medição e os gráficos (no desktop, na coluna da esquerda). Uma meta ativa por métrica: "Nova meta" só oferece as métricas livres, e as sem medição aparecem desabilitadas. A partida (`start_value`/`start_day`) é a medição mais recente da métrica; o alvo igual à partida é recusado. Arquivar pede confirmação.
- **Progresso e projeção:** `goalView` (`src/features/composition/goals-view.ts`) usa `goalProgress` e `projectGoal(metricSeries(...), alvo, partida)` sobre todo o histórico. Textos: "Deve chegar em dd/mm/aaaa" (com "depois da data-alvo" quando passa dela) ou "Sem projeção: …" com o motivo (poucas medições, tendência contrária, estável, já atingida). Medidor de uma cor (`bg-chart-1`) com o percentual em texto.
- **`achieved_on`:** `newlyAchieved` (domínio) escolhe as metas ativas, ainda sem conclusão, com a medição no dia da partida ou depois e o valor no alvo. O `onSuccess` de `useSaveMeasurement` grava a data por `WRITES.updateCompositionGoal` (só as não marcadas: idempotente). Editar o alvo recalcula a conclusão pela última medição. As gravações de meta usam o mesmo `scope` das medições, e a última da fila revalida tudo (`settleComposition`).
- **TMB e proteína:** `bmrChoice` (novo, em `nutrition.ts`) diz a fonte e o motivo (`scale`, `formula_chosen`, `no_measurement`, `stale`, `fallback`); `pickBmr` passou a usá-lo. `bmrInputFrom(medições, dia)` (em `composition.ts`) pega a última TMB e a última massa magra até o dia, cada uma da sua medição. `useBmrInput(day)` usa a mesma consulta de `useLatestMeasurement`.
- **`/perfil/dados`:** novo bloco "Metabolismo e proteína" com a fonte da TMB (Automática, Balança, Fórmula), a linha "TMB: balança (dd/mm)" ou "TMB: fórmula" com a explicação, a base da proteína (Peso ou Massa magra) e o g/kg de massa magra (padrão 2,5; 0,5–5 com 1 casa, como o check do banco). A conta passo a passo mostra a TMB da balança ou a fórmula e a proteína pela massa magra quando é ela que vale.
- **Perfil:** `fetchProfile`/`ProfileSave` leem e gravam `bmr_source`, `protein_basis` e `protein_g_per_kg_lean`. Como a forma das variáveis de `saveProfile` mudou, o `CACHE_BUSTER` foi para `bctrl-v2`.
- **Metas do dia e do mês:** `useDayNutrition` (Comida e Hoje) e as metas do resumo do mês (`monthGoals`) passam o `BmrInput` das medições até o dia. Sem medição, tudo segue a v2.
- **Testes:** `tests/unit/composition-goals.test.ts` (16), integração (meta ativa duplicada pela API, `achieved_on` reenviado, perfil v3 ida e volta), `tests/e2e/composition-goals.spec.ts` (4 casos × 2 projetos) e o `a11y.spec` com meta semeada e o sheet de nova meta com erro.

# Tarefa 3.0: Tela de composição

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

A tela `/evolucao/composicao`, com:
- **card da última medição**: as 5 métricas principais e a variação de cada uma contra a primeira e contra a anterior;
- **gráficos de evolução**: as principais, mais gordura kg × músculo kg;
- **detalhe** de cada medição, com as 17 métricas;
- **formulário de nova medição**: principais visíveis, "Mais métricas" recolhido;
- edição e exclusão de medições.

Há um atalho a partir da seção de peso da Evolução.

**Depende de:** 1.0 (com a 2.0 aplicada, a tela já mostra o histórico real).

<requirements>
- PRD RF06–RF13; techspec **Visão Geral → feature `composition`** e **Fluxo de dados**
- Hooks `useMeasurements` e `useLatestMeasurement`; gravações (`addMeasurement`, `updateMeasurement`, `deleteMeasurement`) pelo registro `WRITES`, com id do cliente + upsert. Nada de offline
- Invalidações ao gravar: composição, peso (`body_weights`), metas nutricionais e o resumo do Perfil
- Formulário:
  - data e hora (padrão: agora) e peso obrigatório;
  - % gordura, músculo esquelético kg, visceral e massa magra kg em destaque; as outras 12 métricas recolhidas;
  - validação por `validateMeasurement`, com mensagem clara;
  - teclado numérico; rótulos com unidade
- Variação com seta + texto; a cor segue `better` da métrica, sem ser o único sinal
- Gráficos com o `TrendChart`/`ChartCard` da Evolução: filtro 1 mês / 3 meses / tudo e "ver dados"
- Exclusão com `ConfirmDialog`
- Tabela "ver dados" do peso mostra a origem (balança ou manual)
- Mobile-first, 375 px sem rolagem horizontal; números com `num`/`<NumUnit>`; skill `dataviz` para os gráficos; skill `impeccable` se estiver disponível
</requirements>

## Subtarefas

- [x] 3.1 `api.ts` e `hooks.ts` de `src/features/composition` + entradas no `WRITES`
- [x] 3.2 `LatestMeasurementCard` com variações
- [x] 3.3 `CompositionCharts` (principais e gordura × músculo)
- [x] 3.4 `MeasurementSheet` (criar e editar) e `MeasurementDetail` (com excluir)
- [x] 3.5 Página `/evolucao/composicao` + atalho na seção de peso + origem na tabela do peso
- [x] 3.6 Estados vazios ("Nenhuma medição ainda") e skeletons sem deslocar o layout
- [x] 3.7 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Visão Geral dos Componentes** (feature `composition`, `progress` modificada) e **Interfaces Principais** (`composition.ts`).

## Critérios de Sucesso

- Registrar uma medição com as 5 principais leva ≤ 60 s e atualiza o card, os gráficos e o peso da Evolução sem recarregar
- Valor fora de faixa mostra uma mensagem clara e não grava
- Editar e excluir funcionam, com confirmação na exclusão
- Axe sem violações serious/critical em `/evolucao/composicao`, com o sheet aberto, nos dois temas

## Testes da Tarefa

- [x] Testes de unidade: formatação das variações (direção boa ou ruim, sem base); montagem das séries do gráfico; o formulário mostra o erro de faixa
- [x] Testes de integração: E2E registra a medição e vê o card e o peso na Evolução; validação; editar e excluir; axe na rota nova (adicionar ao `a11y.spec.ts`)

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/features/composition/*`
- `src/app/(app)/evolucao/composicao/page.tsx`
- `src/features/progress/components/body-weight-section.tsx`
- `tests/unit/composition-ui.test.tsx`, `tests/e2e/composition.spec.ts`, `tests/e2e/a11y.spec.ts`

## Notas de execução (2026-10-20)

- **Gravações:** `addMeasurement` (upsert pelo id) serve para criar e editar; não foi preciso um `updateMeasurement`. As mensagens de sucesso ficam no `useMutation` do hook (o sheet fecha antes de a gravação voltar). Invalidações: `composition`, `progress/body-weights`, `profile` e `week` (resumo do mês e pontuações).
- **`fetchBodyWeights`** devolve `source` (`manual` | `scale`), pendência da 1.0. Na tabela "ver dados" do peso a origem aparece sob o dia; linha da balança não tem lixeira (o peso sai excluindo a medição, em Composição).
- **Data e hora:** `datetime-local` em São Paulo (`saoPauloLocal` / `saoPauloLocalToInstant` em `day.ts`, com o fuso real da data). Data no futuro é recusada.
- **Validação:** `measurementErrors` (por métrica) no domínio; `validateMeasurement` continua igual. O campo com erro fica `aria-invalid` e "Mais métricas" abre sozinho se o erro estiver lá. Grau de obesidade aceita negativo (teclado de texto); idade metabólica com teclado numérico.
- **Variação:** seta + número com sinal + unidade ("p.p." para %), cor pela direção desejada (`text-primary-text` = melhora, `text-highlight-text` = piora, neutra no peso e nas métricas sem direção), e o tom em texto para leitores de tela.
- **Gráficos:** uma métrica principal por vez (seletor) e gordura kg × músculo esquelético kg (só medições com as duas), filtro 3 meses por padrão. Celular: card → gráficos → lista; desktop: card e lista | gráficos.
- **`Segmented`** ganhou `stretch` (5 opções em 375 px). `movingAverage` ficou genérica (carrega a origem).
- **Testes:** unidade 502 (inclui `composition-ui.test.tsx`, 12); integração 252; E2E `composition` (4), `progress` e `a11y` (com `/evolucao/composicao`, o sheet de nova medição aberto com erro e o detalhe) nos dois projetos; mobile completo 59/60 + o `routines` instável passou ao repetir; desktop completo 61/61.

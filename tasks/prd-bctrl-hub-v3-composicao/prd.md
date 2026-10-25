# PRD — Bctrl Hub v3: Composição Corporal

> Evolução do Bctrl Hub (v1 em `tasks/prd-bctrl-hub/`, v2 em `tasks/prd-bctrl-hub-v2/`). Uso pessoal, usuário único.

## Visão Geral

O dono usa uma balança de bioimpedância que mede, além do peso, gordura corporal, massa muscular esquelética, gordura visceral, água, massa óssea, proteína, massa magra, metabolismo basal (TMB) e idade metabólica. Ele tem um histórico exportado do app da balança (planilha `.xlsx` com ~32 medições de 31/05/2026 a 19/10/2026, 17 métricas cada). Esses dados não existem no Bctrl Hub hoje. A evolução mostra só o peso, digitado à mão, e as metas nutricionais estimam o metabolismo por fórmula.

A v3 traz a **composição corporal** para o app:
- importação única do histórico;
- registro manual das próximas medições;
- uma tela de evolução com as métricas principais em destaque e todas as outras no detalhe;
- metas de composição, como % de gordura e kg de músculo, com progresso;
- integração com o que já existe: o peso do dia na Evolução, a TMB medida nas metas nutricionais e a variação de gordura e músculo no Perfil e no card do mês.

## Objetivos

- **Histórico completo:** 100% das medições da planilha importadas, com as 17 métricas, sem duplicar.
- **Registro rápido:** uma nova medição (data + 5 métricas principais) em ≤ 60 s no celular.
- **Leitura imediata:** ao abrir a tela, ver em ≤ 5 s a última medição, a variação desde a primeira e o progresso de cada meta de composição.
- **Metas mais precisas:** quando houver medição, as metas nutricionais usam a TMB medida, e o formulário indica qual fonte foi usada.
- **Fonte única de peso:** medições da balança e registros manuais de peso convivem sem duplicar dias.

## Histórias de Usuário

Persona: **usuário** (dono do app), que se pesa na balança de bioimpedância e acompanha a recomposição corporal junto com treino e dieta.

- Como usuário, quero **importar meu histórico da balança** para ver minha evolução desde maio.
- Como usuário, quero **registrar uma nova medição** copiando os números que a balança mostra, sem precisar preencher as 17 métricas.
- Como usuário, quero **ver a evolução de gordura, massa muscular, visceral e massa magra** em gráficos, para saber se estou perdendo gordura e mantendo músculo.
- Como usuário, quero **ver todas as métricas de uma medição** num detalhe, quando quiser conferir água, ossos ou idade metabólica.
- Como usuário, quero **definir metas de composição** (ex.: 15% de gordura) e ver o progresso e uma estimativa de quando chego lá.
- Como usuário, quero que **minhas metas de calorias usem o metabolismo medido** pela balança, e não só a fórmula.
- Como usuário, quero que **o peso da balança apareça na Evolução** sem eu precisar registrá-lo duas vezes.
- Como usuário, quero **ver no resumo do mês e no card do mês** quanto variaram gordura e músculo.

**Casos extremos:**
- duas medições no mesmo dia (ex.: manhã e noite);
- medição com só algumas métricas preenchidas;
- dia com peso manual e medição da balança;
- métricas ausentes ou zeradas na planilha;
- separador decimal e formato de data da planilha (dd/mm/aaaa, ponto decimal em texto);
- meta já atingida ou tendência contrária à meta, caso em que não há projeção possível.

## Funcionalidades Principais

### F1. Importação única do histórico

- **RF01** — Importar a planilha exportada do app da balança (formato da amostra: cabeçalho com sexo, idade e altura; uma linha por medição com data, hora e as 17 métricas).
- **RF02** — Converter datas (dd/mm/aaaa + hora) para o fuso America/Sao_Paulo e números em texto (ponto decimal) para valores numéricos. Células vazias viram métrica ausente, nunca zero.
- **RF03** — A importação deve ser **idempotente**: importar de novo a mesma planilha não duplica medições. Uma medição é identificada por data e hora.
- **RF04** — Ao final, mostrar um relatório: medições importadas, período, métricas presentes e linhas ignoradas, com o motivo.
- **RF05** — A planilha e os dados importados não podem ir para o repositório público.

### F2. Registro manual de medições

- **RF06** — Formulário de nova medição com data e hora (padrão: agora), **peso obrigatório** e as métricas principais em destaque (% gordura, massa muscular esquelética em kg, gordura visceral, massa magra em kg). As demais métricas ficam numa seção recolhida e são todas opcionais.
- **RF07** — Validar faixas plausíveis por métrica (ex.: % gordura entre 2 e 70; visceral entre 1 e 60) com mensagem clara.
- **RF08** — Editar e excluir medições, com confirmação.
- **RF09** — Funcionar sem sinal, pela fila offline existente do app.

### F3. Tela de composição corporal

- **RF10** — Seção **Composição** acessível a partir da Evolução:
  - card da **última medição** com as 5 métricas principais;
  - variação de cada uma contra a primeira medição e contra a medição anterior (seta + texto).
- **RF11** — **Gráficos de evolução** das métricas principais, com filtro de período (1 mês, 3 meses, tudo) e alternativa em tabela ("ver dados").
- **RF12** — **Detalhe de uma medição** com as 17 métricas, unidades e data e hora.
- **RF13** — Gráfico combinado opcional de **gordura (kg) × massa muscular (kg)** no mesmo período, para enxergar a recomposição.

### F4. Integração com peso e metas nutricionais

- **RF14** — O peso de uma medição da balança conta como o **peso do dia** na Evolução e onde mais o peso for usado: metas, perfil e proteína por kg.
  - Num dia com medição e registro manual, prevalece a medição mais recente do dia.
  - O dia nunca aparece duplicado no gráfico de peso.
- **RF15** — As metas nutricionais (v2) usam a **TMB da última medição** em vez da fórmula Mifflin-St Jeor, quando houver medição nos últimos 30 dias. Sem isso, voltam à fórmula.
- **RF16** — O formulário de metas mostra **qual TMB foi usada** (balança, com a data, ou fórmula) e permite escolher manualmente a fonte.
- **RF17** — Opção de calcular a proteína-alvo pela **massa magra** (padrão: **2,5 g por kg de massa magra**, ajustável) em vez do peso total, quando houver medição.

### F5. Metas de composição

- **RF18** — Definir metas para % de gordura, massa muscular esquelética (kg), gordura visceral e peso, cada uma com valor-alvo e data-alvo opcional.
- **RF19** — Mostrar o progresso de cada meta: valor de partida, atual e alvo, em percentual concluído.
- **RF20** — **Projeção** da data em que a meta será atingida, pela tendência de **todo o histórico** de medições da métrica. Com tendência contrária ou menos de 3 medições, mostrar "sem projeção" e o motivo.
- **RF21** — Conquistas de composição no catálogo da v2, por exemplo: "−1% de gordura", "meta de composição atingida".

### F6. Perfil e card do mês

- **RF22** — O **resumo mensal** do Perfil (v2) inclui a variação no mês de peso, % de gordura e massa muscular, comparada ao mês anterior. Meses sem medição mostram "sem medições".
- **RF23** — O **card do mês** (story 9:16 da v2) inclui a variação de gordura e músculo quando houver medição no mês.

## Experiência do Usuário

**Fluxos principais**
1. *Importação (PC, uma vez):* o dono indica a planilha, vê o relatório e confirma. O histórico aparece em Composição.
2. *Nova medição (celular, após se pesar):* Evolução → Composição → "Nova medição" → peso + 4 principais → salvar. O peso do dia atualiza.
3. *Acompanhamento:* abrir Composição → card da última medição e metas → gráficos → detalhe de uma medição.
4. *Metas nutricionais:* em `/perfil/dados`, ver "TMB: X kcal (balança, dd/mm)" e escolher a fonte, se quiser.

**Diretrizes de UI**
- Seguir a identidade e os padrões das versões anteriores: tokens Bctrl, Sora + IBM Plex Mono, tema escuro padrão, prioridade ao celular e alvos ≥ 44 px.
- Números com unidade (kg, %, kcal) no padrão do app. A variação usa seta **e** texto, e a cor indica se a direção é desejada, sem ser o único sinal: gordura caindo é bom, músculo caindo é ruim.
- Gráficos no mesmo método da Evolução (v1), legíveis nos dois temas.
- O formulário de medição mostra primeiro só os campos principais. "Mais métricas" expande o restante.

**Acessibilidade**
- Gráficos com tabela alternativa e resumo textual.
- Campos numéricos com rótulo e unidade, teclado numérico no celular.
- Contraste WCAG AA nos dois temas; axe sem violações graves nas telas novas.

## Restrições Técnicas de Alto Nível

- **Privacidade:** composição corporal é dado de saúde, acessível só ao dono (mesmo isolamento por usuário da v1 e da v2). A planilha e os dados derivados nunca vão para o repositório público.
- **Aplicação em produção:** a importação segue o padrão já usado na v2 (Hevy e TACO). O dono revisa o relatório e aplica no banco de produção.
- **Stack mantido:** Next.js + Supabase + Vercel, planos gratuitos. Fuso America/Sao_Paulo, unidades métricas, pt-BR.
- **Desempenho:** a tela de composição abre em ≤ 2 s em 4G com 1 ano de medições.
- **Compatibilidade com a v2:** metas nutricionais, peso corporal, resumo mensal e card do mês continuam funcionando para quem não tem medições (fórmula e peso manual como reserva).

## Fora de Escopo

- Integração direta com a balança, o app ou a nuvem do fabricante (Bluetooth, API).
- Importações recorrentes da planilha pela interface. A importação é única; depois, o registro é manual.
- Medidas com fita (circunferências) e fotos de progresso.
- Interpretação clínica ou recomendações médicas a partir das métricas.
- Story dedicado de "antes × depois" da composição (fica para uma versão futura; a variação entra no card do mês).
- Lembretes, hábito ou tarefa recorrente de pesagem: a medição é só um registro, feito quando o dono quiser.

## Questões em Aberto

**Resolvidas com o dono:**
- Marca e modelo da balança: indiferentes. O formato de referência é o da planilha exportada.
- Duas medições no mesmo dia: a medição é só um registro, sem rotina recorrente. No caso raro de duas no mesmo dia, o peso do dia é o da mais recente (RF14).
- Validade da TMB medida: 30 dias (RF15).
- Proteína por massa magra: 2,5 g/kg como padrão, ajustável (RF17).
- Métricas principais: peso, % de gordura, massa muscular esquelética (kg), gordura visceral e massa magra (kg).
- Projeção: tendência de todo o histórico (RF20).

**Pendentes:** nenhuma.

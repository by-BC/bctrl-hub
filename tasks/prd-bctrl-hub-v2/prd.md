# PRD — Bctrl Hub v2: Hevy, Perfil e Nutrição

> Evolução do Bctrl Hub (v1 em `tasks/prd-bctrl-hub/prd.md`). Uso pessoal, usuário único.

## Visão Geral

A v1 do Bctrl Hub registra treinos, adesão ao plano alimentar, hábitos e tarefas. Três lacunas ficaram:

1. **Catálogo de exercícios pobre.** Só existem os 26 exercícios do plano atual. Trocar ou variar um exercício exige cadastrá-lo à mão, e o histórico anterior, registrado no Hevy, ficou de fora da evolução.
2. **Falta uma visão de longo prazo.** O app mostra a semana, mas não responde "como foi meu mês?" nem "há quanto tempo estou no controle?".
3. **A alimentação é medida só por adesão.** O dono sabe se seguiu o plano, mas não quanto consumiu de calorias, proteína, carboidrato e gordura em relação a uma meta, e as refeições fora do plano não entram em nenhuma conta.

A v2 resolve isso com três frentes: **importação única do Hevy** (catálogo e histórico), **perfil com realizações** (heatmap estilo GitHub, resumo mensal, conquistas e card compartilhável) e **nutrição com metas** (valores da tabela TACO, metas calculadas a partir do perfil e alimentos fora do plano contabilizados).

## Objetivos

- **Catálogo completo:** ~430 exercícios do Hevy disponíveis para busca e filtro (músculo e equipamento) no app, em português.
- **Histórico unificado:** 100% dos treinos registrados no Hevy importados, aparecendo na evolução, nos recordes e no heatmap, sem duplicar exercícios.
- **Visão do mês em ≤ 5 s:** ao abrir o perfil, o dono vê o heatmap do ano, o resumo do mês e as conquistas.
- **Nutrição medida:** em qualquer dia, ver o consumido versus a meta de kcal, proteína, carboidrato e gordura, incluindo o que foi comido fora do plano.
- **Registro rápido mantido:** adicionar um alimento fora do plano em ≤ 4 toques após abrir a refeição.

## Histórias de Usuário

Persona: **Bruno**, dono do app (ver PRD v1), que usava o Hevy antes do Bctrl Hub e segue um plano alimentar com opções.

- Como Bruno, quero **buscar qualquer exercício do catálogo do Hevy** ao montar uma rotina ou durante o treino, para não ter que cadastrá-lo.
- Como Bruno, quero **filtrar exercícios por músculo e equipamento**, para achar variações (ex.: "Peito + Halter").
- Como Bruno, quero que **meus treinos antigos do Hevy apareçam nos gráficos e recordes**, para a evolução começar do meu histórico real.
- Como Bruno, quero **ver um heatmap do ano** em que cada dia mostra o quanto fiquei "no controle", para enxergar minha consistência.
- Como Bruno, quero **um resumo do mês** (treinos, volume, PRs, dias no controle, adesão, cardio), comparado ao mês anterior.
- Como Bruno, quero **desbloquear conquistas** (ex.: 4 semanas seguidas de treino), para ter marcos de motivação.
- Como Bruno, quero **ver os recordes batidos no mês**.
- Como Bruno, quero **exportar o resumo do mês como story 9:16**, no mesmo padrão visual dos stories de treino.
- Como Bruno, quero **informar meus dados corporais e objetivo** e receber metas de kcal e macros calculadas, podendo ajustá-las.
- Como Bruno, quero **ver kcal e macros de cada opção do plano** e o **total do dia versus a meta**.
- Como Bruno, quero **registrar o que comi fora do plano buscando alimentos na TACO**, para que entre no total do dia.

**Casos extremos:** exercício do Hevy sem equivalente exato entre os 26 atuais; exercício personalizado do Hevy; treino do Hevy com carga em outra unidade ou sem carga (peso corporal, cardio); alimento do plano sem correspondência na TACO; mês sem nenhum dado; dia futuro no heatmap; importação interrompida no meio.

## Funcionalidades Principais

### F1. Importação do Hevy (uma única vez)

Traz o catálogo e o histórico do Hevy para o Bctrl Hub. Depois da importação, o dono passa a treinar só no Bctrl Hub.

- **RF01** — Importar o catálogo de exercícios do Hevy com **nome em português, músculo principal e equipamento** de cada exercício, a partir da conta do dono.
- **RF02** — **Mídia do Hevy por referência:** guardar o endereço da miniatura e da animação (GIF/vídeo) de cada exercício e exibi-las carregando do endereço original. O arquivo não é copiado para o armazenamento do app nem para o repositório, porque é mídia licenciada de terceiros. Se a mídia não carregar, mostrar um placeholder com o símbolo Bctrl e o grupo muscular. Guardar também o identificador do exercício no Hevy como referência de origem.
- **RF02b** — **Instruções próprias:** cada exercício do catálogo ganha um texto de execução escrito para o Bctrl Hub (posição inicial, execução, respiração e erros comuns, em até ~80 palavras). O texto não é copiado do Hevy. Ele aparece no detalhe do exercício e, recolhido, durante a sessão de treino, junto às observações técnicas da rotina.
- **RF03** — Importar os **exercícios personalizados** do dono no Hevy.
- **RF04** — **Vincular** os exercícios já existentes no Bctrl Hub ao equivalente do catálogo, sem duplicar. Os vínculos que não puderem ser feitos automaticamente devem ser listados para o dono confirmar ou corrigir.
- **RF05** — Importar o **histórico de treinos** do Hevy (data, duração, exercícios, séries com carga e repetições) para a mesma estrutura dos treinos do app, de modo que apareçam no histórico, na evolução, nos recordes e no heatmap.
- **RF06** — A importação deve ser **idempotente**: rodar de novo após uma interrupção não pode duplicar exercícios nem treinos.
- **RF07** — Ao final, exibir um **relatório da importação**: exercícios importados, vinculados, pendentes de revisão, treinos importados e itens ignorados, com motivo.
- **RF08** — O catálogo de exercícios do app (`/treino/exercicios` e o seletor de exercício) deve permitir **busca e filtro por músculo e equipamento**.

### F2. Perfil e realizações

Uma tela de perfil que mostra consistência e marcos.

- **RF09** — Tela **Perfil** com nome, dados corporais e objetivo (usados pela F3) e as seções abaixo.
- **RF10** — **Heatmap estilo GitHub** dos últimos 12 meses: um quadrado por dia, organizado por semanas (colunas) e dias da semana (linhas), com 5 níveis de intensidade (0 a 4) calculados pela pontuação "dia no controle".
- **RF11** — **Pontuação "dia no controle"**: soma de até 4 pontos no dia, um para cada critério cumprido:
  - treino (sessão finalizada) ou cardio registrado;
  - dieta (adesão ao plano do dia ≥ 80%);
  - hábitos diários cumpridos;
  - tarefas (pelo menos uma tarefa concluída no dia).
- **RF12** — Tocar ou passar o mouse sobre um dia do heatmap mostra a data, a pontuação e quais critérios foram cumpridos. Dias futuros não aparecem preenchidos.
- **RF13** — **Resumo mensal** com navegação entre meses: treinos, volume total (kg), PRs, dias no controle (pontuação ≥ 3), adesão alimentar média, minutos e km de cardio e média de kcal versus meta. Cada número mostra a variação em relação ao mês anterior.
- **RF14** — **Recordes do mês**: lista dos PRs batidos no mês selecionado (exercício, tipo de recorde, valor e data).
- **RF15** — **Conquistas (badges)**: conjunto inicial de selos com regra clara, data de desbloqueio e estado bloqueado com progresso. Exemplos:
  - primeiro PR;
  - 4 semanas seguidas batendo a meta de treino;
  - 30 dias no controle;
  - 1.000 kg numa sessão;
  - 100 treinos;
  - um mês inteiro com adesão alimentar ≥ 80%.
- **RF16** — As conquistas devem considerar também o histórico importado do Hevy.
- **RF17** — **Card do mês compartilhável**: exportar o resumo mensal (heatmap do mês, números principais e conquistas do mês) como imagem 1080×1920, com a identidade Bctrl e o mesmo fluxo de compartilhar ou baixar do Story Studio.

### F3. Nutrição com metas

- **RF18** — Cadastrar no perfil os **dados corporais**: sexo, data de nascimento, altura, peso (o mais recente registrado), nível de atividade e objetivo (perder gordura, manter, ganhar massa).
- **RF19** — **Calcular as metas diárias** de kcal, proteína, carboidrato e gordura a partir do perfil, mostrando como foram calculadas, e permitir **ajuste manual** de cada meta.
- **RF20** — Permitir **meta diferente em dia de treino** e em dia sem treino (opcional).
- **RF21** — Disponibilizar a base de alimentos da **tabela TACO** (Unicamp) com kcal, proteína, carboidrato e gordura por 100 g.
- **RF22** — Calcular **kcal e macros de cada opção do plano alimentar** a partir dos itens e quantidades, associando cada item a um alimento da TACO. Itens sem correspondência ou com quantidade "à vontade" ficam sinalizados e podem ser associados ou ajustados manualmente.
- **RF23** — Permitir **editar manualmente** os valores nutricionais de qualquer item ou alimento.
- **RF24** — Na refeição **fora do plano**, adicionar alimentos buscando na TACO, com quantidade em g, ml ou unidade (com peso de referência), e somar ao total do dia.
- **RF25** — Mostrar no dia (tela Comida e painel Hoje) o **consumido versus a meta** de kcal e de cada macro, com barras de progresso e indicação de faltando ou excedente.
- **RF26** — Incluir a média de kcal e proteína versus meta no **resumo mensal** (RF13).

## Experiência do Usuário

**Fluxos principais**
1. *Importação (PC, uma vez):* o dono abre o Hevy logado no Chrome. A importação roda, mostra o progresso e termina com o relatório e a lista de vínculos a revisar. Ele confirma os vínculos e passa a ver o histórico no app.
2. *Perfil (celular ou PC):* aba Perfil → heatmap do ano → resumo do mês → conquistas → "Compartilhar mês".
3. *Comida (celular):* a refeição mostra kcal e macros da opção → marcar → as barras do dia avançam. Fora do plano: buscar "arroz", informar 150 g, adicionar.

**Diretrizes de UI**
- Seguir a identidade e os padrões da v1 (tokens Bctrl, Sora + IBM Plex Mono, tema escuro padrão, prioridade ao celular, alvos ≥ 44 px).
- **Heatmap:** escala de 5 níveis derivada do ultramarino da marca, legível nos dois temas. No celular, ele rola na horizontal dentro do próprio bloco, sem rolar a página.
- **Perfil na navegação:** acessível pelo cabeçalho (avatar/símbolo) no celular e pela lateral no desktop, sem tirar nenhum item da barra inferior.
- Números de kcal e macros em IBM Plex Mono. O excedente da meta é sinalizado por texto ou ícone, não só por cor.

**Acessibilidade**
- O heatmap tem alternativa textual: resumo por mês e uma tabela acessível, sem depender só da cor.
- As conquistas bloqueadas e desbloqueadas se diferenciam por ícone e texto.
- Contraste WCAG AA nos dois temas; navegação do heatmap por teclado no desktop.

## Restrições Técnicas de Alto Nível

- **Fonte do Hevy:** a importação usa a **API oficial do Hevy** com a chave do dono (guardada só localmente, fora do repositório). O nome em português e o vídeo de cada exercício vêm de uma leitura única do catálogo do site, com a sessão do dono no Chrome. Não usar credenciais em código nem automatizar login.
- **Conteúdo de terceiros:** do Hevy, são copiados só os dados factuais (nomes, músculos, equipamentos e os treinos do próprio dono). Imagens e animações são exibidas por referência ao endereço original, sem cópia nem rehospedagem. Os textos de instrução são próprios. A TACO é pública e deve ter a fonte citada no app.
- **Privacidade:** dados corporais e nutricionais são dados de saúde, acessíveis só ao dono (mesmas regras de isolamento da v1). Nada disso vai para o repositório público. Dados brutos exportados do Hevy não são versionados.
- **Stack mantido:** Vercel + Supabase, planos gratuitos. Fuso America/Sao_Paulo, unidades métricas, pt-BR.
- **Desempenho:** o perfil abre em ≤ 2 s em 4G com 12 meses de dados. A busca na TACO responde enquanto o dono digita.
- **Offline:** registrar alimento fora do plano deve funcionar sem sinal, pela mesma fila offline da v1.

## Fora de Escopo

- Sincronização contínua com o Hevy, ou exportar do Bctrl Hub para o Hevy.
- Copiar ou rehospedar imagens, GIFs e vídeos do Hevy (eles são exibidos por referência), e copiar textos de instrução do Hevy (as instruções são próprias).
- Leitura de código de barras, bases de alimentos internacionais (Open Food Facts, USDA) e micronutrientes (vitaminas, sódio, fibras).
- Recomendações automáticas de dieta ou ajuste automático do plano alimentar.
- Perfil público, ranking ou comparação com outras pessoas.
- Medidas corporais além de peso e altura (circunferências, % de gordura).
- Aviso de limite do jantar de hambúrguer (continua fora, como na v1).

## Questões em Aberto

1. **Disponibilidade da mídia por referência:** confirmar se o endereço das miniaturas e animações do Hevy carrega fora do site deles. Se for bloqueado, o catálogo fica com placeholders.
2. **Volume do histórico no Hevy:** quantos treinos existem na conta? Isso define o esforço da importação e se o heatmap já nasce preenchido.
3. **Fórmula das metas:** usar Mifflin-St Jeor e proteína por kg de peso corporal (ex.: 2 g/kg) como padrão? Qual déficit ou superávit por objetivo?
4. **"Hábitos diários cumpridos" no RF11:** contar só os hábitos com meta diária (suplementos) ou também o progresso proporcional dos semanais?
5. **Quantidades do plano:** itens como "1 fatia média (170 g)" já trazem gramas. Itens "à vontade" (salada) entram como 0 kcal ou com um valor padrão?
6. **Conquistas:** validar a lista inicial e os nomes dos selos.

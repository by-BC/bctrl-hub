# PRD — Bctrl Hub

> **Bctrl — Be in control.** Central pessoal de treino, alimentação, hábitos e tarefas.

## Visão Geral

O Bctrl Hub é uma aplicação web **de uso pessoal (usuário único)** para registrar e acompanhar a rotina de saúde e organização do dono: sessões de musculação com cargas e evolução, adesão ao plano alimentar, hábitos recorrentes (cardio, abdominal, suplementação) e uma lista simples de tarefas.

Hoje o treino e a dieta vivem em PDFs estáticos (Treino Iniciante 2 — The Last Natural; Plano Alimentar — The Natural), sem histórico de cargas, sem visão de adesão e sem forma rápida de registrar na academia. O Bctrl Hub resolve isso com registro rápido no celular (principal) e visualização confortável no PC, seguindo a identidade visual da marca Bctrl.

Não é um produto comercial: não há cadastro público, planos, multiusuário ou onboarding.

## Objetivos

- **Registro rápido:** registrar uma série na academia em ≤ 2 toques após abrir a sessão; marcar uma refeição em ≤ 3 toques.
- **Visibilidade da evolução:** para qualquer exercício, ver em um gráfico a progressão de carga e volume ao longo do tempo.
- **Adesão semanal clara:** ao abrir o app, saber em ≤ 5 segundos o status da semana — treinos feitos (meta 4), minutos de cardio (meta 150), abdominais (meta 3) e refeições do dia.
- **Deploy simples:** publicado na Vercel com banco Supabase, sem infraestrutura adicional e dentro dos planos gratuitos.
- **Uso contínuo:** uso diário por pelo menos 8 semanas consecutivas (métrica pessoal de sucesso).

## Histórias de Usuário

Persona única: **Bruno**, praticante de musculação nível iniciante, segue treino Upper/Lower 4x por semana e plano alimentar com opções; usa o celular na academia e o PC para revisar a evolução.

- Como Bruno, quero **iniciar o treino do dia (ex: Upper 1)** a partir da rotina cadastrada, para não montar a sessão do zero.
- Como Bruno, quero **ver a carga e as repetições da última vez** em cada série, para saber quanto progredir (pirâmide crescente).
- Como Bruno, quero que **um timer de descanso de 2 min** inicie ao concluir uma série, para manter o descanso correto sem outro app.
- Como Bruno, quero **ser avisado quando bater um recorde pessoal**, para acompanhar a progressão.
- Como Bruno, quero **ver as observações técnicas** da rotina (escápulas retraídas, cadência 2:3) durante o treino.
- Como Bruno, quero **gerar uma imagem de resumo do treino no formato story do Instagram**, para compartilhar a sessão com a identidade Bctrl.
- Como Bruno, quero **escolher qual opção do plano comi** em cada refeição e marcá-la como feita, para medir minha adesão à dieta.
- Como Bruno, quero **registrar minutos de cardio e marcar abdominal e suplementos**, para ver o progresso das metas semanais.
- Como Bruno, quero **criar hábitos customizados** com frequência própria (ex: ler 3x/semana).
- Como Bruno, quero **registrar meu peso corporal** e ver a tendência em gráfico.
- Como Bruno, quero uma **lista de tarefas simples** para criar, concluir e apagar itens.
- Como Bruno, no PC, quero **ver histórico e gráficos em tela maior** para analisar a evolução.

**Casos extremos:** sessão interrompida no meio (fechar o navegador/aba); treino feito fora da rotina (exercício extra ou pulado); refeição fora do plano; dia sem treino (pós-treino não aparece); primeira vez num exercício (sem carga anterior).

## Funcionalidades Principais

### F1. Acesso (login único)

Protege os dados pessoais; só o dono acessa.

- **RF01** — O sistema deve exigir autenticação para qualquer tela ou dado.
- **RF02** — Deve existir uma única conta (a do dono); não há tela pública de cadastro.
- **RF03** — A sessão deve permanecer ativa no dispositivo por longo período (sem relogar a cada uso na academia).

### F2. Rotinas de treino (estilo Hevy)

Modelos de treino reutilizáveis, inspirados nas *routines* do Hevy.

- **RF04** — Criar, editar, reordenar e excluir rotinas (ex: Upper 1, Lower 1, Upper 2, Lower 2).
- **RF05** — Cada rotina contém exercícios ordenados, com número de séries planejado e descanso padrão (default 2 min). Não há faixa de repetições por série: carga e reps são definidas na hora (pirâmide crescente).
- **RF06** — Cada rotina e cada exercício aceitam **observações técnicas** em texto (exibidas durante a sessão).
- **RF07** — Manter uma biblioteca de exercícios do usuário (nome + grupo muscular), reutilizável entre rotinas.
- **RF08** — O app deve vir com as 4 rotinas do PDF de treino pré-cadastradas (ver `anexo-dados-iniciais.md`).

### F3. Sessão de treino

O registro ao vivo na academia, núcleo do app.

- **RF09** — Iniciar sessão a partir de uma rotina ou vazia.
- **RF10** — Para cada série, registrar carga (kg) e repetições, e marcá-la como concluída.
- **RF11** — Cada série deve exibir o valor **anterior** (carga × reps da mesma série na última sessão daquele exercício).
- **RF12** — Ao concluir uma série, iniciar um **timer de descanso** visível (padrão da rotina, ajustável ±15 s, pode pular).
- **RF13** — Permitir adicionar/remover séries e exercícios durante a sessão sem alterar a rotina-base.
- **RF14** — Detectar e destacar **recordes pessoais (PR)**: maior carga, maior volume numa série e maior 1RM estimado por exercício.
- **RF15** — Uma sessão em andamento não pode ser perdida ao fechar/recarregar a página; ao voltar, o usuário retoma de onde parou.
- **RF16** — Ao finalizar, exibir resumo: duração, volume total (kg), séries, PRs batidos.
- **RF17** — Concluir uma sessão de musculação conta automaticamente para o hábito "Treino" da semana (meta 4).
- **RF18** — Histórico de sessões navegável, com detalhe de cada uma, e possibilidade de editar/excluir sessões passadas.

### F4. Card para story do Instagram

O card é a vitrine da marca: deve ser inovador, com cara de design autoral e não de print de app.

- **RF19** — A partir do resumo de uma sessão, gerar uma imagem **1080×1920 (9:16)** com: nome da rotina, data, duração, volume total, exercícios (melhor série de cada) e PRs, com logo e paleta Bctrl.
- **RF20** — Oferecer **variações de layout** escolhidas por deslize (swipe) antes de exportar. Mínimo de 4 na v1:
  - **Recibo** — estilo cupom fiscal em IBM Plex Mono: cada série é uma linha, o "total" é o volume em kg, PRs como itens em destaque, com picote e código de barras decorativo com a data.
  - **Hex Week** — o símbolo hexagonal gigante como anel de progresso da semana (treino, alimentação, hábitos), com o treino do dia no centro.
  - **Blueprint** — grade técnica em fundo ultramarino, com tipografia grande e números em destaque, no estilo de prancha de engenharia.
  - **Foto + overlay** — foto do usuário (câmera ou galeria) como fundo, com os dados do treino sobrepostos em faixa grafite/laranja.
- **RF21** — Cada layout deve respeitar as **áreas seguras do story** (sem conteúdo essencial nos ~250 px do topo e da base).
- **RF22** — A imagem deve poder ser baixada ou compartilhada pelo menu nativo do celular (incluindo direto para o Instagram, quando o sistema permitir).

### F5. Evolução

- **RF23** — Por exercício: gráfico de evolução da melhor carga, 1RM estimado e volume por sessão, com filtro de período (1 mês, 3 meses, tudo).
- **RF24** — Por exercício: lista de recordes pessoais e histórico de séries.
- **RF25** — Registrar peso corporal (data + kg) e exibir gráfico de tendência.

### F6. Plano alimentar e refeições

- **RF26** — Cadastrar o plano: refeições (nome, horário, se é só em dia de treino) e, em cada uma, opções com itens, quantidades e substituições.
- **RF27** — O app deve vir com o plano do PDF pré-cadastrado (ver anexo).
- **RF28** — Tela "Hoje": lista as refeições do dia em ordem de horário; o usuário escolhe a opção consumida e marca como feita.
- **RF29** — Permitir marcar uma refeição como "fora do plano", com nota livre.
- **RF30** — A refeição "Pós-treino" só aparece em dias com sessão de treino iniciada ou registrada.
- **RF31** — Exibir adesão do dia (refeições feitas / previstas) e da semana.

### F7. Hábitos recorrentes

- **RF32** — Hábitos com tipo **check** (feito/não feito) ou **quantidade** (ex: minutos) e meta por período: diária ou semanal (X vezes ou X unidades).
- **RF33** — Hábitos pré-cadastrados: **Treino** (4x/semana, automático via RF17), **Cardio** (150 min/semana), **Abdominal** (3x/semana) e **Desjejum/Suplementos** (diário: água 500 ml, glutamina 10 g, creatina 6 g).
- **RF34** — Cada registro de **cardio** guarda: tipo (esteira, bike, escada, caminhada, corrida, outro), minutos, distância (km, opcional) e calorias (kcal, opcional). A meta semanal soma os minutos; distância e calorias aparecem no histórico e no total da semana.
- **RF35** — Criar, editar, arquivar e excluir hábitos customizados.
- **RF36** — Mostrar progresso semanal de cada hábito e sequência (*streak*) de semanas com meta cumprida.

### F8. Tarefas (to-do simples)

- **RF37** — Criar tarefa com título; marcar como feita/desfeita; excluir.
- **RF38** — Tarefas concluídas ficam em seção separada e recolhida.

### F9. Painel "Hoje"

- **RF39** — Tela inicial com: treino sugerido do dia e atalho para iniciar, refeições do dia, hábitos do dia/semana e tarefas pendentes.
- **RF40** — O treino sugerido segue a **ordem fixa da sequência** (Upper 1 → Lower 1 → Upper 2 → Lower 2 → Upper 1…), sempre a próxima após a última sessão concluída, independente do dia da semana. O usuário pode escolher outra rotina manualmente.
- **RF41** — Resumo da semana no **Hex Week**: o símbolo do Bctrl Hub como anel de progresso, com segmento azul = treinos x/4, laranja = adesão alimentar %, claro = hábitos (cardio x/150 min, abdominal x/3, suplementos). O logo da marca é o próprio indicador.

## Experiência do Usuário

**Fluxos principais**
1. *Academia (celular):* abrir app → "Iniciar Upper 1" → preencher carga/reps vendo o anterior → concluir série → timer → … → finalizar → resumo → gerar story.
2. *Dia a dia (celular):* abrir "Hoje" → tocar refeição → escolher opção → feito; marcar suplementos; registrar 30 min de cardio.
3. *Revisão (PC):* abrir Evolução → escolher exercício → ver gráfico e PRs; ver peso corporal; ajustar rotinas.

**Diretrizes de UI**
- **Mobile-first**, site responsivo (não precisa ser instalável); no PC aproveitar a largura com layout em colunas.
- Navegação principal em barra inferior no celular (Hoje, Treino, Comida, Hábitos, Tarefas) e lateral no PC.
- **Identidade Bctrl:** ultramarino `#2448DB` (primária / ações), laranja queimado `#D96735` (destaques, PRs, timer), off-white `#F4F0E8` (fundo claro), grafite `#25272C` (texto / fundo escuro). Tipografia **Sora** (títulos e interface) e **IBM Plex Mono** (números: cargas, reps, timer, métricas).
- **Marca do produto:** logo e símbolo próprios do Bctrl Hub em `assets/brand/`. O símbolo é um hexágono-hub com 3 segmentos (treino em azul, alimentação em laranja, hábitos em neutro) e um núcleo central. Ele funciona como logo, favicon e anel de progresso semanal (RF41). Variantes: claro, escuro e azul.
- Tema escuro como padrão (uso na academia), com tema claro disponível.
- Alvos de toque ≥ 44 px; campos numéricos abrem teclado numérico; ações frequentes ao alcance do polegar.
- Feedback imediato em toda ação (marcar série/refeição/hábito sem tela de carregamento perceptível).

**Acessibilidade**
- Contraste mínimo WCAG AA em ambos os temas (atenção ao laranja sobre off-white).
- Estados (feito, PR, atrasado) não dependem só de cor: usar ícone ou texto.
- Navegação por teclado no PC e rótulos acessíveis nos controles.
- Respeitar a preferência de "reduzir movimento" do sistema.

## Restrições Técnicas de Alto Nível

- **Hospedagem:** Vercel, no subdomínio padrão (`*.vercel.app`). **Banco e autenticação:** Supabase. Ambos nos planos gratuitos.
- **Card de story:** gerado no próprio app; a foto do RF20 não precisa ser guardada no servidor.
- **Privacidade:** dados de saúde pessoais; todo dado deve ser acessível apenas pelo usuário autenticado (isolamento no nível do banco), sem chaves secretas expostas no cliente.
- **Desempenho:** tela "Hoje" utilizável em ≤ 2 s em 4G; ações de registro com resposta visual instantânea.
- **Conectividade:** a academia pode ter sinal fraco; uma série registrada não pode ser perdida por falha momentânea de rede (deve ser reenviada quando a conexão voltar).
- **Unidades e localidade:** kg, minutos, pt-BR, fuso America/Sao_Paulo; semana começa na segunda-feira.
- Dados iniciais (rotinas, plano alimentar, hábitos) carregados uma vez a partir do anexo.

## Fora de Escopo

- Multiusuário, cadastro público, compartilhamento de rotinas, feed social (o card de story é só uma imagem exportada).
- App nativo iOS/Android e PWA instalável; notificações push e lembretes.
- Contagem de calorias e macros, banco de alimentos, leitura de código de barras.
- Medidas corporais além do peso (circunferências, % de gordura, fotos de progresso).
- Integrações com Hevy, Apple Health, Google Fit, wearables ou Instagram (sem postagem automática).
- Vídeos ou GIFs de execução dos exercícios (no máximo um link externo nas observações).
- Tarefas com data, prioridade, projetos ou recorrência (recorrência é tratada em Hábitos).
- Modo totalmente offline (além da proteção do RF15 e do reenvio em sinal fraco).
- Exportação/importação de dados (CSV) na v1.

## Questões em Aberto

**Resolvidas:** sequência de rotinas em ordem fixa (RF40); só o número de séries (RF05); cardio com tipo, distância e calorias (RF34); story com variações (RF20); domínio padrão da Vercel; logo próprio criado em `assets/brand/`.

**Pendentes:**
1. **Jantar de hambúrguer:** o plano permite no máximo 2x por semana. O app deve avisar ao passar desse limite?
2. **Logo:** os SVGs usam texto com as fontes Sora e IBM Plex Mono. Antes de usar fora do app (camiseta, impressão), converter o texto em contornos.

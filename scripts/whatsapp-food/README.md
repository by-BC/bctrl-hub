# Assistente de alimentação e finanças pelo WhatsApp

Este serviço roda no computador junto da Evolution API. Ele aceita apenas mensagens **enviadas pela própria conta conectada** (`fromMe`) dentro do grupo configurado. Fotos de comida e mensagens de finanças recebem uma prévia; alimentos e lançamentos financeiros só são gravados após `CONFIRMAR`. O registro da refeição é preservado se já existir; se ainda não existir, é criado dentro do plano, como o complemento adicionado pelo app.

## Preparação

1. Se a Evolution ainda não estiver instalada, execute `node infra/evolution/init.mjs` para gerar os dois arquivos privados de configuração. Depois rode `docker compose --env-file infra/evolution/.env -f infra/evolution/compose.yaml up -d`. A interface da API fica em `http://localhost:8080/manager`. Crie uma instância WhatsApp Baileys chamada `bctrl-hub` e leia o QR Code em **WhatsApp → Aparelhos conectados**. Use a chave `EVOLUTION_API_KEY` do arquivo local para entrar no Manager.
2. Conecte seu WhatsApp a uma instância da Evolution API e crie um grupo somente com você. Se precisar criar o grupo com outra pessoa inicialmente, remova-a antes de usar este serviço.
3. Copie `scripts/whatsapp-food/env.example` para `.env.whatsapp.local` na raiz do projeto. Preencha os campos. Use uma chave aleatória longa em `WHATSAPP_WEBHOOK_SECRET`. O arquivo local é ignorado pelo Git. Instale o Codex CLI, entre com `codex.cmd login` e confirme com `codex.cmd login status`. O serviço usa a sessão do Codex CLI para analisar as fotos; não precisa de chave da API da OpenAI.
4. `EVOLUTION_URL` é o endereço acessível **pelo computador**, normalmente `http://localhost:8080`. `SUPABASE_URL` é a URL do projeto Supabase usado pelo app. `SUPABASE_SECRET_KEY` deve ser uma chave de servidor do mesmo projeto; nunca use a chave pública ou coloque essa chave no navegador. `BCTRL_USER_ID` é o UUID da sua conta em Supabase Auth → Users.
5. Rode `npm run whatsapp:groups` para listar os grupos e copie o ID do grupo desejado (termina em `@g.us`) para `WHATSAPP_GROUP_JID`.
6. Rode `npm run whatsapp:webhook`. No Docker Desktop para Windows, a Evolution acessa o serviço no host por `host.docker.internal`. O comando configura apenas `MESSAGES_UPSERT`, com base64 no webhook desativado. Se sua instalação usa outra rede, configure `WHATSAPP_WEBHOOK_URL` com um endereço que o container alcança.
7. Rode `npm run whatsapp:assistant` e mantenha o processo aberto enquanto quiser receber mensagens. O comando antigo `npm run whatsapp:food` também funciona. Se alterar a porta ou o segredo, execute `npm run whatsapp:webhook` novamente.

A instância da Evolution deve estar conectada e acessível antes dos passos 5 e 6. O comando de webhook substitui a configuração de webhook **dessa instância**; use uma instância própria para a integração se outras automações já dependem dela. Se mensagens deixarem de chegar após reiniciar a Evolution, confira o webhook e rode o passo 6 de novo.

## Uso no grupo

- Envie uma foto do prato ou da tabela nutricional. O agente sugere as gramas de cada alimento visível na foto. Pode escrever na legenda a refeição e o peso que consumiu, por exemplo `Almoço, 180 g`.
- Confira a prévia: ela identifica quando as gramas foram estimadas pela foto, informadas na legenda ou retiradas da porção do rótulo. Para ajustar só um item, envie `PORCAO 2 150` (item 2, 150 g); `PORCAO 150, 80` ajusta todos os itens de uma vez. Use `REFEICAO Almoço` para mudar a refeição.
- Para guardar um alimento no catálogo pessoal, envie `CADASTRAR 2` na prévia (ou `CADASTRAR 1, 3` para vários). O comando marca ou desmarca os itens; `CADASTRAR NENHUM` limpa a seleção. `CONFIRMAR` registra a refeição e os alimentos marcados. `SALVAR ALIMENTOS` guarda só os marcados, sem registrar refeição. `CANCELAR` descarta a prévia. Um alimento já existente com o mesmo nome não é duplicado.
- As gramas estimadas pela foto são aproximadas e podem variar muito sem referência de escala. A porção do rótulo não confirma quanto você consumiu. Confira os itens e as quantidades antes de enviar `CONFIRMAR`.
- Se o agente não tiver valores nutricionais suficientes para algum item, ele o exclui da prévia e avisa.

### Finanças

- Envie um gasto ou renda em texto, por exemplo `Gastei R$ 6,19 com Uber` ou `Recebi R$ 200 de freela na Conta Nubank`. Se você não disser que foi no cartão, o agente usa sua única conta corrente automaticamente. Escreva `no cartão` ou `no crédito` quando quiser lançar na fatura. Vários lançamentos na mesma mensagem geram itens separados. O agente usa as categorias ativas do app; a prévia mostra valor, categoria, conta e data.
- Confira a prévia e responda `CONFIRMAR` para gravar ou `CANCELAR` para descartar. Se a categoria não for identificada, diga o nome dela, por exemplo `Transporte`. Também é possível corrigir `CATEGORIA 1 Transporte`, `VALOR 1 6,19` e `DATA 1 25/10/2026`. A prévia anterior só é substituída depois de confirmar ou cancelar.
- Compras no cartão ficam pendentes na fatura calculada a partir do fechamento e vencimento cadastrados. Se informar parcelas, o valor total é dividido entre as faturas. Gastos de conta ou débito ficam pagos. Lançamentos semelhantes já existentes geram um aviso; `CONFIRMAR MESMO ASSIM` permite uma compra distinta com os mesmos dados.
- Pergunte `Como estou este mês?` ou `Quanto gastei com delivery em outubro?` para consultar os lançamentos em Finanças. Os percentuais de Necessidades, Desejos e Poupança usam a renda registrada no mês; sem renda, o assistente mostra os valores e pede esse registro. O grupo não edita planilhas: os dados vão para o Supabase do app.

O serviço guarda apenas a prévia pendente e IDs recentes de mensagens em `scripts/whatsapp-food/state.json`, ignorado pelo Git. Não guarda as fotos. A prévia expira após aproximadamente 48 horas. Para remover dados locais pendentes, pare o serviço e apague `state.json`.

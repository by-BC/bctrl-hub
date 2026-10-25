# Foto de alimento pelo WhatsApp

Este serviço roda no computador junto da Evolution API. Ele aceita apenas mensagens **enviadas pela própria conta conectada** (`fromMe`) dentro do grupo configurado. A foto é analisada, a prévia é enviada ao grupo e os itens são gravados em `meal_log_items` somente após `CONFIRMAR`. O registro da refeição é preservado se já existir; se ainda não existir, é criado dentro do plano, como o complemento adicionado pelo app.

## Preparação

1. Se a Evolution ainda não estiver instalada, execute `node infra/evolution/init.mjs` para gerar os dois arquivos privados de configuração. Depois rode `docker compose --env-file infra/evolution/.env -f infra/evolution/compose.yaml up -d`. A interface da API fica em `http://localhost:8080/manager`. Crie uma instância WhatsApp Baileys chamada `bctrl-hub` e leia o QR Code em **WhatsApp → Aparelhos conectados**. Use a chave `EVOLUTION_API_KEY` do arquivo local para entrar no Manager.
2. Conecte seu WhatsApp a uma instância da Evolution API e crie um grupo somente com você. Se precisar criar o grupo com outra pessoa inicialmente, remova-a antes de usar este serviço.
3. Copie `scripts/whatsapp-food/env.example` para `.env.whatsapp.local` na raiz do projeto. Preencha os campos. Use uma chave aleatória longa em `WHATSAPP_WEBHOOK_SECRET`. O arquivo local é ignorado pelo Git.
4. `EVOLUTION_URL` é o endereço acessível **pelo computador**, normalmente `http://localhost:8080`. `SUPABASE_URL` é a URL do projeto Supabase usado pelo app. `SUPABASE_SECRET_KEY` deve ser uma chave de servidor do mesmo projeto; nunca use a chave pública ou coloque essa chave no navegador. `BCTRL_USER_ID` é o UUID da sua conta em Supabase Auth → Users.
5. Rode `npm run whatsapp:groups` para listar os grupos e copie o ID do grupo desejado (termina em `@g.us`) para `WHATSAPP_GROUP_JID`.
6. Rode `npm run whatsapp:webhook`. No Docker Desktop para Windows, a Evolution acessa o serviço no host por `host.docker.internal`. O comando configura apenas `MESSAGES_UPSERT`, com base64 no webhook desativado. Se sua instalação usa outra rede, configure `WHATSAPP_WEBHOOK_URL` com um endereço que o container alcança.
7. Rode `npm run whatsapp:food` e mantenha o processo aberto enquanto quiser receber fotos. Se alterar a porta ou o segredo, execute `npm run whatsapp:webhook` novamente.

A instância da Evolution deve estar conectada e acessível antes dos passos 5 e 6. O comando de webhook substitui a configuração de webhook **dessa instância**; use uma instância própria para a integração se outras automações já dependem dela. Se mensagens deixarem de chegar após reiniciar a Evolution, confira o webhook e rode o passo 6 de novo.

## Uso no grupo

- Envie uma foto do prato ou da tabela nutricional. Pode escrever na legenda a refeição e o peso que consumiu, por exemplo `Almoço, 180 g`.
- Confira a prévia. Para ajustar: `PORCAO 150` (ou `PORCAO 150, 80` se houver dois alimentos), `REFEICAO Almoço`, `CONFIRMAR` ou `CANCELAR`.
- Os números extraídos de uma tabela precisam estar legíveis. Os números de um prato fotografado são estimativas; confirme o alimento e a quantidade antes de gravar.

O serviço guarda apenas a prévia pendente e IDs recentes de mensagens em `scripts/whatsapp-food/state.json`, ignorado pelo Git. Não guarda as fotos. A prévia expira após aproximadamente 48 horas. Para remover dados locais pendentes, pare o serviço e apague `state.json`.

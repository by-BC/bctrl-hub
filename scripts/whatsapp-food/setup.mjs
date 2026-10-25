const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} em .env.whatsapp.local.`);
  return value;
};

const url = required("EVOLUTION_URL").replace(/\/$/, "");
const instance = encodeURIComponent(required("EVOLUTION_INSTANCE"));
const apikey = required("EVOLUTION_API_KEY");
const command = process.argv[2];

if (command === "groups") {
  const response = await fetch(`${url}/group/fetchAllGroups/${instance}?getParticipants=false`, { headers: { apikey } });
  if (!response.ok) throw new Error(`Não foi possível listar grupos: HTTP ${response.status}`);
  const groups = await response.json();
  if (!Array.isArray(groups)) throw new Error("A Evolution não retornou uma lista de grupos.");
  for (const group of groups) console.log(`${group.subject ?? "(sem nome)"}\t${group.id}`);
} else if (command === "webhook") {
  const secret = required("WHATSAPP_WEBHOOK_SECRET");
  if (!/^[A-Za-z0-9_-]{24,}$/.test(secret)) throw new Error("WHATSAPP_WEBHOOK_SECRET deve ter pelo menos 24 caracteres alfanuméricos.");
  const port = Number(process.env.WHATSAPP_FOOD_PORT || 8787);
  const target = process.env.WHATSAPP_WEBHOOK_URL || `http://host.docker.internal:${port}/webhook/${secret}`;
  const response = await fetch(`${url}/webhook/set/${instance}`, {
    method: "POST",
    headers: { apikey, "Content-Type": "application/json" },
    body: JSON.stringify({ webhook: { enabled: true, url: target, webhookByEvents: false, webhookBase64: false, events: ["MESSAGES_UPSERT"] } }),
  });
  if (!response.ok) throw new Error(`Não foi possível configurar o webhook: HTTP ${response.status}. Confira a versão da Evolution e os campos de webhook.`);
  console.log("Webhook MESSAGES_UPSERT configurado para o serviço local.");
} else {
  throw new Error("Use groups ou webhook.");
}

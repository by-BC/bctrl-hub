import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const evolutionEnvPath = new URL("./.env", import.meta.url);
const assistantEnvPath = new URL("../../.env.whatsapp.local", import.meta.url);
const randomSecret = () => randomBytes(32).toString("hex");
const maybeRead = async (path) => {
  try { return await readFile(path, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
};
const parse = (value) => Object.fromEntries(value.split(/\r?\n/).filter((line) => /^[A-Z_]+=.*/.test(line)).map((line) => {
  const at = line.indexOf("=");
  return [line.slice(0, at), line.slice(at + 1)];
}));

let evolutionEnv = await maybeRead(evolutionEnvPath);
if (!evolutionEnv) {
  evolutionEnv = `POSTGRES_PASSWORD=${randomSecret()}\nEVOLUTION_API_KEY=${randomSecret()}\n`;
  await writeFile(evolutionEnvPath, evolutionEnv, { mode: 0o600, flag: "wx" });
  console.log("Configuração privada da Evolution criada.");
}
const values = parse(evolutionEnv);
if (!values.EVOLUTION_API_KEY || !values.POSTGRES_PASSWORD) throw new Error("Confira infra/evolution/.env.");

if (!(await maybeRead(assistantEnvPath))) {
  const appEnv = parse((await maybeRead(new URL("../../.env.local", import.meta.url))) ?? "");
  const content = [
    "EVOLUTION_URL=http://localhost:8080",
    "EVOLUTION_INSTANCE=bctrl-hub",
    `EVOLUTION_API_KEY=${values.EVOLUTION_API_KEY}`,
    "WHATSAPP_GROUP_JID=",
    `WHATSAPP_WEBHOOK_SECRET=${randomSecret()}`,
    "WHATSAPP_FOOD_PORT=8787",
    `SUPABASE_URL=${appEnv.NEXT_PUBLIC_SUPABASE_URL ?? ""}`,
    "SUPABASE_SECRET_KEY=",
    "BCTRL_USER_ID=",
    "",
  ].join("\n");
  await writeFile(assistantEnvPath, content, { mode: 0o600, flag: "wx" });
  console.log("Configuração privada do assistente criada com campos pendentes.");
}

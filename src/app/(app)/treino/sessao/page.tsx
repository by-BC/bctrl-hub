import type { Metadata } from "next";
import { SessionView } from "@/features/workout-session/components/session-view";

export const metadata: Metadata = { title: "Sessão" };

// A sessão vive no aparelho (localStorage): tudo é lido no cliente, o shell continua estático.
export default function TreinoSessaoPage() {
  return <SessionView />;
}

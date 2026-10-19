import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, exceto:
     * - _next/static, _next/image (arquivos do Next)
     * - ícones e imagens (favicon, /brand, svg, png, jpg…)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

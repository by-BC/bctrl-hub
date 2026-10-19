import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "@/app/login/login-error";
import { isPublicPath } from "@/lib/supabase/proxy";

describe("isPublicPath", () => {
  it("libera só login e auth", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("protege todas as telas do app", () => {
    for (const path of ["/", "/treino", "/treino/sessao", "/comida", "/habitos", "/tarefas", "/evolucao"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("não libera rotas que só começam parecido", () => {
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/authors")).toBe(false);
  });
});

describe("loginErrorMessage", () => {
  it("credenciais inválidas", () => {
    expect(loginErrorMessage({ code: "invalid_credentials", status: 400 })).toBe("E-mail ou senha incorretos.");
  });

  it("limite de tentativas", () => {
    expect(loginErrorMessage({ code: "over_request_rate_limit", status: 429 })).toMatch(/Muitas tentativas/);
  });

  it("sem conexão", () => {
    expect(loginErrorMessage({ status: 0, message: "Failed to fetch" })).toMatch(/Sem conexão/);
  });

  it("erro desconhecido tem mensagem genérica", () => {
    expect(loginErrorMessage({ code: "unexpected", status: 500 })).toBe("Não foi possível entrar. Tente de novo.");
  });
});

type AuthErrorLike = { code?: string; status?: number; message?: string };

/** Traduz erros do Supabase Auth para mensagens curtas em pt-BR. */
export function loginErrorMessage(error: AuthErrorLike): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  }
  if (error.status === 0 || error.message?.toLowerCase().includes("fetch")) {
    return "Sem conexão com o servidor. Verifique sua internet.";
  }
  return "Não foi possível entrar. Tente de novo.";
}

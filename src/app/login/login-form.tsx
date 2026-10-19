"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginErrorMessage } from "./login-error";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      setError(null);
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) {
        setError(loginErrorMessage(error));
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="h-12 text-base"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 text-base"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      <p id="login-error" role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {error}
      </p>

      <Button type="submit" size="lg" className="h-12 w-full text-base font-semibold" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

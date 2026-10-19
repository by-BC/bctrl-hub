import type { Metadata } from "next";
import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-6 py-12">
      {/* Símbolo gigante cortado na borda: assinatura visual da marca */}
      <BrandSymbol
        aria-hidden
        title=""
        className="pointer-events-none absolute -right-24 -bottom-20 size-[22rem] text-foreground opacity-[0.07] sm:size-[30rem]"
      />

      <div className="relative mx-auto w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <BrandSymbol className="size-12" title="" aria-hidden />
          <div>
            <h1>
              <BrandWordmark className="text-3xl" />
            </h1>
            <p className="num mt-1 text-xs tracking-[0.3em] text-muted-foreground uppercase">Be in control.</p>
          </div>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}

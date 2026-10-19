"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export const THEME_STORAGE_KEY = "bctrl.theme";

// Escuro é o padrão (uso na academia); claro disponível pelo toggle.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

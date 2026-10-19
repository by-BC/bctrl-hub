import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // O indicador de dev fica sobre a barra inferior no celular; erros continuam aparecendo.
  devIndicators: false,
  turbopack: {
    // Existe um package-lock.json em C:\Users\bruno; fixa a raiz no projeto.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

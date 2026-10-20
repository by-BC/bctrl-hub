/**
 * Mapa `id → { pt_br_title, media_url }` do catálogo embutido no site do Hevy.
 *
 * Nome em PT e vídeo não vêm na API: estão no bundle `pages/_app-*.js` de hevy.com como
 * objetos `{"id":"3BC06AD3","title":…,"pt_br_title":…,"url":"…/exercise-assets/….mp4",…}`.
 * Leitura única, com a sessão do dono no Chrome (só leitura), no console de
 * https://hevy.com/exercise:
 *
 *   const src = [...document.scripts].map((s) => s.src).find((s) => /pages\/_app-/.test(s));
 *   const bundle = await fetch(src).then((r) => r.text());
 *   // cole `extractCatalogPt` (abaixo, sem os tipos) e rode:
 *   copy(JSON.stringify(extractCatalogPt(bundle)));
 *
 * Salve o resultado em `scripts/hevy/data/catalog-pt.json` (fora do Git). Só o nome em PT e
 * o link do vídeo são guardados: `localised_instructions` (texto do Hevy) é descartado e
 * nenhuma mídia é baixada.
 */

export type CatalogPt = Record<string, { pt_br_title: string | null; media_url: string | null }>;

/** Trecho `{…}` balanceado a partir de `start`, respeitando strings. */
function balanced(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/** Desfaz os escapes de string JS (o bundle usa `\xE1` etc., que não é JSON válido). */
function unescapeJs(s: string): string {
  return s.replace(/\\(x([0-9a-fA-F]{2})|u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|([\s\S]))/g, (_m, _all, x, cp, u, other: string) => {
    if (x) return String.fromCharCode(parseInt(x, 16));
    if (cp) return String.fromCodePoint(parseInt(cp, 16));
    if (u) return String.fromCharCode(parseInt(u, 16));
    return ({ n: "\n", t: "\t", r: "\r" } as Record<string, string>)[other] ?? other;
  });
}

function field(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? unescapeJs(m[1]) : null;
}

export function extractCatalogPt(bundle: string): CatalogPt {
  const out: CatalogPt = {};
  const start = /\{"id":"[0-9A-F]{8}"/g;
  for (let m = start.exec(bundle); m; m = start.exec(bundle)) {
    let raw = balanced(bundle, m.index);
    if (!raw) continue;
    // Fora o texto de instruções do Hevy (e qualquer "url" dentro dele).
    const key = '"localised_instructions":';
    const at = raw.indexOf(key + "{");
    if (at >= 0) {
      const inner = balanced(raw, at + key.length) ?? "";
      raw = raw.slice(0, at) + raw.slice(at + key.length + inner.length);
    }
    const id = field(raw, "id")!;
    const url = field(raw, "url");
    out[id] = { pt_br_title: field(raw, "pt_br_title"), media_url: url && url.startsWith("https://") ? url : null };
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

import { describe, expect, it } from "vitest";
import { extractCatalogPt } from "../../scripts/hevy/catalog-pt";

// Trecho sintético no formato do bundle do hevy.com (escapes JS, instruções aninhadas).
const bundle = [
  'var x={a:1};const lib=[',
  '{"id":"3BC06AD3","title":"21s Bicep Curl","priority":1,"url":"https://cdn.example.test/a.mp4","media_type":"video",',
  '"localised_instructions":{"en":{"url":"https://nao-pegar.test/x","text":"Step 1\\. curl"},"pt":"Passo"},',
  '"pt_br_title":"Rosca 21","is_custom":false},',
  '{"id":"0222DB42","title":"Rowing Machine","url":"https://cdn.example.test/b.mp4","pt_br_title":"M\\xe1quina de Remo"},',
  '{"id":"911A58D3","title":"Snowboarding","pt_br_title":"Snowboard","url":null}',
  "];",
].join("");

describe("extractCatalogPt", () => {
  it("extrai só nome em PT e link do vídeo, sem as instruções do Hevy", () => {
    expect(extractCatalogPt(bundle)).toEqual({
      "0222DB42": { pt_br_title: "Máquina de Remo", media_url: "https://cdn.example.test/b.mp4" },
      "3BC06AD3": { pt_br_title: "Rosca 21", media_url: "https://cdn.example.test/a.mp4" },
      "911A58D3": { pt_br_title: "Snowboard", media_url: null },
    });
  });
});

# Tarefa 9.0: Story Studio

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

A vitrine da marca: a partir de um treino finalizado, gerar uma imagem 1080×1920 para o story do Instagram em 4 layouts inovadores, escolhidos por deslize, exportada no navegador e compartilhada pelo menu nativo do celular. O visual deve parecer design autoral, não um print de app.

**Processo obrigatório: TDD (red-green-refactor)** para `src/lib/domain/story.ts` e para a lógica de exportação e compartilhamento. Para o visual, usar a skill `impeccable` (design) ao criar os layouts.

**Depende de:** 4.0 e 8.0 (`HexProgress`, `week_summary`).

<requirements>
- RF19 a RF22
- Rota `/treino/historico/[id]/story` e atalho no `FinishSheet` ("Gerar story")
- `StoryData` montado por `buildStoryData(workout, weekSummary)` (função pura)
- 4 layouts como componentes React em 1080×1920:
  - **Recibo**: cupom fiscal em IBM Plex Mono, uma linha por série, total = volume, PRs em destaque, picote e código de barras decorativo com a data
  - **Hex Week**: `HexProgress` gigante com o treino do dia no centro
  - **Blueprint**: grade técnica em fundo ultramarino, números grandes
  - **Foto + overlay**: foto da câmera ou galeria como fundo, dados em faixa grafite/laranja
- Áreas seguras: nada essencial nos 250 px do topo e da base
- Pré-visualização escalada para caber na tela; carrossel com swipe e botões (acessível por teclado)
- Exportar com `html-to-image`: aguardar `document.fonts.ready`, foto pré-carregada como `dataURL`, captura de aquecimento descartada (aprendizados da POC 1.10)
- Compartilhar com `navigator.share({ files })` quando `canShare` aceitar arquivos; caso contrário, download do PNG
- A foto nunca é enviada ao servidor
</requirements>

## Subtarefas

- [x] 9.1 (RED) Testes de `buildStoryData`: melhor série por exercício, volume total, PRs, arredondamento, treino sem PR, treino com muitos exercícios (truncar com "+N")
- [x] 9.2 (GREEN/REFACTOR) Implementar `src/lib/domain/story.ts`
- [x] 9.3 (RED) Testes de `exportStory` e `shareOrDownload` com `navigator.share`/`canShare` simulados (com e sem suporte a arquivos)
- [x] 9.4 (GREEN/REFACTOR) Implementar a exportação e o compartilhamento
- [x] 9.5 Criar o `StoryFrame` (1080×1920 com guias de área segura no modo dev) e o `StoryStudio` (carrossel, pré-visualização escalada, botões)
- [x] 9.6 Layout Recibo
- [x] 9.7 Layout Hex Week
- [x] 9.8 Layout Blueprint
- [x] 9.9 Layout Foto + overlay com captura (`<input type="file" accept="image/*" capture>`) e ajuste de enquadramento
- [ ] 9.10 Testar em iPhone e Android reais e anotar as limitações no `CLAUDE.md` — **pendente**: teste do dono em aparelho real (iPhone: 4 layouts, menu nativo, Instagram)
- [x] 9.11 Escrever e rodar os testes de integração e E2E

## Detalhes de Implementação

Ver techspec: tipo `StoryData` e `StoryLayout` em **Interfaces Principais**; compartilhamento em **Pontos de Integração**; decisão "Story no cliente" em **Decisões Principais**; riscos do Safari em **Riscos Conhecidos**.

## Critérios de Sucesso

- Cada um dos 4 layouts exporta um PNG de exatamente 1080×1920
- As fontes Sora e IBM Plex Mono aparecem corretas no PNG no iPhone (sem fallback)
- No celular, "Compartilhar" abre o menu nativo com a opção Instagram; no desktop, baixa o arquivo
- Nenhuma requisição de rede envia a foto (verificável no DevTools)
- Textos dentro das áreas seguras em todos os layouts

## Testes da Tarefa

- [x] Testes de unidade: `buildStoryData` (casos da 9.1); `shareOrDownload` (com share, sem share, share cancelado pelo usuário não gera erro)
- [x] Testes de integração: Playwright abre o story de um treino semeado, percorre os 4 layouts, exporta cada um e valida as dimensões do PNG baixado; layout Foto + overlay com imagem de teste (`setInputFiles`) sem nenhuma requisição de upload

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/lib/domain/story.ts`
- `src/features/story/{types.ts,StoryStudio.tsx,StoryFrame.tsx,export.ts}`
- `src/features/story/layouts/{Receipt,HexWeek,Blueprint,PhotoOverlay}.tsx`
- `src/app/(app)/treino/historico/[id]/story/page.tsx`
- `src/components/shell/HexProgress.tsx` (reuso)
- `tests/unit/story.test.ts`, `tests/unit/share.test.ts`, `tests/e2e/story.spec.ts`

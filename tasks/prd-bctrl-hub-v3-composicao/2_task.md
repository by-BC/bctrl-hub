# Tarefa 2.0: Importação da planilha da balança

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>HIGH</complexity>

Script local e único (`scripts/scale/`) que lê o `.xlsx` exportado do app da balança. Ele gera um relatório para o dono revisar e um SQL privado idempotente com as medições, que o dono aplica no Supabase remoto. Pelo trigger da 1.0, o peso de cada dia importado vai também para a Evolução.

**Processo obrigatório: TDD** para `scripts/scale/parse.ts`, com uma planilha **fictícia** gerada no próprio teste pelo `exceljs`.

**Depende de:** 1.0.

<requirements>
- PRD RF01–RF05; techspec **Pontos de Integração → Planilha da balança**
- `exceljs` como `devDependency`; nunca usar o pacote `xlsx` do npm
- Parser:
  - acha a linha de cabeçalho pelo texto "Data";
  - mapeia as colunas pelo **nome** (PT) para as chaves de `composition.ts`;
  - lê sexo, idade e altura da linha com `：` (dois-pontos de largura total);
  - converte `dd/mm/aaaa` + `HH:mm` (America/Sao_Paulo) para `measured_at` e `day`;
  - números em texto com ponto decimal; vazio ou "--" viram `null`;
  - coluna desconhecida vai para o relatório;
  - linha sem data, hora ou peso válido é ignorada, com o motivo;
  - valor fora da faixa de `composition.ts` vira `null`, com aviso no relatório (a medição continua)
- `npm run import:scale -- <arquivo.xlsx>`:
  - dry-run (padrão) gera `scripts/scale/out/report.md` (lidas, importadas, ignoradas com motivo, período, métricas presentes);
  - `--write` gera `supabase/scale.private.sql` (`insert … on conflict (user_id, measured_at) do update`, `source = 'import'`, dono resolvido por e-mail como nos outros SQLs privados)
- `.gitignore`: `scripts/scale/out/` (`supabase/*.private.sql` já coberto). A planilha real fica fora do repositório; nenhum valor real em fixture ou teste
- **Parada obrigatória:** depois do dry-run real (arquivo em `C:\Users\bruno\Downloads\weight_Bruno_*.xlsx`), parar para o dono revisar. A aplicação no remoto (`npx supabase db query --linked -f supabase/scale.private.sql`) é feita **pelo dono**
</requirements>

## Subtarefas

- [ ] 2.1 `.gitignore`, estrutura de `scripts/scale/` e script `import:scale` (`tsx`)
- [ ] 2.2 (RED) Testes de `parse.ts` com planilha fictícia (cabeçalho, mapeamento por nome, `：`, números em texto, vazios, "--", linha inválida, fora de faixa) e de `toSql` (determinístico)
- [ ] 2.3 (GREEN) `parse.ts` e `run.ts` com o relatório
- [ ] 2.4 Teste de integração: SQL da planilha fictícia aplicado 2 vezes no Supabase local, sem duplicar, e o trigger preenchendo `body_weights`
- [ ] 2.5 Dry-run real; **parar para o dono revisar o `report.md`**
- [ ] 2.6 Após a aprovação: `--write`; o dono aplica; verificar no remoto as contagens de `body_measurements` e os dias com `body_weights.source = 'scale'`

## Detalhes de Implementação

Ver techspec: **Visão Geral → Importação**, **Interfaces Principais** (`scripts/scale/parse.ts`), **Pontos de Integração** e **Monitoramento**.

## Critérios de Sucesso

- O dry-run real lê todas as medições da planilha e relata o período e as métricas presentes, sem linhas ignoradas sem motivo
- Aplicar o SQL duas vezes não muda as contagens
- Depois da aplicação, cada dia com medição tem peso em `body_weights` com `source = 'scale'`
- Nenhum dado real no Git

## Testes da Tarefa

- [ ] Testes de unidade: `parse.ts` e `toSql` com a planilha fictícia
- [ ] Testes de integração: aplicação idempotente no Supabase local e o efeito do trigger

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `scripts/scale/{parse,run}.ts`, `scripts/scale/out/` (ignorado)
- `supabase/scale.private.sql` (ignorado)
- `tests/unit/scale-parse.test.ts`, `tests/integration/scale-import.test.ts`
- `.gitignore`, `package.json`

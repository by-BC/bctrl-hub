# Tarefa 4.0: TACO e macros do plano alimentar

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

Carregar a tabela TACO (597 alimentos) no banco e vincular cada item do plano alimentar a um alimento com gramas. Assim, cada opção de refeição mostra kcal, proteína, carboidrato e gordura. Itens sem correspondência ficam sinalizados e o dono vincula ou ajusta no editor do plano.

**Depende de:** 1.0. **Pode correr em paralelo com:** 2.0 e 3.0 (recomendado em sequência, por causa da memória da máquina).

<requirements>
- PRD RF21–RF23; techspec **Modelos de Dados** (`foods`, `meal_options.items` com `food_id`, `grams`, `macros_override`, `free`)
- Script que converte `TACO.json` de `marcelosanto/tabela_taco` (MIT) em migration `…_foods_taco.sql` (dado público, versionável) com kcal, proteína, carboidrato e gordura por 100 g; valores "NA" ou "Tr" viram 0
- `src/lib/domain/nutrition.ts`: `itemMacros` e `optionMacros` (com `unresolved`); itens "à vontade" valem 0 kcal com `free: true`
- Auto-vínculo dos itens do plano real por nome normalizado, com gramas extraídas da quantidade ("4 un (200 g)" → 200), gerando `supabase/meal-items.private.sql` (ignorado); relatório dos não resolvidos para o dono revisar antes de aplicar no remoto
- Editor `/comida/plano`: por item, buscar e trocar o alimento da TACO, editar gramas e sobrescrever macros
- `/comida`: kcal e macros de cada opção no sheet e no card da refeição marcada; aviso "N itens sem valor"
- Citar a fonte TACO (NEPA/Unicamp) no rodapé da busca
</requirements>

## Subtarefas

- [x] 4.1 Script de conversão da TACO e migration `…_foods_taco.sql` (aplicar local e remoto) — aplicada no local e no remoto (`db push`), 597 alimentos
- [x] 4.2 `nutrition.ts` (`itemMacros`, `optionMacros`, parsing de gramas) com testes
- [x] 4.3 Hooks `useFoods` (busca com cache) e mutações do plano com os campos novos
- [ ] 4.4 Auto-vínculo dos itens do plano real + relatório; **parar para o dono revisar**; aplicar no remoto — script, relatório e `supabase/meal-items.private.sql` prontos e validados no local (usuário descartável, 2 aplicações). **Pendente com o dono:** revisar `scripts/meals/out/report.md` e aplicar com `npx supabase db query --linked -f supabase/meal-items.private.sql`
- [x] 4.5 Editor de vínculo no `/comida/plano`
- [x] 4.6 Macros por opção em `/comida`
- [x] 4.7 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Modelos de Dados**, **Interfaces Principais** (`nutrition.ts`), **Pontos de Integração → TACO** e **Decisões Principais**.

## Critérios de Sucesso

- `foods` tem 597 alimentos TACO com `user_id` nulo
- Exemplo verificável: "Arroz, integral, cozido" 150 g ≈ 185 kcal / 3,9 g P / 38,7 g C / 1,5 g G
- Toda opção do plano mostra macros ou um aviso explícito de itens sem valor
- Dados do plano real nunca vão para o Git

## Testes da Tarefa

- [x] Testes de unidade: `itemMacros` (gramas, unidade, override, "à vontade", sem alimento); parsing de quantidade ("1 fatia média (170 g)", "à vontade", "5 ml (5g)"); `optionMacros` com `unresolved`
- [x] Testes de integração: busca na TACO via RLS (usuário comum lê); E2E vincula um item no editor e vê os macros da opção mudarem em `/comida`

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `scripts/taco/convert.ts`, `supabase/migrations/…_foods_taco.sql`
- `scripts/meals/link-foods.ts`, `supabase/meal-items.private.sql` (ignorado)
- `src/lib/domain/nutrition.ts`, `src/features/nutrition/*`, `src/features/meals/*`
- `tests/unit/nutrition.test.ts`, `tests/e2e/nutrition-plan.spec.ts`

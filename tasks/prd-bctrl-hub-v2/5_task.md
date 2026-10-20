# Tarefa 5.0: Perfil, metas nutricionais e fora do plano

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se você não ler esses arquivos sua tarefa será invalidada</critical>

## Visão Geral

<complexity>MEDIUM</complexity>

O dono informa os dados corporais e o objetivo e recebe metas diárias de kcal e macros calculadas, com ajuste manual e meta opcional para dia de treino. Comida e Hoje passam a mostrar **consumido × meta**. Na refeição "fora do plano", ele adiciona alimentos da TACO com quantidade, e isso entra no total do dia, inclusive sem sinal.

**Depende de:** 4.0.

<requirements>
- PRD RF18–RF20, RF24, RF25; techspec **Modelos de Dados** (`profiles`, `meal_log_items` com snapshot de macros) e **Metas padrão**
- `goalsFromProfile`: Mifflin-St Jeor × fator de atividade; −20%/0/+10% por objetivo; proteína `protein_g_per_kg × peso`; gordura 0,8 g/kg (mínimo de 20% das kcal); carboidrato = resto; +10% de carboidrato em dia de treino (sem override). O peso é o último `body_weights`
- Formulário de perfil (sexo, nascimento, altura, atividade, objetivo, g de proteína por kg) mostrando a conta ("TMB 1.780 × 1,55 …") e os campos de override por macro (dia normal / dia de treino)
- `dayTotals`: opções marcadas + itens fora do plano; `NutritionBars` com consumido, meta, faltando ou excedente (texto + ícone, não só cor), números em `num`
- `OffPlanSheet` + `FoodSearch` (TACO e alimentos próprios; gramas, ml ou unidade com peso de referência); adicionar em ≤ 4 toques; grava `meal_log_items` com snapshot
- Mutações novas registradas no `setMutationDefaults` da fila offline (v1, task 10.0)
- Perfil provisório numa rota simples (`/perfil/dados`); a tela completa de Perfil é da 7.0
</requirements>

## Subtarefas

- [x] 5.1 `goalsFromProfile` e `dayTotals` com testes (2 perfis calculados à mão)
- [x] 5.2 Hooks e mutações de `profiles` e `meal_log_items` (+ mutation defaults offline)
- [x] 5.3 Formulário de dados e metas (`/perfil/dados`)
- [x] 5.4 `NutritionBars` em `/comida` e no painel Hoje
- [x] 5.5 `FoodSearch` + `OffPlanSheet` na refeição fora do plano
- [x] 5.6 Escrever e rodar os testes da tarefa

## Detalhes de Implementação

Ver techspec: **Interfaces Principais** (`nutrition.ts`), **Modelos de Dados** (`profiles`, `meal_log_items`, metas padrão) e **Decisões Principais** (snapshot de macros).

## Critérios de Sucesso

- Perfil de exemplo (m, 30 anos, 180 cm, 80 kg, moderado, manter) gera metas iguais ao cálculo manual documentado no teste
- Adicionar "Arroz, integral, cozido" 150 g fora do plano soma ≈ 185 kcal ao dia
- Editar o alimento depois não altera o total do dia já registrado
- Registrar fora do plano offline sincroniza ao voltar a rede

## Testes da Tarefa

- [x] Testes de unidade: `goalsFromProfile` (2 perfis, objetivos, dia de treino, overrides); `dayTotals`; `NutritionBars` (faltando e excedente com texto)
- [x] Testes de integração: RLS de `profiles` e `meal_log_items`; E2E salva o perfil e vê as metas, marca uma opção e adiciona alimento fora do plano (barras avançam), e o mesmo fluxo offline sincroniza

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERÁ-LA FINALIZADA</critical>

## Arquivos relevantes
- `src/lib/domain/nutrition.ts`, `src/features/nutrition/*`, `src/features/meals/*`, `src/features/today/*`
- `src/app/(app)/perfil/dados/page.tsx`
- `src/lib/query/mutation-defaults.ts`
- `tests/unit/goals.test.ts`, `tests/e2e/nutrition-goals.spec.ts`

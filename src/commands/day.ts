import type { Command } from "commander";
import { getClient } from "../client.js";
import { formatDate, formatDateLong, formatDateLongRu } from "../utils/dates.js";
import type { CommonOptions } from "../types.js";
import { getPortionWeight } from "../utils/portionCount.js";
import { resolveProductAmountDisplay } from "../utils/productDisplay.js";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

function pct(value: number, goal: number): string {
  if (!goal || goal <= 0) return "-";
  return `${Math.round((value / goal) * 100)}%`;
}

export function registerDayCommand(program: Command) {
  program
    .command("day")
    .description(
      "Daily nutrition summary for a specific day (calories, macros, steps, weight, meals)",
    )
    .option("--date <date>", "Date (YYYY-MM-DD), default: today", "")
    .option("--format <format>", "Output format: text, json", "text")
    .action(
      async (opts: CommonOptions & { date?: string }, command: Command) => {
        const client = getClient(command.parent?.opts() ?? {});
        const dateStr = opts.date || formatDate(new Date());
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.error("Error: Invalid date. Use YYYY-MM-DD.");
          process.exit(1);
        }
        const dateKey = formatDate(date);

        try {
          const [summary, items, weightResp, goals] = await Promise.all([
            client.user.getDailySummary({ date }) as Promise<any>,
            client.user.getConsumedItems({ date: dateKey }) as Promise<any>,
            client.user.getWeight({ date }) as Promise<{
              value: number | null;
              date: string;
            } | null>,
            client.user.getGoals({ date }) as Promise<any>,
          ]);

          const goalsData = goals ?? summary?.goals ?? {};
          const goalCal = goalsData["energy.energy"] ?? 0;
          const goalProtein = goalsData["nutrient.protein"] ?? 0;
          const goalCarbs = goalsData["nutrient.carb"] ?? 0;
          const goalFat = goalsData["nutrient.fat"] ?? 0;
          const goalSteps = goalsData["activity.step"] ?? 0;
          const goalWeight = goalsData["bodyvalue.weight"] ?? null;

          const sumNutrient = (key: string): number => {
            let total = 0;
            for (const mealType of ["breakfast", "lunch", "dinner", "snack"]) {
              total += summary?.meals?.[mealType]?.nutrients?.[key] ?? 0;
            }
            return Math.round(total);
          };

          const calories = sumNutrient("energy.energy");
          const protein = sumNutrient("nutrient.protein");
          const carbs = sumNutrient("nutrient.carb");
          const fat = sumNutrient("nutrient.fat");
          const steps = summary?.steps ?? 0;
          const weightKg =
            weightResp?.value ?? summary?.user?.current_weight ?? null;

          const productNames = new Map<string, string>();
          const productCache = new Map<string, any>();
          const products = (items?.products ?? []) as any[];
          for (const item of products) {
            if (!productNames.has(item.product_id)) {
              try {
                const product = (await client.products.get(
                  item.product_id,
                )) as any;
                productCache.set(item.product_id, product ?? null);
                productNames.set(
                  item.product_id,
                  product?.name ?? item.product_id,
                );
              } catch {
                productCache.set(item.product_id, null);
                productNames.set(item.product_id, item.product_id);
              }
            }
          }

          const byMeal: Record<string, string[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
          };
          for (const item of products) {
            const name = productNames.get(item.product_id) ?? item.product_id;
            const { amountDisplay } = await resolveProductAmountDisplay(
              client,
              productCache,
              {
                product_id: item.product_id,
                amount: item.amount,
                serving: item.serving ?? null,
              },
            );
            byMeal[item.daytime].push(`${name} (${amountDisplay})`);
          }
          for (const item of items?.simple_products ?? []) {
            const name = item.name ?? "—";
            byMeal[item.daytime].push(`${name} (—)`);
          }
          for (const item of items?.recipe_portions ?? []) {
            const recipe = await client.user.getRecipe(item.recipe_id);
            const name = recipe.name ?? "—";
            const daytime = item.daytime;
            const amount = getPortionWeight(item.portion_count, recipe);
            if (daytime && byMeal[daytime])
              byMeal[daytime].push(`${name} (${amount} г)`);
          }

          const mealNutrients = MEAL_ORDER.reduce(
            (acc, meal) => {
              const n = summary?.meals?.[meal]?.nutrients ?? {};
              acc[meal] = {
                calories: Math.round(n["energy.energy"] ?? 0),
                protein: Math.round((n["nutrient.protein"] ?? 0) * 10) / 10,
                carbs: Math.round((n["nutrient.carb"] ?? 0) * 10) / 10,
                fat: Math.round((n["nutrient.fat"] ?? 0) * 10) / 10,
              };
              return acc;
            },
            {} as Record<
              string,
              { calories: number; protein: number; carbs: number; fat: number }
            >,
          );

          if (opts.format === "json") {
            console.log(
              JSON.stringify(
                {
                  date: dateKey,
                  dateLong: formatDateLongRu(date),
                  calories: {
                    value: calories,
                    goal: goalCal,
                    pct: pct(calories, goalCal),
                  },
                  protein: {
                    value: protein,
                    goal: goalProtein,
                    pct: pct(protein, goalProtein),
                  },
                  carbs: {
                    value: carbs,
                    goal: goalCarbs,
                    pct: pct(carbs, goalCarbs),
                  },
                  fat: { value: fat, goal: goalFat, pct: pct(fat, goalFat) },
                  steps: { value: steps, goal: goalSteps },
                  weight_kg: weightKg,
                  goal_weight_kg: goalWeight,
                  meals: byMeal,
                },
                null,
                2,
              ),
            );
            return;
          }

          // Text format (default) — Telegram markup: *bold*, _italic_
          console.log(
            `\n📊 *Сводка питания — ${formatDateLongRu(date)}*\n`,
          );
          console.log(
            `🔥 *Калории:* ${calories} ккал (${pct(calories, goalCal)})`,
          );
          console.log(
            `🍗 *Белки:* ${protein.toFixed(1)} г (${pct(protein, goalProtein)})`,
          );
          console.log(
            `🍞 *Углеводы:* ${carbs.toFixed(1)} г (${pct(carbs, goalCarbs)})`,
          );
          console.log(
            `🥑 *Жиры:* ${fat.toFixed(1)} г (${pct(fat, goalFat)})\n`,
          );
          console.log(`👟 Шаги: ${steps} шагов`);
          if (weightKg != null) {
            const w = Number(weightKg).toFixed(1);
            const goalWeightLine =
              goalWeight != null
                ? ` (цель: ${Number(goalWeight).toFixed(1)} кг)`
                : "";
            console.log(`⚖️ Вес: ${w} кг${goalWeightLine}`);
          }
          console.log("\n🍽 *Приёмы пищи:*");
          for (const mealType of MEAL_ORDER) {
            const lines = byMeal[mealType];
            const label = MEAL_LABELS[mealType] ?? mealType;
            const nutrients = mealNutrients[mealType];
            if (lines.length === 0) continue;
            console.log(
              `• *${label}:* ${lines.join(", ")}`,
            );
            console.log(
              `  _${nutrients.calories} ккал · Б ${Math.round(nutrients.protein)} · У ${Math.round(nutrients.carbs)} · Ж ${Math.round(nutrients.fat)}_`,
            );
          }
          console.log("");
        } catch (err: any) {
          console.error("Failed to fetch day summary:", err.message);
          process.exit(1);
        }
      },
    );
}

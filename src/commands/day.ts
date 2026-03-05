import type { Command } from "commander";
import { getClient } from "../client.js";
import { formatDate, formatDateLong } from "../utils/dates.js";
import type { CommonOptions } from "../types.js";
import { getPortionWeight } from "../utils/portionCount.js";

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
          const products = (items?.products ?? []) as any[];
          for (const item of products) {
            if (!productNames.has(item.product_id)) {
              try {
                const product = (await client.products.get(
                  item.product_id,
                )) as any;
                productNames.set(
                  item.product_id,
                  product?.name ?? item.product_id,
                );
              } catch {
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
            const amount = item.amount != null ? `${item.amount}г` : "-г";
            byMeal[item.daytime].push(`${name} (${amount})`);
          }
          for (const item of items?.simple_products ?? []) {
            const name = item.name ?? "—";
            byMeal[item.daytime].push(`${name} (-г)`);
          }
          for (const item of items?.recipe_portions ?? []) {
            const recipe = await client.user.getRecipe(item.recipe_id);
            const name = recipe.name ?? "—";
            const daytime = item.daytime;
            const amount = getPortionWeight(item.portion_count, recipe);
            if (daytime && byMeal[daytime])
              byMeal[daytime].push(`${name} (${amount}г)`);
          }

          if (opts.format === "json") {
            console.log(
              JSON.stringify(
                {
                  date: dateKey,
                  dateLong: formatDateLong(date),
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

          // Text format (default)
          console.log(`\n📊 Сводка питания — ${formatDateLong(date)}\n`);
          console.log(
            `🔥 Калории: ${calories} ккал (${pct(calories, goalCal)})`,
          );
          console.log(
            `🍗 Белки: ${protein.toFixed(1)} г (${pct(protein, goalProtein)})`,
          );
          console.log(
            `🍞 Углеводы: ${carbs.toFixed(1)} г (${pct(carbs, goalCarbs)})`,
          );
          console.log(`🥑 Жиры: ${fat.toFixed(1)} г (${pct(fat, goalFat)})`);
          console.log(`👟 Шаги: ${steps} шагов`);
          if (weightKg != null) {
            const w = Number(weightKg).toFixed(1);
            const goalWeightLine =
              goalWeight != null
                ? ` (цель: ${Number(goalWeight).toFixed(1)} кг)`
                : "";
            console.log(`⚖️ Вес: ${w} кг${goalWeightLine}`);
          }
          console.log("\n🍽 Приёмы пищи:");
          for (const mealType of ["breakfast", "lunch", "dinner", "snack"]) {
            const lines = byMeal[mealType];
            if (lines.length === 0) continue;
            const label = MEAL_LABELS[mealType] ?? mealType;
            console.log(`• ${label}: ${lines.join(", ")}`);
          }
          console.log("");
        } catch (err: any) {
          console.error("Failed to fetch day summary:", err.message);
          process.exit(1);
        }
      },
    );
}

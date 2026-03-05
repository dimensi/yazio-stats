import type { Command } from "commander";
import { getClient } from "../client.js";
import { getDateRange, formatDate } from "../utils/dates.js";
import { output } from "../utils/formatters.js";
import { progress } from "../utils/progress.js";
import type { CommonOptions } from "../types.js";
import { getPortionWeight } from "../utils/portionCount.js";
import { resolveProductAmountDisplay } from "../utils/productDisplay.js";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

function getMealNutrients(summary: any): Record<string, { calories: number; protein: number; carbs: number; fat: number }> {
  const out: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
  for (const meal of MEAL_ORDER) {
    const n = summary?.meals?.[meal]?.nutrients ?? {};
    out[meal] = {
      calories: Math.round(n["energy.energy"] ?? 0),
      protein: Math.round((n["nutrient.protein"] ?? 0) * 10) / 10,
      carbs: Math.round((n["nutrient.carb"] ?? 0) * 10) / 10,
      fat: Math.round((n["nutrient.fat"] ?? 0) * 10) / 10,
    };
  }
  return out;
}

export function registerMealsCommand(program: Command) {
  program
    .command("meals")
    .description("Consumed items detail (products per meal) with per-meal nutrition (calories, protein, carbs, fat)")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--format <format>", "Output format: table, json, csv", "table")
    .action(async (opts: CommonOptions, command: Command) => {
      const client = getClient(command.parent?.opts() ?? {});
      const dates = getDateRange(opts.from, opts.to);
      const rows: Record<string, unknown>[] = [];
      const jsonDays: {
        date: string;
        total: { calories: number; protein: number; carbs: number; fat: number };
        meals: Record<string, { items: Record<string, unknown>[]; nutrients: { calories: number; protein: number; carbs: number; fat: number } }>;
      }[] = [];

      const productNames = new Map<string, string>();
      const productCache = new Map<string, any>();

      for (let i = 0; i < dates.length; i++) {
        progress(i + 1, dates.length);
        const dateKey = formatDate(dates[i]);
        try {
          const [items, summary] = await Promise.all([
            client.user.getConsumedItems({ date: dateKey }) as Promise<any>,
            client.user.getDailySummary({ date: dates[i] }) as Promise<any>,
          ]);
          const mealNutrients = getMealNutrients(summary);
          const products = items?.products ?? [];

          const itemsByMeal: Record<string, Record<string, unknown>[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
          };

          for (const item of products) {
            let name = productNames.get(item.product_id);
            if (!name) {
              try {
                const product = await client.products.get(item.product_id);
                productCache.set(item.product_id, product ?? null);
                name = product?.name ?? item.product_id;
              } catch {
                productCache.set(item.product_id, null);
                name = item.product_id;
              }
              productNames.set(item.product_id, name!);
            }
            let amountDisplay: string | undefined;
            if (opts.format === "json") {
              const res = await resolveProductAmountDisplay(client, productCache, {
                product_id: item.product_id,
                amount: item.amount,
                serving: item.serving ?? null,
              });
              amountDisplay = res.amountDisplay;
            }
            const row = {
              date: dateKey,
              meal: item.daytime,
              product: name,
              amount: item.amount,
              serving: item.serving ?? "-",
              calories: mealNutrients[item.daytime]?.calories ?? "-",
              protein: mealNutrients[item.daytime]?.protein ?? "-",
              carbs: mealNutrients[item.daytime]?.carbs ?? "-",
              fat: mealNutrients[item.daytime]?.fat ?? "-",
            };
            rows.push(row);
            itemsByMeal[item.daytime]?.push(
              opts.format === "json" && amountDisplay != null
                ? { product: name, amount_display: amountDisplay }
                : { product: name, amount: item.amount, serving: item.serving ?? "-" },
            );
          }

          const simpleProducts = items?.simple_products ?? [];
          for (const item of simpleProducts) {
            const row = {
              date: dateKey,
              meal: item.daytime,
              product: item.name,
              amount: "-",
              serving: "express",
              calories: mealNutrients[item.daytime]?.calories ?? "-",
              protein: mealNutrients[item.daytime]?.protein ?? "-",
              carbs: mealNutrients[item.daytime]?.carbs ?? "-",
              fat: mealNutrients[item.daytime]?.fat ?? "-",
            };
            rows.push(row);
            itemsByMeal[item.daytime]?.push(
              opts.format === "json"
                ? { product: item.name, amount_display: "—" }
                : { product: item.name, amount: "-", serving: "express" },
            );
          }

          const recipePortions = items?.recipe_portions ?? [];
          for (const item of recipePortions) {
            const recipe = await client.user.getRecipe(item.recipe_id);
            const amount = getPortionWeight(item.portion_count, recipe);
            const amountDisplayRecipe = `${amount} г`;
            const row = {
              date: dateKey,
              meal: item.daytime,
              product: recipe.name,
              amount,
              serving: "recipe",
              calories: mealNutrients[item.daytime]?.calories ?? "-",
              protein: mealNutrients[item.daytime]?.protein ?? "-",
              carbs: mealNutrients[item.daytime]?.carbs ?? "-",
              fat: mealNutrients[item.daytime]?.fat ?? "-",
            };
            rows.push(row);
            itemsByMeal[item.daytime]?.push(
              opts.format === "json"
                ? { product: recipe.name, amount_display: amountDisplayRecipe }
                : { product: recipe.name, amount, serving: "recipe" },
            );
          }

          if (opts.format === "json") {
            const total = MEAL_ORDER.reduce(
              (acc, meal) => {
                const n = mealNutrients[meal];
                acc.calories += n.calories;
                acc.protein += n.protein;
                acc.carbs += n.carbs;
                acc.fat += n.fat;
                return acc;
              },
              { calories: 0, protein: 0, carbs: 0, fat: 0 },
            );
            jsonDays.push({
              date: dateKey,
              total: {
                calories: Math.round(total.calories),
                protein: Math.round(total.protein * 10) / 10,
                carbs: Math.round(total.carbs * 10) / 10,
                fat: Math.round(total.fat * 10) / 10,
              },
              meals: Object.fromEntries(
                MEAL_ORDER.map((meal) => [
                  meal,
                  {
                    items: itemsByMeal[meal] ?? [],
                    nutrients: mealNutrients[meal] ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
                  },
                ])
              ) as Record<string, { items: Record<string, unknown>[]; nutrients: { calories: number; protein: number; carbs: number; fat: number } }>,
            });
          }
        } catch {
          // skip days with errors
        }
      }

      if (opts.format === "json") {
        console.log(JSON.stringify(jsonDays.length ? jsonDays : [], null, 2));
      } else {
        const columns = ["date", "meal", "product", "amount", "serving", "calories", "protein", "carbs", "fat"];
        output(rows, opts.format, columns);
      }
    });
}

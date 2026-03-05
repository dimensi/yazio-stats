import type { Command } from "commander";
import { getClient } from "../client.js";
import { getDateRange, formatDate } from "../utils/dates.js";
import { output } from "../utils/formatters.js";
import { progress } from "../utils/progress.js";
import type { CommonOptions } from "../types.js";

export function registerSummaryCommand(program: Command) {
  program
    .command("summary")
    .description("Daily nutrition summary (calories, macros, water, steps)")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--format <format>", "Output format: table, json, csv", "table")
    .action(async (opts: CommonOptions, command: Command) => {
      const client = getClient(command.parent?.opts() ?? {});
      const dates = getDateRange(opts.from, opts.to);
      const rows: Record<string, unknown>[] = [];

      for (let i = 0; i < dates.length; i++) {
        progress(i + 1, dates.length);
        try {
          const s = await client.user.getDailySummary({ date: dates[i] });
          const meals = s as any;

          const sumNutrient = (key: string): number => {
            let total = 0;
            for (const mealType of ["breakfast", "lunch", "dinner", "snack"]) {
              total += meals?.meals?.[mealType]?.nutrients?.[key] ?? 0;
            }
            return Math.round(total);
          };

          rows.push({
            date: formatDate(dates[i]),
            calories: sumNutrient("energy.energy"),
            protein: sumNutrient("nutrient.protein"),
            fat: sumNutrient("nutrient.fat"),
            carbs: sumNutrient("nutrient.carb"),
            water_ml: meals?.water_intake ?? 0,
            steps: meals?.steps ?? 0,
          });
        } catch {
          rows.push({
            date: formatDate(dates[i]),
            calories: "-",
            protein: "-",
            fat: "-",
            carbs: "-",
            water_ml: "-",
            steps: "-",
          });
        }
      }

      output(rows, opts.format);
    });
}

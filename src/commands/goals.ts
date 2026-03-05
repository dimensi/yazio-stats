import type { Command } from "commander";
import { getClient } from "../client.js";
import { output } from "../utils/formatters.js";
import type { CommonOptions } from "../types.js";

export function registerGoalsCommand(program: Command) {
  program
    .command("goals")
    .description("Current nutrition and activity goals")
    .option("--from <date>", "Date to check goals for (YYYY-MM-DD)")
    .option("--format <format>", "Output format: table, json, csv", "table")
    .action(async (opts: CommonOptions, command: Command) => {
      const client = getClient(command.parent?.opts() ?? {});
      const date = opts.from ? new Date(opts.from) : new Date();

      try {
        const g = await client.user.getGoals({ date }) as any;
        const rows = [
          {
            goal: "Calories (kcal)",
            value: g?.["energy.energy"] ?? "-",
          },
          {
            goal: "Protein (g)",
            value: g?.["nutrient.protein"] ?? "-",
          },
          {
            goal: "Fat (g)",
            value: g?.["nutrient.fat"] ?? "-",
          },
          {
            goal: "Carbs (g)",
            value: g?.["nutrient.carb"] ?? "-",
          },
          {
            goal: "Steps",
            value: g?.["activity.step"] ?? "-",
          },
          {
            goal: "Water (ml)",
            value: g?.water ?? "-",
          },
          {
            goal: "Target weight (kg)",
            value: g?.["bodyvalue.weight"] ?? "-",
          },
        ];

        output(rows, opts.format);
      } catch (err: any) {
        console.error("Failed to fetch goals:", err.message);
        process.exit(1);
      }
    });
}

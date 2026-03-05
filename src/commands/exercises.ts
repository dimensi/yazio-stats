import type { Command } from "commander";
import { getClient } from "../client.js";
import { getDateRange, formatDate } from "../utils/dates.js";
import { output } from "../utils/formatters.js";
import { progress } from "../utils/progress.js";
import type { CommonOptions } from "../types.js";

export function registerExercisesCommand(program: Command) {
  program
    .command("exercises")
    .description("Exercise and training history")
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
          const ex = await client.user.getExercises({ date: dates[i] }) as any;

          const trainings = ex?.training ?? [];
          for (const t of trainings) {
            rows.push({
              date: formatDate(dates[i]),
              type: "training",
              name: t.name ?? t.type ?? "-",
              duration_min: t.duration ?? "-",
              calories: t.energy ?? "-",
            });
          }

          const custom = ex?.custom_training ?? [];
          for (const t of custom) {
            rows.push({
              date: formatDate(dates[i]),
              type: "custom",
              name: t.name ?? t.type ?? "-",
              duration_min: t.duration ?? "-",
              calories: t.energy ?? "-",
            });
          }
        } catch {
          // skip
        }
      }

      output(rows, opts.format);
    });
}

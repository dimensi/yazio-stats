import type { Command } from "commander";
import { getClient } from "../client.js";
import { getDateRange, formatDate } from "../utils/dates.js";
import { output } from "../utils/formatters.js";
import { progress } from "../utils/progress.js";
import type { CommonOptions } from "../types.js";

export function registerWaterCommand(program: Command) {
  program
    .command("water")
    .description("Water intake history (ml per day)")
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
          const w = await client.user.getWaterIntake({ date: dates[i] });
          rows.push({
            date: formatDate(dates[i]),
            water_ml: (w as any)?.water_intake ?? 0,
          });
        } catch {
          rows.push({
            date: formatDate(dates[i]),
            water_ml: "-",
          });
        }
      }

      output(rows, opts.format);
    });
}

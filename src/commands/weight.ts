import type { Command } from "commander";
import { getClient } from "../client.js";
import { getDateRange, formatDate } from "../utils/dates.js";
import { output } from "../utils/formatters.js";
import { progress } from "../utils/progress.js";
import type { CommonOptions } from "../types.js";

export function registerWeightCommand(program: Command) {
  program
    .command("weight")
    .description("Weight history (deduplicated entries)")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--format <format>", "Output format: table, json, csv", "table")
    .action(async (opts: CommonOptions) => {
      const client = getClient();
      const dates = getDateRange(opts.from, opts.to);
      const rows: Record<string, unknown>[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < dates.length; i++) {
        progress(i + 1, dates.length);
        try {
          const w = await client.user.getWeight({ date: dates[i] }) as any;
          if (w && w.id && !seen.has(w.id)) {
            seen.add(w.id);
            rows.push({
              date: w.date ?? formatDate(dates[i]),
              weight_kg: w.value,
            });
          }
        } catch {
          // skip
        }
      }

      output(rows, opts.format);
    });
}

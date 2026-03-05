import type { Command } from "commander";
import { getClient } from "../client.js";
import { getDateRange, formatDate } from "../utils/dates.js";
import { output } from "../utils/formatters.js";
import { progress } from "../utils/progress.js";
import type { CommonOptions } from "../types.js";

export function registerMealsCommand(program: Command) {
  program
    .command("meals")
    .description("Consumed items detail (products per meal)")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .option("--format <format>", "Output format: table, json, csv", "table")
    .action(async (opts: CommonOptions, command: Command) => {
      const client = getClient(command.parent?.opts() ?? {});
      const dates = getDateRange(opts.from, opts.to);
      const rows: Record<string, unknown>[] = [];

      // Cache product names to avoid repeated lookups
      const productNames = new Map<string, string>();

      for (let i = 0; i < dates.length; i++) {
        progress(i + 1, dates.length);
        try {
          const items = await client.user.getConsumedItems({ date: dates[i] });
          const products = (items as any)?.products ?? [];

          for (const item of products) {
            let name = productNames.get(item.product_id);
            if (!name) {
              try {
                const product = await client.products.get(item.product_id);
                name = (product as any)?.name ?? item.product_id;
              } catch {
                name = item.product_id;
              }
              productNames.set(item.product_id, name!);
            }

            rows.push({
              date: formatDate(dates[i]),
              meal: item.daytime,
              product: name,
              amount: item.amount,
              serving: item.serving ?? "-",
            });
          }

          const simpleProducts = (items as any)?.simple_products ?? [];
          for (const item of simpleProducts) {
            rows.push({
              date: formatDate(dates[i]),
              meal: item.daytime,
              product: item.name,
              amount: "-",
              serving: "express",
            });
          }

          const recipePortions = (items as any)?.recipe_portions ?? [];
          for (const item of recipePortions) {
            rows.push({
              date: formatDate(dates[i]),
              meal: item.daytime,
              product: item.name,
              amount: "-",
              serving: "recipe",
            });
          }
        } catch {
          // skip days with errors
        }
      }

      output(rows, opts.format);
    });
}

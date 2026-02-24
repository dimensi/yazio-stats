import Table from "cli-table3";
import type { OutputFormat } from "../types.js";

export function output(
  data: Record<string, unknown>[],
  format: OutputFormat,
  columns?: string[]
) {
  if (data.length === 0) {
    console.log("No data found.");
    return;
  }

  switch (format) {
    case "json":
      console.log(JSON.stringify(data, null, 2));
      break;
    case "csv":
      printCsv(data, columns);
      break;
    case "table":
    default:
      printTable(data, columns);
  }
}

function printTable(
  data: Record<string, unknown>[],
  columns?: string[]
) {
  const cols = columns ?? Object.keys(data[0]);
  const table = new Table({
    head: cols,
    style: { head: ["cyan"] },
  });
  for (const row of data) {
    table.push(cols.map((c) => String(row[c] ?? "")));
  }
  console.log(table.toString());
}

function printCsv(
  data: Record<string, unknown>[],
  columns?: string[]
) {
  const cols = columns ?? Object.keys(data[0]);
  console.log(cols.join(","));
  for (const row of data) {
    console.log(
      cols
        .map((c) => {
          const val = row[c];
          if (typeof val === "string" && val.includes(",")) {
            return `"${val}"`;
          }
          return String(val ?? "");
        })
        .join(",")
    );
  }
}

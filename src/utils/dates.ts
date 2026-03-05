export function getDateRange(from?: string, to?: string): Date[] {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error("Error: Invalid date format. Use YYYY-MM-DD.");
    process.exit(1);
  }

  if (start > end) {
    console.error("Error: --from date must be before --to date.");
    process.exit(1);
  }

  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** For display: "04 March 2026" */
export function formatDateLong(d: Date): string {
  const day = d.getDate().toString().padStart(2, "0");
  const month = d.toLocaleString("en", { month: "long" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

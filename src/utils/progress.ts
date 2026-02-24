export function progress(current: number, total: number) {
  process.stderr.write(`\rFetching day ${current}/${total}...`);
  if (current === total) {
    process.stderr.write("\r" + " ".repeat(30) + "\r");
  }
}

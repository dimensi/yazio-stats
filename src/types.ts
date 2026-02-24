export type OutputFormat = "table" | "json" | "csv";

export interface CommonOptions {
  from?: string;
  to?: string;
  format: OutputFormat;
}

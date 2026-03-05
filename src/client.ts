import { Yazio } from "yazio";
import "dotenv/config";
import { readFile, writeFile, rename, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const TOKEN_FILENAME = "yazio-token.json";

function getTokenFilePath(): string {
  return join(process.cwd(), TOKEN_FILENAME);
}

async function readTokenFile(): Promise<unknown> {
  const filePath = getTokenFilePath();
  let data: string;
  try {
    data = await readFile(filePath, "utf-8");
  } catch {
    return null; // file missing
  }
  try {
    return JSON.parse(data) as unknown;
  } catch {
    console.error("Warning: invalid token file, re-authenticating.");
    return null;
  }
}

async function writeTokenFile(token: unknown): Promise<void> {
  const filePath = getTokenFilePath();
  const tmpPath = join(tmpdir(), `yazio-token-${randomBytes(6).toString("hex")}.json`);
  try {
    await writeFile(tmpPath, JSON.stringify(token), "utf-8");
    await rename(tmpPath, filePath);
  } catch (err) {
    console.error("Warning: could not save token to file:", (err as Error).message);
  } finally {
    try {
      await rm(tmpPath, { force: true });
    } catch {
      // ignore
    }
  }
}

let instance: Yazio | null = null;

/**
 * Returns a singleton Yazio client. noCacheToken only affects token file
 * read/write; the same instance is reused for the process.
 */
export function getClient(options?: { noCacheToken?: boolean }): Yazio {
  if (instance) return instance;

  const username = process.env.YAZIO_USERNAME;
  const password = process.env.YAZIO_PASSWORD;

  if (!username || !password) {
    console.error(
      "Error: YAZIO_USERNAME and YAZIO_PASSWORD must be set in .env file.\n" +
        "Copy .env.example to .env and fill in your credentials."
    );
    process.exit(1);
  }

  if (options?.noCacheToken === true) {
    instance = new Yazio({
      credentials: { username, password },
    });
  } else {
    instance = new Yazio({
      credentials: { username, password },
      token: readTokenFile(),
      onRefresh: ({ token }) => writeTokenFile(token),
    });
  }

  return instance;
}

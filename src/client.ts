import { Yazio } from "yazio";
import "dotenv/config";

let instance: Yazio | null = null;

export function getClient(): Yazio {
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

  instance = new Yazio({
    credentials: { username, password },
  });

  return instance;
}

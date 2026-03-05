# Token cache implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cache YAZIO token in `yazio-token.json` in cwd and reuse it; add `--no-cache-token` to disable.

**Architecture:** Token file in `process.cwd()`, atomic write via temp file + rename. `getClient(options)` accepts `noCacheToken`; when false, pass `token` (Promise from file) and `onRefresh` to `Yazio`. Global option on root program; each command passes `command.parent?.opts()` into `getClient`.

**Tech Stack:** Node `fs`/`path`, Commander, existing `yazio` client (supports `token` + `onRefresh`).

---

## Task 1: Token file helpers and getClient(options) in client.ts

**Files:**
- Modify: `src/client.ts`

**Step 1: Add token file path and read helper**

At top of file after imports, add:

```ts
import { readFile, writeFile, mkdtemp, rename, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const TOKEN_FILENAME = "yazio-token.json";

function getTokenFilePath(): string {
  return join(process.cwd(), TOKEN_FILENAME);
}

async function readTokenFile(): Promise<unknown> {
  const filePath = getTokenFilePath();
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}
```

**Step 2: Add atomic write helper**

```ts
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
```

**Step 3: Change getClient signature and use token/onRefresh when cache enabled**

- Change to `getClient(options?: { noCacheToken?: boolean }): Yazio`.
- If `instance` exists, return it (no change).
- If `options?.noCacheToken === true`: create `Yazio` with only `credentials` (current behavior).
- Else: create `Yazio` with `credentials`, `token: readTokenFile()` (Promise), and `onRefresh: ({ token }) => writeTokenFile(token)`.
- When cache enabled, pass `token: readTokenFile()` (Promise); if file missing or invalid, `readTokenFile()` returns `null` — library will use credentials and then call `onRefresh` with the new token.

**Step 4: Commit**

```bash
git add src/client.ts
git commit -m "feat(client): add token file read/write and getClient(options)"
```

---

## Task 2: Global option --no-cache-token and pass options to getClient

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/commands/summary.ts`
- Modify: `src/commands/meals.ts`
- Modify: `src/commands/water.ts`
- Modify: `src/commands/weight.ts`
- Modify: `src/commands/exercises.ts`
- Modify: `src/commands/goals.ts`
- Modify: `src/commands/day.ts`

**Step 1: Add global option in cli.ts**

In `src/cli.ts`, after `.version(pkg.version)` and before `registerSummaryCommand`:

```ts
program.option("--no-cache-token", "do not use or save token to yazio-token.json");
```

**Step 2: Update each command to pass global opts to getClient**

In every command file, change the action to accept `(opts, command)` and call:

```ts
const client = getClient(command.parent?.opts() ?? {});
```

instead of:

```ts
const client = getClient();
```

Files and exact change:
- `src/commands/summary.ts`: action `(opts: CommonOptions)` → `(opts: CommonOptions, command: Command)`, add `Command` to import from "commander", then `getClient(command.parent?.opts() ?? {})`.
- `src/commands/meals.ts`: same.
- `src/commands/water.ts`: same.
- `src/commands/weight.ts`: same.
- `src/commands/exercises.ts`: same.
- `src/commands/goals.ts`: same.
- `src/commands/day.ts`: same.

**Step 3: Verify**

Run:

```bash
npx tsx src/cli.ts summary --help
```

Expected: `--no-cache-token` listed. Run once without flag (should create/use token file), then with `--no-cache-token` (should not use file).

**Step 4: Commit**

```bash
git add src/cli.ts src/commands/*.ts
git commit -m "feat(cli): add --no-cache-token and pass global opts to getClient"
```

---

## Task 3: README and CHANGELOG

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json` (version bump if desired)

**Step 1: Document token cache in README**

In "Настройка" or "Использование", add a short subsection:

- По умолчанию токен сохраняется в `yazio-token.json` в текущей директории и переиспользуется. Чтобы отключить кэш: `--no-cache-token`.

**Step 2: Ignore token file in .gitignore**

Add line: `yazio-token.json`

**Step 3: Update CHANGELOG**

Add entry for current version (from package.json), date 2025-03-05:

- Added: кэш токена в `yazio-token.json` (cwd), опция `--no-cache-token`.

**Step 4: Commit**

```bash
git add README.md CHANGELOG.md .gitignore
git commit -m "docs: document token cache and --no-cache-token"
```

---

## Execution

Plan complete. Two execution options:

1. **Subagent-Driven (this session)** — dispatch a subagent per task, review between tasks.
2. **Parallel Session (separate)** — open a new session with executing-plans, run with checkpoints.

Which approach?

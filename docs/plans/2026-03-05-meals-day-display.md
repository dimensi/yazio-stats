# Meals & Day Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Correct product sizes (resolve weight from product when serving is not g/ml), add JSON format with total and amount_display, and day command output with Telegram markup and Russian date.

**Architecture:** Single utility in `src/utils/productDisplay.ts` for resolving weight and building `amount_display` (with optional product cache). Meals and day both use it. Date formatting extended in `dates.ts` for Russian. No new dependencies.

**Tech Stack:** TypeScript, existing Yazio client, Node.

**Design doc:** `docs/plans/2026-03-05-meals-day-display-design.md`

---

## Task 1: Russian date in dates.ts

**Files:**
- Modify: `src/utils/dates.ts`

**Step 1:** Add function for Russian long date.

In `src/utils/dates.ts` add after `formatDateLong`:

```ts
/** For display in day (ru): "4 марта 2026" */
export function formatDateLongRu(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
```

**Step 2:** Run CLI to confirm no regression.

Run: `cd /Users/n.nafranets/projects/yazio-stats && npm run day -- --date 2026-03-04`
Expected: day summary prints; date still in English until day.ts is updated (Task 5).

**Step 3:** Commit.

```bash
git add src/utils/dates.ts
git commit -m "feat: add formatDateLongRu for Russian date display"
```

---

## Task 2: productDisplay utility (resolve weight + amount_display)

**Files:**
- Create: `src/utils/productDisplay.ts`

**Step 1:** Create the module with types and helper.

Product shape from API (minimal): `{ servings: { serving: string; amount: number }[]; base_unit?: string }`.
Consumed item: `{ product_id: string; amount: number; serving: string | null }`.

- `SERVING_GRAM = new Set(['gram', 'g'])`
- `SERVING_ML = new Set(['milliliter', 'ml'])`
- `function getAmountDisplay(amount: number, serving: string | null, product: { servings?: { serving: string; amount: number }[]; base_unit?: string } | null): { weightG: number | null; amountDisplay: string }`
  - If product is null: return `{ weightG: null, amountDisplay: `${amount} ${serving ?? '—'}` }` (or map serving to ru: portion→порц., slice→ломт., each→шт. for fallback).
  - If serving in SERVING_GRAM: return `{ weightG: amount, amountDisplay: `${amount} г` }`
  - If serving in SERVING_ML: return `{ weightG: null, amountDisplay: `${amount} мл` }`
  - Else: find in product.servings entry where `s.serving === serving`; if found, weightG = amount * s.amount, amountDisplay = `${Math.round(weightG)} г`; if not found and product.base_unit === 'g', treat amount as grams: weightG = amount, amountDisplay = `${amount} г`; else fallback amountDisplay with Russian unit map (burger→порц., slice→ломт., portion→порц., each→шт., can→банк. or leave as-is), weightG = null.

**Step 2:** Add Russian fallback unit map.

Map known serving keys to short Russian labels (e.g. burger, portion → "порц.", slice → "ломт.", each → "шт."). Use for fallback when product is missing or serving not in product.servings.

**Step 3:** Export async helper for use in commands: `resolveProductAmountDisplay(client, productCache, item): Promise<{ weightG: number | null; amountDisplay: string }>`. It gets product from cache or client.products.get(item.product_id), then calls getAmountDisplay(item.amount, item.serving ?? null, product). Cache is Map<string, product>.

**Step 4:** Run a quick sanity check.

Run: `npm run meals -- --from 2026-03-04 --to 2026-03-04` (after removing console.logs in Task 3) to ensure no crash. Optional: add a small test script that calls getAmountDisplay(260, 'burger', { servings: [{ serving: 'burger', amount: 260 }], base_unit: 'g' }) and expects amountDisplay "260 г".

**Step 5:** Commit.

```bash
git add src/utils/productDisplay.ts
git commit -m "feat: add productDisplay utility for weight and amount_display"
```

---

## Task 3: meals.ts — remove debug logs, use productDisplay, add total and amount_display for JSON

**Files:**
- Modify: `src/commands/meals.ts`

**Step 1:** Remove all `console.log` (items, summary, product).

**Step 2:** Add product cache and use resolveProductAmountDisplay for products.

- Before the products loop, create `const productCache = new Map<string, any>();`.
- When fetching product for name, store full product in cache: `productCache.set(item.product_id, product)`.
- After resolving name, call `const { amountDisplay } = await resolveProductAmountDisplay(client, productCache, { product_id: item.product_id, amount: item.amount, serving: item.serving ?? null });` (adjust signature to pass item and cache).
- For table/csv rows keep amount and serving; for json push item with `product`, `amount_display` (and optionally keep amount/serving for backward compatibility).
- For products loop: push to itemsByMeal `{ product: name, amount_display: amountDisplay }` when format is json; for table still push amount/serving (or add amount_display column — design says JSON has amount_display; table can keep amount/serving or add amount_display).

**Step 3:** Add `total` to JSON day object.

After building mealNutrients, compute total: sum calories/protein/carbs/fat across MEAL_ORDER. Push to jsonDays: `{ date: dateKey, total: { calories, protein, carbs, fat }, meals: { ... } }`.

**Step 4:** Ensure simple_products and recipe_portions get amount_display: for simple_products use `"—"` or `"— г"`; for recipe use `${getPortionWeight(...)} г`.

**Step 5:** Run meals JSON and table.

Run: `npm run meals -- --from 2026-03-04 --to 2026-03-04 --format json`
Expected: JSON has date, total, meals.*.items[].amount_display, meals.*.nutrients.

**Step 6:** Commit.

```bash
git add src/commands/meals.ts
git commit -m "feat(meals): resolve product weight, add total and amount_display to JSON"
```

---

## Task 4: day.ts — use productDisplay, Russian date, Telegram markup, per-meal nutrients

**Files:**
- Modify: `src/commands/day.ts`

**Step 1:** Use formatDateLongRu in text output.

Import `formatDateLongRu` from dates. In text block, replace `formatDateLong(date)` with `formatDateLongRu(date)` for the header line.

**Step 2:** Build byMeal with amount_display via productDisplay.

- Use product cache (fetch products once for all products in items.products).
- For each product item call resolveProductAmountDisplay (reuse same cache), push `${name} (${amountDisplay})` to byMeal[daytime].
- simple_products: push `${name} (—)` or `(— г)`.
- recipe_portions: push `${name} (${getPortionWeight(...)} г)`.

**Step 3:** Add per-meal nutrients for text format.

Get meal nutrients from summary (same as in meals: summary.meals[meal].nutrients → energy.energy, nutrient.protein, nutrient.carb, nutrient.fat). Round as in getMealNutrients in meals. For each meal type in "breakfast","lunch","dinner","snack" print after the list of items a line: `_${calories} ккал · Б ${protein} · У ${carbs} · Ж ${fat}_` (Telegram italic).

**Step 4:** Apply Telegram markup to header and nutrient lines.

- Header: `📊 *Сводка питания — ${formatDateLongRu(date)}*`
- Calories: `🔥 *Калории:* ${calories} ккал (${pct(...)})`
- Protein: `🍗 *Белки:* ${protein} г (${pct(...)})`
- Carbs: `🍞 *Углеводы:* ${carbs} г (${pct(...)})`
- Fat: `🥑 *Жиры:* ${fat} г (${pct(...)})`
- Steps/weight: keep as is (no bold).
- Приёмы пищи: `🍽 *Приёмы пищи:*`
- Each meal: `• *Завтрак:* ... \n  _495 ккал · Б 32 · У 52 · Ж 17_`

**Step 5:** Optional: add dateLongRu to day JSON output for consistency.

**Step 6:** Run day command.

Run: `npm run day -- --date 2026-03-04`
Expected: Russian date in header, bold labels, italic nutrient line under each meal, product amounts like "260 г" or "120 г".

**Step 7:** Commit.

```bash
git add src/commands/day.ts
git commit -m "feat(day): Telegram markup, Russian date, amount_display, per-meal nutrients"
```

---

## Task 5: CHANGELOG and version

**Files:**
- Modify: `CHANGELOG.md`
- Optionally: `package.json` version bump if you use semantic versioning for features.

**Step 1:** Append to CHANGELOG.md (version from package.json, today’s date).

```md
## [1.4.0] - 2026-03-05

### Added
- Разрешение веса продуктов по API при нестандартных единицах (порц., ломт. и т.д.); вывод в граммах.
- В JSON `meals --format json`: поле `total` за день и в каждом item поле `amount_display` (г/мл по-русски).
- Команда `day`: разметка Telegram (*жирный*, _курсив_), дата на русском, КБЖУ по каждому приёму пищи.
```

**Step 2:** Commit.

```bash
git add CHANGELOG.md
git commit -m "chore: changelog for meals/day display and Russian date"
```

---

## Execution

After implementing, run:

- `npm run meals -- --from 2026-03-04 --to 2026-03-04`
- `npm run meals -- --from 2026-03-04 --to 2026-03-04 --format json`
- `npm run day -- --date 2026-03-04`

to verify behaviour end-to-end.

Plan complete and saved to `docs/plans/2026-03-05-meals-day-display.md`. Two execution options:

1. **Subagent-Driven (this session)** — dispatch a fresh subagent per task, review between tasks.
2. **Parallel Session (separate)** — open a new session with executing-plans, batch execution with checkpoints.

Which approach?

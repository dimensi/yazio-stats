const SERVING_GRAM = new Set(["gram", "g"]);
const SERVING_ML = new Set(["milliliter", "ml"]);

/** Russian labels for fallback when weight cannot be resolved */
const SERVING_LABEL_RU: Record<string, string> = {
  burger: "порц.",
  portion: "порц.",
  slice: "ломт.",
  each: "шт.",
  can: "банк.",
};

export type ProductLike = {
  servings?: { serving: string; amount: number }[];
  base_unit?: string;
};

export type ConsumedItemLike = {
  product_id: string;
  amount: number;
  serving?: string | null;
};

export function getAmountDisplay(
  amount: number,
  serving: string | null,
  product: ProductLike | null,
): { weightG: number | null; amountDisplay: string } {
  const servingNorm = (serving ?? "").toLowerCase().trim();

  if (product == null) {
    const label = servingNorm ? SERVING_LABEL_RU[servingNorm] ?? serving : "—";
    return { weightG: null, amountDisplay: `${amount} ${label}` };
  }

  if (SERVING_GRAM.has(servingNorm)) {
    return { weightG: amount, amountDisplay: `${amount} г` };
  }
  if (SERVING_ML.has(servingNorm)) {
    return { weightG: null, amountDisplay: `${amount} мл` };
  }

  const servings = product.servings ?? [];
  const entry = servings.find((s) => s.serving.toLowerCase() === servingNorm);
  if (entry) {
    // API sends amount as weight (grams) for portion types, not quantity
    const weightG = amount;
    return { weightG, amountDisplay: `${amount} г` };
  }

  if (product.base_unit === "g") {
    return { weightG: amount, amountDisplay: `${amount} г` };
  }
  const baseUnit = (product.base_unit ?? "").toLowerCase();
  if (baseUnit === "ml" || baseUnit === "milliliter") {
    return { weightG: null, amountDisplay: `${amount} мл` };
  }

  const label = servingNorm ? SERVING_LABEL_RU[servingNorm] ?? serving : "—";
  return { weightG: null, amountDisplay: `${amount} ${label}` };
}

type ClientLike = {
  products: { get: (id: string) => Promise<ProductLike | null | undefined> };
};

export async function resolveProductAmountDisplay(
  client: ClientLike,
  productCache: Map<string, ProductLike | null>,
  item: ConsumedItemLike,
): Promise<{ weightG: number | null; amountDisplay: string }> {
  let product = productCache.get(item.product_id);
  if (product === undefined) {
    try {
      const p = await client.products.get(item.product_id);
      product = p ?? null;
    } catch {
      product = null;
    }
    productCache.set(item.product_id, product);
  }
  return getAmountDisplay(item.amount, item.serving ?? null, product);
}

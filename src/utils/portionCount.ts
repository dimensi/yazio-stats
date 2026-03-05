import { getClient } from "../client";

type Client = ReturnType<typeof getClient>;
type Recipe = Awaited<ReturnType<Client["user"]["getRecipe"]>>;
export function getPortionWeight(portionCount: number, recipe: Recipe): number {
  const totalWeight = recipe.servings.reduce((acc, serving) => acc + serving.amount, 0);
  const portionWeight = totalWeight / recipe.portion_count;
  return Math.round(portionWeight * portionCount);
}
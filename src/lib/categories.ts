export const CATEGORIES = [
  "Herbs/spices & stock",
  "Oils",
  "Condiments",
  "Sauces & dressings",
  "Spreads & pastes",
  "Nuts, seeds & dried fruit",
  "Superfoods",
  "Breakfast & cereals",
  "Baking",
  "Bread, bakery & crackers",
  "Beans & pulses",
  "Pasta & noodles",
  "Jars & preserved foods",
  "Grains",
  "Fruit",
  "Veg",
  "Dairy",
  "Meat & fish",
  "Ready meals",
  "Sweet treats",
  "Kids food",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const UNCATEGORISED = "Uncategorised";

/** @deprecated Use UNCATEGORISED */
export const UNCATEGORIZED = UNCATEGORISED;

const UNCATEGORISED_ALIASES = new Set([UNCATEGORISED, "Uncategorized"]);

export function isUncategorisedCategory(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return UNCATEGORISED_ALIASES.has(name.trim());
}

export function resolvePantryCategory(category: string | null | undefined): string {
  return isUncategorisedCategory(category) ? UNCATEGORISED : category!.trim();
}

export function pantryCategoryForDb(category: string): string | null {
  return isUncategorisedCategory(category) ? null : category;
}

/** Category names for selects — real categories first, Uncategorised always last. */
export function categorySelectOptions(names: string[]): string[] {
  const regular = names.filter((n) => !isUncategorisedCategory(n));
  return [...regular, UNCATEGORISED];
}

/** Section keys for grouped pantry — Uncategorised always last. */
export function sortPantryCategoryKeys(keys: string[], categoryNames: string[]): string[] {
  const uncategorised = keys.filter(isUncategorisedCategory);
  const rest = keys.filter((k) => !isUncategorisedCategory(k));
  rest.sort((a, b) => {
    const ia = categoryNames.indexOf(a);
    const ib = categoryNames.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return [...rest, ...uncategorised];
}

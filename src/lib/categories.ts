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
export const UNCATEGORIZED = "Uncategorized";

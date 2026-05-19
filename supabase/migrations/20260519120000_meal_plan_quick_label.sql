-- Quick planner items: text-only meals with no linked recipe.
ALTER TABLE public.meal_plan
  ADD COLUMN label TEXT;

ALTER TABLE public.meal_plan
  ADD CONSTRAINT meal_plan_recipe_or_label_check
  CHECK (
    recipe_id IS NOT NULL
    OR (label IS NOT NULL AND length(trim(label)) > 0)
  );

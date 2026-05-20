ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS meal_types text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_meal_types_allowed_check
  CHECK (
    meal_types <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack', 'sweet']::text[]
  );

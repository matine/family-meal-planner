-- Run in Supabase SQL Editor if recipe tags / cook time / meal types are missing.
-- Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS).
-- Cleans existing rows before adding check constraints.

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cook_time_minutes integer;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS meal_types text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_tags_allowed_check;

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_cook_time_positive_check;

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_meal_types_allowed_check;

-- Legacy Quick tag -> 30 min cook time
UPDATE public.recipes
SET cook_time_minutes = 30
WHERE 'Quick' = ANY(tags) AND cook_time_minutes IS NULL;

-- Drop tags no longer used (Sweet is meal type only)
UPDATE public.recipes
SET tags = array_remove(tags, 'Quick')
WHERE 'Quick' = ANY(tags);

UPDATE public.recipes
SET tags = array_remove(tags, 'Sweet')
WHERE 'Sweet' = ANY(tags);

-- Keep only allowed tag values (removes typos / old labels)
UPDATE public.recipes
SET tags = COALESCE(
  (
    SELECT array_agg(DISTINCT t ORDER BY t)
    FROM unnest(tags) AS t
    WHERE t = ANY(
      ARRAY['Healthy', 'Family', 'Marlo', 'Keto', 'Low effort', 'Special']::text[]
    )
  ),
  '{}'
);

-- Keep only allowed meal types
UPDATE public.recipes
SET meal_types = COALESCE(
  (
    SELECT array_agg(DISTINCT m ORDER BY m)
    FROM unnest(meal_types) AS m
    WHERE m = ANY(
      ARRAY['breakfast', 'lunch', 'dinner', 'snack', 'sweet']::text[]
    )
  ),
  '{}'
);

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_tags_allowed_check
  CHECK (
    tags <@ ARRAY['Healthy', 'Family', 'Marlo', 'Keto', 'Low effort', 'Special']::text[]
  );

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_cook_time_positive_check
  CHECK (cook_time_minutes IS NULL OR cook_time_minutes > 0);

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_meal_types_allowed_check
  CHECK (
    meal_types <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack', 'sweet']::text[]
  );

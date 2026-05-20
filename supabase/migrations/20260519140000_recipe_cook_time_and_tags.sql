-- Cook time (minutes) replaces the Quick tag; add Low effort.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cook_time_minutes integer;

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_tags_allowed_check;

-- Migrate legacy Quick tag to 30 minutes.
UPDATE public.recipes
SET cook_time_minutes = 30
WHERE 'Quick' = ANY(tags) AND cook_time_minutes IS NULL;

UPDATE public.recipes
SET tags = array_remove(tags, 'Quick')
WHERE 'Quick' = ANY(tags);

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_tags_allowed_check
  CHECK (
    tags <@ ARRAY['Healthy', 'Family', 'Marlo', 'Keto', 'Low effort', 'Special']::text[]
  );

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_cook_time_positive_check
  CHECK (cook_time_minutes IS NULL OR cook_time_minutes > 0);

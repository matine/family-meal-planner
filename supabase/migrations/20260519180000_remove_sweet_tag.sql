-- Sweet is a meal type only; remove from recipe tags.
UPDATE public.recipes
SET tags = array_remove(tags, 'Sweet')
WHERE 'Sweet' = ANY(tags);

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_tags_allowed_check;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_tags_allowed_check
  CHECK (
    tags <@ ARRAY['Healthy', 'Family', 'Marlo', 'Keto', 'Low effort', 'Special']::text[]
  );

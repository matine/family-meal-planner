ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_tags_allowed_check;

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_tags_allowed_check
  CHECK (
    tags <@ ARRAY['Healthy', 'Family', 'Marlo', 'Keto', 'Low effort', 'Special', 'Sweet']::text[]
  );

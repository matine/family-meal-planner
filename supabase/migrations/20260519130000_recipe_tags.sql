-- Optional recipe labels for filtering and display.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_tags_allowed_check
  CHECK (
    tags <@ ARRAY['Quick', 'Healthy', 'Family', 'Marlo', 'Keto']::text[]
  );

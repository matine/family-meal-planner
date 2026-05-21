-- === 20260506123518_2e134840-f553-43e8-b869-f7ba00181204.sql ===

CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  method TEXT,
  image_url TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.meal_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount TEXT,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

-- Shared family space: public access
CREATE POLICY "public all ingredients" ON public.ingredients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all recipes" ON public.recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all meal_plan" ON public.meal_plan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all shopping_list" ON public.shopping_list FOR ALL USING (true) WITH CHECK (true);

-- === 20260506124112_bb649d2d-0a3e-4d81-b597-2b01601fa963.sql ===

ALTER TABLE public.ingredients REPLICA IDENTITY FULL;
ALTER TABLE public.recipes REPLICA IDENTITY FULL;
ALTER TABLE public.meal_plan REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_list REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ingredients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plan;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list;

-- === 20260507090858_03a536d7-268c-42f7-82f9-c86b44e4fd1a.sql ===
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS category TEXT;
-- === 20260507093135_1fdb0a90-999d-4017-93d4-a57dda1b977f.sql ===
CREATE TABLE public.ingredient_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alias text NOT NULL UNIQUE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredient_aliases_ingredient_id ON public.ingredient_aliases(ingredient_id);

ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all ingredient_aliases"
ON public.ingredient_aliases
FOR ALL
USING (true)
WITH CHECK (true);
-- === 20260508105929_b70f1d43-9f25-4b1b-b54f-7ad0ff37d161.sql ===
-- 1. Source-of-truth ingredients table
CREATE TABLE public.canonical_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.canonical_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all canonical_ingredients"
  ON public.canonical_ingredients FOR ALL
  USING (true) WITH CHECK (true);

-- 2. Link pantry + shopping list to canonical
ALTER TABLE public.ingredients
  ADD COLUMN canonical_id UUID REFERENCES public.canonical_ingredients(id) ON DELETE SET NULL;
ALTER TABLE public.shopping_list
  ADD COLUMN canonical_id UUID REFERENCES public.canonical_ingredients(id) ON DELETE SET NULL;

-- 3. Backfill canonical from existing data (lowercased + trimmed)
INSERT INTO public.canonical_ingredients (name)
SELECT DISTINCT lower(trim(name)) AS n
FROM (
  SELECT name FROM public.ingredients WHERE name IS NOT NULL
  UNION
  SELECT name FROM public.shopping_list WHERE name IS NOT NULL
  UNION
  SELECT trim((jsonb_array_elements(ingredients)->>'name')) FROM public.recipes
) src
WHERE name IS NOT NULL AND trim(name) <> ''
ON CONFLICT (name) DO NOTHING;

-- 4. Link existing pantry + shopping rows
UPDATE public.ingredients i
SET canonical_id = c.id
FROM public.canonical_ingredients c
WHERE c.name = lower(trim(i.name));

UPDATE public.shopping_list s
SET canonical_id = c.id
FROM public.canonical_ingredients c
WHERE c.name = lower(trim(s.name));

-- 5. Stamp canonicalId on each recipe ingredient
UPDATE public.recipes r
SET ingredients = COALESCE((
  SELECT jsonb_agg(
    CASE
      WHEN c.id IS NOT NULL THEN jsonb_set(elem, '{canonicalId}', to_jsonb(c.id::text), true)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(r.ingredients) elem
  LEFT JOIN public.canonical_ingredients c
    ON c.name = lower(trim(elem->>'name'))
), '[]'::jsonb)
WHERE jsonb_typeof(r.ingredients) = 'array';

-- 6. Repoint ingredient_aliases at canonical (was pointing at pantry rows)
ALTER TABLE public.ingredient_aliases
  DROP CONSTRAINT IF EXISTS ingredient_aliases_ingredient_id_fkey;

UPDATE public.ingredient_aliases a
SET ingredient_id = i.canonical_id
FROM public.ingredients i
WHERE a.ingredient_id = i.id AND i.canonical_id IS NOT NULL;

-- Drop any rows that couldn't be repointed (orphans)
DELETE FROM public.ingredient_aliases a
WHERE NOT EXISTS (
  SELECT 1 FROM public.canonical_ingredients c WHERE c.id = a.ingredient_id
);

ALTER TABLE public.ingredient_aliases
  ADD CONSTRAINT ingredient_aliases_canonical_fkey
  FOREIGN KEY (ingredient_id)
  REFERENCES public.canonical_ingredients(id) ON DELETE CASCADE;

-- === 20260510195419_5c15dd7f-8584-4be1-b2ac-1b278295348c.sql ===

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_categories_sort_order ON public.categories(sort_order);

INSERT INTO public.categories (name, sort_order) VALUES
  ('Herbs/spices & stock', 10),
  ('Oils', 20),
  ('Condiments', 30),
  ('Sauces & dressings', 40),
  ('Spreads & pastes', 50),
  ('Nuts, seeds & dried fruit', 60),
  ('Superfoods', 70),
  ('Breakfast & cereals', 80),
  ('Baking', 90),
  ('Bread, bakery & crackers', 100),
  ('Beans & pulses', 110),
  ('Pasta & noodles', 120),
  ('Jars & preserved foods', 130),
  ('Grains', 140),
  ('Fruit', 150),
  ('Veg', 160),
  ('Dairy', 170),
  ('Meat & fish', 180),
  ('Ready meals', 190),
  ('Sweet treats', 200),
  ('Kids food', 210);

-- === 20260511094822_0d605d54-6555-4579-bd47-16aa1d10c782.sql ===
ALTER TABLE public.canonical_ingredients ADD COLUMN IF NOT EXISTS last_category text;
-- === 20260511123000_add_recipes_serves.sql ===
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS serves text;

-- === 20260514120000_recipe_import_cache.sql ===
-- Server-side import caches (accessed only via service role in server functions).
CREATE TABLE public.recipe_import_cache (
  url_hash text PRIMARY KEY,
  payload jsonb NOT NULL,
  extraction_source text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ingredient_line_cache (
  line_key text PRIMARY KEY,
  name text NOT NULL,
  amount text,
  preparation text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipe_import_cache_expires_idx ON public.recipe_import_cache (expires_at);
CREATE INDEX ingredient_line_cache_expires_idx ON public.ingredient_line_cache (expires_at);

ALTER TABLE public.recipe_import_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_line_cache ENABLE ROW LEVEL SECURITY;

-- === 20260519120000_meal_plan_quick_label.sql ===

ALTER TABLE public.meal_plan
  ADD COLUMN label TEXT;

ALTER TABLE public.meal_plan
  ADD CONSTRAINT meal_plan_recipe_or_label_check
  CHECK (
    recipe_id IS NOT NULL
    OR (label IS NOT NULL AND length(trim(label)) > 0)
  );

-- === recipe metadata (tags, cook_time_minutes, meal_types) ===
-- See apply-recipe-metadata.sql for the same block (cleans data before constraints).

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

UPDATE public.recipes
SET cook_time_minutes = 30
WHERE 'Quick' = ANY(tags) AND cook_time_minutes IS NULL;

UPDATE public.recipes
SET tags = array_remove(tags, 'Quick')
WHERE 'Quick' = ANY(tags);

UPDATE public.recipes
SET tags = array_remove(tags, 'Sweet')
WHERE 'Sweet' = ANY(tags);

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

-- Recipe cover images (Supabase Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "public read recipe images"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

CREATE POLICY "public insert recipe images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "public update recipe images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'recipe-images')
WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "public delete recipe images"
ON storage.objects FOR DELETE
USING (bucket_id = 'recipe-images');


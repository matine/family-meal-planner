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

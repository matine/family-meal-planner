-- Require signed-in users for app data (Google OAuth via Supabase Auth).
-- Run after enabling Google provider in Supabase Dashboard → Authentication → Providers.

-- Core tables
DROP POLICY IF EXISTS "public all ingredients" ON public.ingredients;
CREATE POLICY "authenticated all ingredients" ON public.ingredients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all recipes" ON public.recipes;
CREATE POLICY "authenticated all recipes" ON public.recipes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all meal_plan" ON public.meal_plan;
CREATE POLICY "authenticated all meal_plan" ON public.meal_plan
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all shopping_list" ON public.shopping_list;
CREATE POLICY "authenticated all shopping_list" ON public.shopping_list
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Canonical / aliases
DROP POLICY IF EXISTS "public all canonical_ingredients" ON public.canonical_ingredients;
CREATE POLICY "authenticated all canonical_ingredients" ON public.canonical_ingredients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public all ingredient_aliases" ON public.ingredient_aliases;
CREATE POLICY "authenticated all ingredient_aliases" ON public.ingredient_aliases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Categories
DROP POLICY IF EXISTS "public all categories" ON public.categories;
CREATE POLICY "authenticated all categories" ON public.categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recipe images storage
DROP POLICY IF EXISTS "public read recipe images" ON storage.objects;
DROP POLICY IF EXISTS "public insert recipe images" ON storage.objects;
DROP POLICY IF EXISTS "public update recipe images" ON storage.objects;
DROP POLICY IF EXISTS "public delete recipe images" ON storage.objects;

CREATE POLICY "authenticated read recipe images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-images');

CREATE POLICY "authenticated insert recipe images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "authenticated update recipe images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-images')
  WITH CHECK (bucket_id = 'recipe-images');

CREATE POLICY "authenticated delete recipe images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images');


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

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
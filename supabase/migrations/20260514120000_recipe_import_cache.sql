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
